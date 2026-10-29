// Moments in a turn that need the user: an approval request, or a question from ask_user_question.
// A short delay skips the ones the user handles right away; they are already looking at the page.
export const ATTENTION_DELAY_MS = 5000

/** Whether an ask_user_question result is a timed-mode `pending` reply rather than an answer. */
export function isPendingAnswer(message) {
  try { return JSON.parse(message?.content?.[0]?.text)?.pending === true }
  catch { return false }
}

/**
 * Tracks open approvals and questions per top-level session. The timers and the notify
 * callback are passed in so tests can drive them; notify(sessionId, kind) receives
 * kind 'approval' or 'question'.
 */
export function createAttentionTracker({ delayMs = ATTENTION_DELAY_MS, setTimer, clearTimer, notify }) {
  const sessions = new Map()
  const stateOf = (id) => {
    let s = sessions.get(id)
    if (s === undefined) sessions.set(id, s = { approvals: new Map(), questions: new Map() })
    return s
  }
  const arm = (sessionId, open, key, kind) => {
    if (key === undefined || open.has(key)) return
    const entry = { timer: undefined }
    entry.timer = setTimer(() => {
      entry.timer = undefined
      // An approval is done once announced; an unanswered question stays open for the turn-end text.
      if (kind === 'approval') open.delete(key)
      notify(sessionId, kind)
    }, delayMs)
    open.set(key, entry)
  }
  const settle = (open, key) => {
    const entry = open.get(key)
    if (entry === undefined) return
    if (entry.timer !== undefined) clearTimer(entry.timer)
    open.delete(key)
  }
  const settleAll = (open) => { for (const key of [...open.keys()]) settle(open, key) }

  return {
    onEvent(session, event) {
      const s = stateOf(session.id)
      const data = event.data
      switch (event.type) {
        case 'approval/asked': return arm(session.id, s.approvals, data.id, 'approval')
        case 'approval/decided': return settle(s.approvals, data.id)
        case 'tool/call':
          if (data.name === 'ask_user_question') arm(session.id, s.questions, data.callId, 'question')
          return
        case 'tool/result': {
          const callId = data.message?.toolCallId
          if (s.questions.has(callId) && !isPendingAnswer(data.message)) settle(s.questions, callId)
          return
        }
        case 'user/message':
          // A late answer to a timed question; or the user wrote back, so they have seen it.
          if (data.source?.kind === 'user-question-reply') settle(s.questions, data.source.callId)
          else if (data.source?.kind === 'user') settleAll(s.questions)
          return
      }
    },
    hasOpenQuestion(sessionId) { return (sessions.get(sessionId)?.questions.size ?? 0) > 0 },
    dispose() {
      for (const s of sessions.values()) { settleAll(s.approvals); settleAll(s.questions) }
      sessions.clear()
    },
  }
}
