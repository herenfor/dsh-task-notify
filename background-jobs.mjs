// Background jobs a task is still waiting on. A turn that ends while they run is paused, not
// finished: the completion notice resumes the agent and that later turn sends the notification.
// This works from DSH's own job events, so it does not depend on the model declaring task_status.
export const SETTLE_GRACE_MS = 10_000

/** The job ids a task_status call marks as services left running on purpose, or []. */
export function declaredServices(argumentsJson) {
  try {
    const services = JSON.parse(argumentsJson)?.services
    return Array.isArray(services) ? services.filter((id) => typeof id === 'string') : []
  } catch { return [] }
}

/**
 * Tracks, per top-level session, the jobs started since the user's last message. Services and
 * jobs from earlier requests do not count, so a dev server left running cannot silence later
 * turns. When a turn ended quietly and its last job settles without DSH starting a new turn
 * (for example, its wake budget is spent), notify(sessionId) fires after graceMs so the
 * finished work is still announced. Timers are passed in so tests can drive them.
 */
export function createJobTracker({ graceMs = SETTLE_GRACE_MS, setTimer, clearTimer, notify }) {
  const sessions = new Map()
  const stateOf = (id) => {
    let s = sessions.get(id)
    if (s === undefined) sessions.set(id, s = { jobs: new Set(), services: new Set(), inTurn: false, quiet: false, timer: undefined })
    return s
  }
  const cancel = (s) => { if (s.timer !== undefined) clearTimer(s.timer); s.timer = undefined }
  const running = (s) => [...s.jobs].some((job) => !s.services.has(job))

  return {
    onEvent(session, event) {
      const s = stateOf(session.id)
      const data = event.data ?? {}
      switch (event.type) {
        case 'user/message':
          if (data.source?.kind === 'user') { s.jobs.clear(); s.quiet = false; cancel(s) }
          return
        case 'turn/start':
          s.inTurn = true; cancel(s)
          return
        case 'turn/end':
          s.inTurn = false
          return
        case 'job/registered':
          if ((data.owner ?? session.id) === session.id) s.jobs.add(data.jobId)
          return
        case 'job/settled':
          s.jobs.delete(data.jobId); s.services.delete(data.jobId)
          if (s.quiet && !s.inTurn && !running(s) && s.timer === undefined) {
            s.timer = setTimer(() => { s.timer = undefined; s.quiet = false; notify(session.id) }, graceMs)
          }
          return
        case 'tool/call':
          if (data.name === 'task_status') for (const job of declaredServices(data.arguments)) s.services.add(job)
          return
      }
    },
    /** Whether this session's task still has jobs running; call it at turn end. */
    isWaiting(sessionId) {
      return running(stateOf(sessionId))
    },
    /** Remember that this turn ended without a notification because jobs were running. */
    markQuiet(sessionId) {
      stateOf(sessionId).quiet = true
    },
    /** A notification went out for this session; nothing is owed any more. */
    markNotified(sessionId) {
      const s = stateOf(sessionId)
      s.quiet = false; cancel(s)
    },
    dispose() { for (const s of sessions.values()) cancel(s); sessions.clear() },
  }
}
