// Narrow scope, no fetch handler: this worker handles notifications, not page loading.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))

// Retire cards left by an earlier worker with different click behavior.
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const notification of await self.registration.getNotifications()) notification.close()
})()))

// Title and body per notification kind; anything unknown reads as an ordinary completion.
const CONTENT = {
  completed: ['DSH · 本轮已完成', '本轮对话已正常结束。'],
  asking: ['DSH · 等你回答', '本轮已结束，还有问题等你回答。'],
  approval: ['DSH · 需要审批', '有操作在等你批准。'],
  question: ['DSH · 需要你回答', 'AI 向你提了问题。'],
}

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
      const [heading, text] = data.test ? ['DSH · 通知测试', '浏览器通知已启用。'] : CONTENT[Object.hasOwn(CONTENT, data.kind) ? data.kind : 'completed']
      await self.registration.showNotification(heading, {
        body: !data.test && title ? `会话：${title}\n${text}` : text,
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
