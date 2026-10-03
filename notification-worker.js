// Narrow scope, no fetch handler: this worker handles notifications, not page loading.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))

// Retire cards left by an earlier worker with different click behavior.
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const notification of await self.registration.getNotifications()) notification.close()
})()))

self.addEventListener('message', (event) => {
  const data = event.data
  if (data?.type !== 'dsh-task-notify/show') return
  const port = event.ports[0]
  event.waitUntil((async () => {
    let handled = false
    try {
      if (!event.source?.id ||
          typeof data.ticket !== 'string' || !Number.isFinite(data.deadline) || Date.now() >= data.deadline) return
      const title = typeof data.title === 'string' ? data.title.trim().slice(0, 80) : ''
      const tag = `dsh-turn-${data.ticket}`
      await self.registration.showNotification(data.test ? 'DSH · 通知测试' : 'DSH · 本轮已完成', {
        body: data.test ? '浏览器通知已启用。' : title ? `会话：${title}\n本轮对话已正常结束。` : '本轮对话已正常结束。',
        icon: new URL('whale.png', self.registration.scope).href,
        tag,
      })
      // An expired delivery must not leave a second notification after native fallback.
      if (Date.now() >= data.deadline) {
        for (const notification of await self.registration.getNotifications({ tag })) notification.close()
      } else handled = true
    } catch {}
    finally { try { port?.postMessage({ handled }); port?.close() } catch {} }
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
})
