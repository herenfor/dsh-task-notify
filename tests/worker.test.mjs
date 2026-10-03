import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../notification-worker.js', import.meta.url), 'utf8')
function harness() {
  const events = {}, shown = [], closed = []
  let afterShow = () => {}
  const self = {
    addEventListener(name, callback) { events[name] = callback },
    skipWaiting: async () => {},
    registration: {
      scope: 'http://127.0.0.1:3080/dsh-task-notify/',
      async showNotification(title, options) { shown.push({ title, options }); afterShow() },
      async getNotifications({ tag } = {}) { return [{ close() { closed.push(tag ?? 'old-card') } }] },
    },
    // Accessing page APIs fails the test; notification clicks need no browser page.
    get clients() { throw new Error('Notification-only worker must not access pages') },
  }
  vm.runInNewContext(source, { self, URL, Date })
  const dispatch = async (name, event) => {
    let work
    events[name]({ ...event, waitUntil(promise) { work = promise } })
    await work
  }
  return { shown, closed, dispatch,
    afterShow(callback) { afterShow = callback },
    async show(data = {}) {
      let result
      await dispatch('message', { source: { id: 'original-page' }, data: {
        type: 'dsh-task-notify/show', ticket: 'delivery', deadline: Date.now() + 2500, ...data,
      }, ports: [{ postMessage(value) { result = value.handled }, close() {} }] })
      return result
    },
  }
}

test('Chinese completion content has no routing data or click promise', async () => {
  const h = harness()
  assert.equal(await h.show({ title: '任务通知插件' }), true)
  assert.equal(h.shown[0].title, 'DSH · 本轮已完成')
  assert.equal(h.shown[0].options.body, '会话：任务通知插件\n本轮对话已正常结束。')
  assert.equal(h.shown[0].options.data, undefined)
  assert.equal(h.shown[0].options.icon, 'http://127.0.0.1:3080/dsh-task-notify/whale.png')
})

test('manual tests are labeled as tests and promise no page action', async () => {
  const h = harness()
  assert.equal(await h.show({ test: true }), true)
  assert.equal(h.shown[0].title, 'DSH · 通知测试')
  assert.equal(h.shown[0].options.body, '浏览器通知已启用。')
})

test('expired deliveries cannot leave duplicate notifications after Windows fallback', async (t) => {
  const h = harness()
  assert.equal(await h.show({ deadline: Date.now() - 1 }), false)
  assert.equal(h.shown.length, 0)
  const now = Date.now()
  h.afterShow(() => t.mock.method(Date, 'now', () => now + 5000))
  assert.equal(await h.show({ deadline: now + 2500 }), false)
  assert.deepEqual(h.closed, ['dsh-turn-delivery'])
})

test('click only closes the notification, even with routing data from an old card', async () => {
  const h = harness()
  await h.dispatch('notificationclick', { notification: {
    data: { sessionId: 'session-target', windowClientId: 'original-page' },
    close() { h.closed.push('clicked') },
  } })
  assert.deepEqual(h.closed, ['clicked'])
})

test('worker update clears old cards that could retain previous click behavior', async () => {
  const h = harness()
  await h.dispatch('activate', {})
  assert.deepEqual(h.closed, ['old-card'])
})
