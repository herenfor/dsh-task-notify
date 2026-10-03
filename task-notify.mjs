import { spawn } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createNotificationChannel } from './notification-channel.mjs'

export const name = 'dsh-task-notify'
export const inject = ['webServer', 'connection']

const notifier = fileURLToPath(new URL('./notify-windows.sh', import.meta.url))
const diagnosticLog = fileURLToPath(new URL('./notification.log', import.meta.url))

// Record lifecycle facts only; never include prompts or assistant messages.
function record(message) {
  void appendFile(diagnosticLog, `${new Date().toISOString()} pid=${process.pid} ${message}\n`).catch(() => {})
}

function notifyWithoutBlocking(ctx, sessionId) {
  try {
    const child = spawn('bash', [notifier], {
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

async function notifyCompletedTurn(ctx, channel, sessionId) {
  try { if (await channel?.notify(sessionId)) return }
  catch (error) { record(`browser-notification-failed session=${sessionId} ${String(error)}`) }
  notifyWithoutBlocking(ctx, sessionId)
}

export function apply(ctx) {
  record('plugin-loaded')
  let channel
  try { channel = createNotificationChannel(ctx, record) }
  catch (error) { record(`notification-channel-unavailable ${String(error)}`) }
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end' || event.data.reason.kind !== 'completed') return
    if ((session.header.delegationDepth ?? 0) > 0) return

    record(`turn-completed session=${session.id}`)
    // The observer returns immediately; a slow or failed browser cannot delay the agent.
    void notifyCompletedTurn(ctx, channel, session.id).catch(() => {})
  })
}
