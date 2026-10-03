import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import { MessageChannel } from 'node:worker_threads'

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')

function harness({ browser = true } = {}) {
  const reports = [], reportWaiters = [], workerMessages = []
  const windowListeners = new Map()
  let events, cleanup, plugin, timersCleared = 0
  const window = {
    __ModuleLoader__: { load(module) { plugin = module.factory(() => ({})) } },
    crypto: { randomUUID: () => 'client-aaaaaaaaaaaaaaaa' },
    EventSource: class { constructor() { events = this } close() { this.closed = true } },
    document: { baseURI: 'http://127.0.0.1:3080/', visibilityState: 'visible', hasFocus: () => true,
      addEventListener() {}, removeEventListener() {} },
    fetch(_url, options) {
      const report = JSON.parse(options.body)
      reports.push(report)
      for (const waiter of reportWaiters) if (waiter.matches(report)) waiter.resolve(report)
      return Promise.resolve({ ok: true })
    },
    addEventListener(name, callback) { windowListeners.set(name, callback) },
    removeEventListener(name) { windowListeners.delete(name) },
    setInterval: () => 1, clearInterval() { timersCleared++ },
  }
  if (browser) {
    const Notification = class {}
    Notification.permission = 'granted'
    const worker = { state: 'activated',
      addEventListener() {}, removeEventListener() {},
      postMessage(data, ports) { workerMessages.push(data); ports[0].postMessage({ handled: true }); ports[0].close() },
    }
    Object.assign(window, { isSecureContext: true, Notification, MessageChannel, setTimeout, clearTimeout,
      localStorage: { getItem() { return null } },
      navigator: { serviceWorker: { async register() { return { active: worker } } } },
    })
  }
  vm.runInNewContext(source, { window, URL, console: { warn() {} } })
  // Supply only notification dependencies: no workspace or navigation services.
  plugin.apply({
    sessions: { list: { getSnapshot: () => ({ byId: { target: { title: '学习 runtime' } } }) } },
    slots: { inject() { return () => {} } },
    effect(fn) { cleanup = fn() },
  })
  return {
    reports, workerMessages, windowListeners,
    waitForReport(matches) {
      const existing = reports.find(matches)
      return existing ? Promise.resolve(existing) : new Promise((resolve) => reportWaiters.push({ matches, resolve }))
    },
    get events() { return events },
    get timersCleared() { return timersCleared },
    dispose() { cleanup?.() },
  }
}

const completion = () => ({ data: JSON.stringify({ type: 'notify', ticket: 'delivery', sessionId: 'target', deadline: Date.now() + 2500 }) })

test('completion submits a browser notification using only notification services', async () => {
  const h = harness()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  h.events.onopen()
  assert.equal(h.reports.at(-1).browserNotifications, true)
  h.events.onmessage(completion())
  await h.waitForReport((report) => report.ticket === 'delivery')
  assert.equal(h.workerMessages[0].title, '学习 runtime')
  assert.equal(h.workerMessages[0].sessionId, undefined)
  assert.equal(h.reports.at(-1).handled, true)
  h.dispose()
})

test('a page without browser notification support declines delivery for Windows fallback', async () => {
  const h = harness({ browser: false })
  h.events.onopen()
  assert.equal(h.reports.at(-1).browserNotifications, false)
  h.events.onmessage(completion())
  await h.waitForReport((report) => report.ticket === 'delivery')
  assert.equal(h.reports.at(-1).handled, false)
  assert.equal(h.workerMessages.length, 0)
  h.dispose()
})

test('disabling notifications in another tab removes capability and declines queued delivery', async () => {
  const h = harness()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  h.events.onopen()
  assert.equal(h.reports.at(-1).browserNotifications, true)
  h.windowListeners.get('storage')({ key: 'dsh.task-notify.browser-enabled', newValue: 'false' })
  assert.equal(h.reports.at(-1).browserNotifications, false)
  h.events.onmessage(completion())
  await h.waitForReport((report) => report.ticket === 'delivery')
  assert.equal(h.reports.at(-1).handled, false)
  h.dispose()
})

test('old click messages are ignored and disposal closes the completion stream', () => {
  const h = harness({ browser: false })
  h.events.onmessage({ data: JSON.stringify({ ticket: 'old-click', sessionId: 'target' }) })
  assert.equal(h.reports.length, 0)
  h.dispose()
  assert.equal(h.events.closed, true)
  assert.equal(h.timersCleared, 1)
  assert.equal(h.windowListeners.size, 0)
})
