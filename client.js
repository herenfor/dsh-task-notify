// Register the browser half using DSH's client module contract.
window.__ModuleLoader__.load({
  id: 'dsh-task-notify',
  factory: (require) => {
    const React = require('react')
    return {
    name: 'dsh-task-notify-browser',
    inject: ['sessions', 'slots'],
    apply(ctx) {
      ctx.effect(() => {
        let disposed = false
        const disposers = []
        const observers = new Set()
        const enabledKey = 'dsh.task-notify.browser-enabled'
        const supported = Boolean(window.isSecureContext && window.navigator?.serviceWorker &&
          typeof window.Notification === 'function' && typeof window.MessageChannel === 'function')
        let enabled = true
        try { enabled = window.localStorage?.getItem(enabledKey) !== 'false' } catch {}
        let registration, initializing, reportStatus = () => {}, busy = false, failed = false
        const workerUrl = supported ? new URL('dsh-task-notify/sw.js', window.document.baseURI) : null
        const ready = () => Boolean(enabled && !failed && registration?.active && window.Notification?.permission === 'granted')
        const publish = () => {
          if (disposed) return
          for (const observer of observers) observer()
          reportStatus()
        }
        const activateWorker = (reg) => new Promise((resolve, reject) => {
          const worker = reg.active ?? reg.installing ?? reg.waiting
          if (!worker) return reject(new Error('No notification worker'))
          const finish = (error) => {
            window.clearTimeout(timer)
            worker.removeEventListener('statechange', changed)
            error ? reject(error) : resolve(reg)
          }
          const changed = () => {
            if (worker.state === 'activated') finish()
            else if (worker.state === 'redundant') finish(new Error('Notification worker was replaced'))
          }
          const timer = window.setTimeout(() => finish(new Error('Notification worker timed out')), 5000)
          worker.addEventListener('statechange', changed)
          changed()
        })
        const initialize = () => {
          if (!supported || !enabled || window.Notification.permission !== 'granted') return Promise.resolve()
          if (initializing) return initializing
          initializing = window.navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' })
            .then(activateWorker).then((reg) => { if (!disposed) { registration = reg; failed = false } })
            .catch((error) => { failed = true; console.warn('[dsh-task-notify] Could not prepare browser notifications:', error) })
            .finally(() => { initializing = null; publish() })
          return initializing
        }
        const showNotification = (data) => new Promise((resolve) => {
          if (!ready() || disposed || Date.now() >= data.deadline) return resolve(false)
          const channel = new window.MessageChannel()
          let done = false
          const finish = (handled) => {
            if (done) return
            done = true
            window.clearTimeout(timer)
            channel.port1.close()
            resolve(handled)
          }
          const timer = window.setTimeout(() => finish(false), Math.max(1, data.deadline - Date.now()))
          channel.port1.onmessage = (event) => finish(event.data?.handled === true)
          try { registration.active.postMessage({ ...data, type: 'dsh-task-notify/show' }, [channel.port2]) }
          catch { channel.port2.close(); finish(false) }
        })

        function NotificationSettings() {
          const [, refresh] = React.useState(0)
          React.useEffect(() => {
            const update = () => refresh((value) => value + 1)
            observers.add(update)
            return () => observers.delete(update)
          }, [])
          const permission = window.Notification?.permission
          const status = !supported ? '当前页面无法使用浏览器通知。' : !enabled ? '浏览器通知已关闭。' :
            ready() ? '当前浏览器已启用任务通知。' : permission === 'denied' ? '通知权限被阻止，请在浏览器的网站设置中允许通知。' :
            failed ? '浏览器通知暂不可用，将使用 Windows 通知。' : permission === 'granted' ? '正在准备浏览器通知…' : '尚未允许通知。'
          const button = (text, onClick, disabled = false) => React.createElement('button', {
            type: 'button', onClick, disabled: busy || disabled, style: { padding: '8px 12px', cursor: 'pointer' },
          }, text)
          return React.createElement('section', { style: { padding: '20px', display: 'grid', gap: '14px' } },
            React.createElement('h2', null, '任务通知'),
            React.createElement('p', null, '任务完成后显示系统通知。没有可用浏览器页面时，使用 Windows 通知保底。'),
            React.createElement('p', { role: 'status' }, status),
            React.createElement('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
              button('启用浏览器通知', async () => {
                busy = true; publish()
                try {
                  // Request permission directly from the human's button click.
                  const permission = await window.Notification.requestPermission()
                  if (permission === 'granted') {
                    enabled = true
                    try { window.localStorage.setItem(enabledKey, 'true') } catch {}
                    await initialize()
                  }
                } catch { failed = true }
                finally { busy = false; publish() }
              }, !supported || (ready() && !failed)),
              button('测试通知', async () => {
                busy = true; publish()
                try {
                  failed = !await showNotification({ test: true, ticket: window.crypto.randomUUID(), deadline: Date.now() + 2500 })
                } finally { busy = false; publish() }
              }, !ready()),
              button('关闭浏览器通知', () => {
                enabled = false
                try { window.localStorage.setItem(enabledKey, 'false') } catch {}
                publish()
              }, !enabled)))
        }
        disposers.push(ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'task-notify', order: 90, label: () => '任务通知',
        }, NotificationSettings)))

        if (supported) {
          const storageChanged = (event) => {
            if (event.key !== enabledKey) return
            enabled = event.newValue !== 'false'
            if (enabled) void initialize()
            publish()
          }
          window.addEventListener('storage', storageChanged)
          disposers.push(() => window.removeEventListener('storage', storageChanged))
          void initialize()
        }

        // Report notification capability and receive completion events.
        if (typeof window.EventSource === 'function') {
          const clientId = window.crypto.randomUUID()
          const eventsUrl = new URL('dsh-task-notify/events', window.document.baseURI)
          eventsUrl.searchParams.set('client', clientId)
          const clientUrl = new URL('dsh-task-notify/client', window.document.baseURI)
          const events = new window.EventSource(eventsUrl)
          const sendStatus = (extra = {}) => {
            if (disposed) return Promise.resolve()
            return window.fetch(clientUrl, {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                clientId,
                focused: window.document.visibilityState === 'visible' && window.document.hasFocus(),
                browserNotifications: ready(),
                ...extra,
              }),
            }).catch(() => {})
          }
          const status = () => { void sendStatus() }
          reportStatus = status
          events.onopen = status
          events.onmessage = (event) => {
            try {
              const { type, ticket, sessionId, deadline } = JSON.parse(event.data)
              if (type !== 'notify' || typeof ticket !== 'string' || typeof sessionId !== 'string' ||
                  !Number.isFinite(deadline)) return
              const title = ctx.sessions.list.getSnapshot().byId?.[sessionId]?.title
              void showNotification({ ticket, title, deadline })
                .then((handled) => sendStatus({ ticket, handled }))
            } catch (error) { console.warn('[dsh-task-notify] Invalid notification event:', error) }
          }
          window.addEventListener('focus', status)
          window.addEventListener('blur', status)
          window.document.addEventListener('visibilitychange', status)
          const timer = window.setInterval(status, 15000)
          disposers.push(() => {
            events.close()
            window.clearInterval(timer)
            window.removeEventListener('focus', status)
            window.removeEventListener('blur', status)
            window.document.removeEventListener('visibilitychange', status)
          })
        }
        return () => {
          disposed = true
          for (const dispose of disposers) dispose()
          observers.clear()
        }
      }, 'dsh-task-notify: browser notifications')
    },
    }
  },
})
