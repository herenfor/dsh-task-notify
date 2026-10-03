import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createNotificationChannel } from '../notification-channel.mjs'

async function fixture(t) {
  const routes = new Map()
  const cleanup = []
  const server = createServer((req, res) => {
    const route = routes.get(new URL(req.url, 'http://localhost').pathname)
    if (route) void route(req, res)
    else { res.writeHead(404); res.end() }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  const bridge = createNotificationChannel({
    effect(fn) { cleanup.push(fn()) },
    webServer: { port, register(route) {
      routes.set(route.path, route.handler)
      return () => routes.delete(route.path)
    } },
    connection: { admit(req) { return req.headers.cookie === 'test-user' ? { peer: {} } : { rejection: 401 } } },
  })
  t.after(async () => {
    for (const dispose of cleanup) dispose()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const post = (path, body, authenticated = false, headers = {}) => fetch(`${base}/dsh-task-notify${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? { cookie: 'test-user' } : {}), ...headers },
    body: JSON.stringify(body),
  })
  const connect = async (clientId) => {
    const response = await fetch(`${base}/dsh-task-notify/events?client=${clientId}`, { headers: { cookie: 'test-user' } })
    assert.equal(response.status, 200)
    const reader = response.body.getReader()
    await reader.read() // connected comment
    return reader
  }
  return { base, connect, post, bridge }
}

test('completion is sent only to one authorized page with browser notification capability', async (t) => {
  const f = await fixture(t)
  await f.connect('client-aaaaaaaaaaaaaaaa')
  await f.post('/client', { clientId: 'client-aaaaaaaaaaaaaaaa', focused: true, browserNotifications: false }, true)
  const clientId = 'client-bbbbbbbbbbbbbbbb'
  const reader = await f.connect(clientId)
  await f.post('/client', { clientId, browserNotifications: true }, true)
  const delivery = f.bridge.notify('target')
  const event = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6).trim())
  assert.equal(event.type, 'notify')
  assert.equal(event.sessionId, 'target')
  assert.ok(event.deadline > Date.now())
  // Another page cannot acknowledge this delivery.
  await f.post('/client', { clientId: 'client-aaaaaaaaaaaaaaaa', ticket: event.ticket, handled: true }, true)
  await f.post('/client', { clientId, browserNotifications: true, ticket: event.ticket, handled: true }, true)
  assert.equal(await delivery, true)
})

test('no browser permission, explicit failure, and disconnect all allow native fallback', async (t) => {
  const f = await fixture(t)
  assert.equal(await f.bridge.notify('target'), false)
  const clientId = 'client-aaaaaaaaaaaaaaaa'
  const reader = await f.connect(clientId)
  assert.equal(await f.bridge.notify('target'), false)
  await f.post('/client', { clientId, browserNotifications: true }, true)
  const delivery = f.bridge.notify('target')
  const event = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6).trim())
  await f.post('/client', { clientId, ticket: event.ticket, handled: false }, true)
  assert.equal(await delivery, false)
  await f.post('/client', { clientId, browserNotifications: true }, true)
  const disconnected = f.bridge.notify('target')
  await reader.read()
  await reader.cancel()
  assert.equal(await disconnected, false)
})

test('worker code and whale image use the same host authentication as page channels', async (t) => {
  const f = await fixture(t)
  assert.equal((await fetch(f.base + '/dsh-task-notify/sw.js')).status, 401)
  const worker = await fetch(f.base + '/dsh-task-notify/sw.js', { headers: { cookie: 'test-user' } })
  assert.equal(worker.status, 200)
  assert.match(worker.headers.get('content-type'), /javascript/)
  assert.match(await worker.text(), /notificationclick/)
  const icon = await fetch(f.base + '/dsh-task-notify/whale.png', { headers: { cookie: 'test-user' } })
  assert.equal(icon.headers.get('content-type'), 'image/png')
})


test('page channels require authentication and the old activation endpoint is absent', async (t) => {
  const f = await fixture(t)
  assert.equal((await fetch(`${f.base}/dsh-task-notify/events?client=client-aaaaaaaaaaaaaaaa`)).status, 401)
  assert.equal((await f.post('/client', { clientId: 'client-aaaaaaaaaaaaaaaa' })).status, 401)
  assert.equal((await f.post('/activate', {})).status, 404)
})

test('an unresponsive browser times out and allows Windows fallback', async (t) => {
  const f = await fixture(t)
  const clientId = 'client-aaaaaaaaaaaaaaaa'
  await f.connect(clientId)
  await f.post('/client', { clientId, browserNotifications: true }, true)
  assert.equal(await f.bridge.notify('target'), false)
})

test('route-registration failure rolls back without blocking Windows fallback', async () => {
  let registered = 0, removed = 0
  const bridge = createNotificationChannel({
    effect(fn) { fn() }, connection: {},
    webServer: { register() {
      if (++registered === 2) throw new Error('Route conflict')
      return () => { removed++ }
    } },
  })
  assert.equal(removed, 1)
  assert.equal(await bridge.notify('target'), false)
})

test('a connected background page can receive even when its heartbeat is old', async (t) => {
  const realNow = Date.now
  let offset = 0
  t.mock.method(Date, 'now', () => realNow() + offset)
  const f = await fixture(t)
  const clientId = 'client-aaaaaaaaaaaaaaaa'
  const reader = await f.connect(clientId)
  await f.post('/client', { clientId, browserNotifications: true }, true)
  offset = 61000
  const delivery = f.bridge.notify('target')
  const event = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6).trim())
  await f.post('/client', { clientId, browserNotifications: true, ticket: event.ticket, handled: true }, true)
  assert.equal(await delivery, true)
})
