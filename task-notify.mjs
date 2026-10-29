import { spawn } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createAttentionTracker } from './attention.mjs'
import { createNotificationChannel } from './notification-channel.mjs'

export const name = 'dsh-task-notify'
export const inject = ['webServer', 'connection']

const notifier = fileURLToPath(new URL('./notify-windows.sh', import.meta.url))
const diagnosticLog = fileURLToPath(new URL('./notification.log', import.meta.url))

// Record lifecycle facts only; never include prompts or assistant messages.
function record(message) {
  void appendFile(diagnosticLog, `${new Date().toISOString()} pid=${process.pid} ${message}\n`).catch(() => {})
}

function notifyWithoutBlocking(ctx, sessionId, kind) {
  try {
    const child = spawn('bash', [notifier, kind], {
      detached: true,
      stdio: 'ignore',
    })
    child.once('error', (error) => {
      record(`notification-start-failed session=${sessionId} ${String(error)}`)
      ctx.logger.warn(`task notification for ${sessionId} could not start: ${String(error)}`)
    })
    child.once('close', (code) => {
      record(`notification-exit session=${sessionId} code=${code}`)
      if (code !== 0) ctx.logger.warn(`task notification for ${sessionId} exited with code ${code}`)
    })
    child.unref()
  } catch (error) {
    record(`notification-start-failed session=${sessionId} ${String(error)}`)
    ctx.logger.warn(`task notification for ${sessionId} could not start: ${String(error)}`)
  }
}

async function notifyUser(ctx, channel, sessionId, kind) {
  try { if (await channel?.notify(sessionId, kind)) return }
  catch (error) { record(`browser-notification-failed session=${sessionId} ${String(error)}`) }
  notifyWithoutBlocking(ctx, sessionId, kind)
}

/** The state a task_status call declared (see dsh-runtime-tuning wait-guard), or undefined. */
export function declaredState(argumentsJson) {
  try {
    const state = JSON.parse(argumentsJson)?.state
    return state === 'waiting' || state === 'asking' || state === 'done' ? state : undefined
  } catch { return undefined }
}

/** Which notification a normally completed turn gets, or undefined when it gets none. */
export function turnEndKind(declared, hasOpenQuestion) {
  if (declared === 'waiting') return undefined
  return declared === 'asking' || hasOpenQuestion ? 'asking' : 'completed'
}

export function apply(ctx) {
  record('plugin-loaded')
  let channel
  try { channel = createNotificationChannel(ctx, record) }
  catch (error) { record(`notification-channel-unavailable ${String(error)}`) }
  // The observer returns immediately; a slow or failed browser cannot delay the agent.
  const send = (sessionId, kind) => { void notifyUser(ctx, channel, sessionId, kind).catch(() => {}) }
  const attention = createAttentionTracker({
    setTimer: (fn, ms) => { const timer = setTimeout(fn, ms); timer.unref?.(); return timer },
    clearTimer: (timer) => clearTimeout(timer),
    notify: (sessionId, kind) => { record(`needs-${kind} session=${sessionId}`); send(sessionId, kind) },
  })
  ctx.effect(() => () => attention.dispose(), 'dsh-task-notify: approval and question timers')
  // A turn that ends by declaring "waiting" is paused on background work, not finished.
  const declared = new Map()
  ctx.on('session/event', (session, event) => {
    if ((session.header.delegationDepth ?? 0) > 0) return
    attention.onEvent(session, event)
    if (event.type === 'turn/start') { declared.delete(session.id); return }
    if (event.type === 'tool/call' && event.data.name === 'task_status') {
      declared.set(session.id, declaredState(event.data.arguments))
      return
    }
    if (event.type !== 'turn/end' || event.data.reason.kind !== 'completed') return
    const kind = turnEndKind(declared.get(session.id), attention.hasOpenQuestion(session.id))
    declared.delete(session.id)
    if (kind === undefined) { record(`turn-waiting session=${session.id}`); return }

    record(`turn-${kind} session=${session.id}`)
    send(session.id, kind)
  })
}
