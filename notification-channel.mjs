import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const prefix = '/dsh-task-notify'

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 4096) throw new Error('Request too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function reply(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

// Deliver completion notifications to one authorized browser page.
export function createNotificationChannel(ctx, record = () => {}) {
  const clients = new Map()
  const pending = new Map()
  const routeDisposers = []
  let available = false

  const authorized = (request, response) => {
    const admission = ctx.connection.admit(request)
    if (!('rejection' in admission)) return true
    reply(response, admission.rejection, { error: 'Unauthorized' })
    return false
  }
  const register = (path, handler) => {
    const dispose = ctx.webServer.register({
    kind: 'exact', path: prefix + path,
    handler: async (request, response) => {
      try { await handler(request, response) }
      catch { if (!response.headersSent) reply(response, 400, { error: 'Invalid request' }) }
    },
    })
    routeDisposers.push(dispose)
  }
  const removeRoutes = () => {
    for (const dispose of routeDisposers.splice(0).reverse()) {
      try { dispose() } catch {}
    }
  }
  // Heartbeat timestamps rank pages; an open connection plus its reply proves liveness.
  const selectClient = () => [...clients.values()]
    .filter((client) => !client.response.destroyed && !client.response.writableEnded &&
      client.browserNotifications)
    .sort((a, b) => Number(b.focused) - Number(a.focused) || b.lastFocus - a.lastFocus || b.lastSeen - a.lastSeen)[0]
  const send = (client, ticket, payload) => new Promise((resolve) => {
    let finished = false
    const finish = (handled) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      pending.delete(ticket)
      resolve(handled)
    }
    const timer = setTimeout(() => finish(false), 2500)
    pending.set(ticket, { clientId: client.id, finish })
    try { client.response.write(`data: ${JSON.stringify({ ticket, ...payload })}\n\n`) }
    catch { finish(false) }
  })

  ctx.effect(() => {
    try {
      register('/events', (request, response) => {
        if (request.method !== 'GET') return reply(response, 405, {})
        if (!authorized(request, response)) return
        const id = new URL(request.url, 'http://localhost').searchParams.get('client')
        if (!/^[a-zA-Z0-9-]{16,64}$/.test(id ?? '')) return reply(response, 400, {})
        clients.get(id)?.response.end()
        const client = { id, response, lastSeen: Date.now(), lastFocus: 0, focused: false }
        clients.set(id, client)
        response.writeHead(200, {
          'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive',
        })
        response.write(': connected\n\n')
        const timer = setInterval(() => response.write(': heartbeat\n\n'), 20000)
        timer.unref()
        response.once('close', () => {
          clearInterval(timer)
          if (clients.get(id) === client) clients.delete(id)
          for (const wait of pending.values()) if (wait.clientId === id) wait.finish(false)
        })
      })
      register('/client', async (request, response) => {
        if (request.method !== 'POST') return reply(response, 405, {})
        if (!authorized(request, response)) return
        const body = await readJson(request)
        const client = clients.get(body.clientId)
        if (!client) return reply(response, 404, {})
        client.lastSeen = Date.now()
        client.focused = body.focused === true
        client.browserNotifications = body.browserNotifications === true
        if (client.focused) client.lastFocus = Date.now()
        if (typeof body.ticket === 'string') {
          const wait = pending.get(body.ticket)
          if (wait?.clientId === client.id) wait.finish(body.handled === true)
        }
        reply(response, 200, {})
      })
      for (const [path, file, type] of [
        ['/sw.js', 'notification-worker.js', 'text/javascript; charset=utf-8'],
        ['/whale.png', 'whale.png', 'image/png'],
      ]) register(path, async (request, response) => {
        if (request.method !== 'GET') return reply(response, 405, {})
        if (!authorized(request, response)) return
        const body = await readFile(new URL(file, import.meta.url))
        response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
        response.end(body)
      })
      available = true
    } catch (error) {
      removeRoutes()
      record(`notification-channel-unavailable ${String(error)}`)
      return () => {}
    }
    return () => {
      available = false
      removeRoutes()
      for (const wait of pending.values()) wait.finish(false)
      for (const client of clients.values()) client.response.end()
      clients.clear()
    }
  }, 'dsh-task-notify: browser notifications')

  return {
    async notify(sessionId) {
      if (!available) return false
      const client = selectClient()
      if (!client) return false
      const handled = await send(client, randomBytes(24).toString('hex'), {
        type: 'notify', sessionId, deadline: Date.now() + 2500,
      })
      record(`browser-${handled ? 'notified' : 'fallback'} session=${sessionId}`)
      return handled
    },
  }
}
