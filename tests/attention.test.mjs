import assert from 'node:assert/strict'
import test from 'node:test'

import { createAttentionTracker, isPendingAnswer } from '../attention.mjs'

function harness() {
  const timers = new Map(), sent = []
  let next = 0
  const tracker = createAttentionTracker({
    delayMs: 5000,
    setTimer: (fn) => { const id = ++next; timers.set(id, fn); return id },
    clearTimer: (id) => timers.delete(id),
    notify: (sessionId, kind) => sent.push([sessionId, kind]),
  })
  const session = { id: 'top', header: {} }
  return {
    tracker, sent, timers,
    event: (type, data) => tracker.onEvent(session, { type, data }),
    elapse() { const due = [...timers.values()]; timers.clear(); for (const fn of due) fn() },
  }
}
const answer = (callId, value) => ({ message: { toolCallId: callId, content: [{ type: 'text', text: JSON.stringify(value) }] } })

test('an approval nobody decides within the delay is announced once', () => {
  const h = harness()
  h.event('approval/asked', { id: 'a1', toolName: 'bash' })
  h.elapse()
  h.event('approval/decided', { id: 'a1', outcome: 'allowed-once' })
  assert.deepEqual(h.sent, [['top', 'approval']])
})

test('an approval decided within the delay is not announced', () => {
  const h = harness()
  h.event('approval/asked', { id: 'a1' })
  h.event('approval/decided', { id: 'a1', outcome: 'allowed-once' })
  h.elapse()
  assert.deepEqual(h.sent, [])
})

test('a blocking question answered within the delay is not announced', () => {
  const h = harness()
  h.event('tool/call', { name: 'ask_user_question', callId: 'q1' })
  h.event('tool/result', answer('q1', { answers: [] }))
  h.elapse()
  assert.deepEqual(h.sent, [])
  assert.equal(h.tracker.hasOpenQuestion('top'), false)
})

test('a timed question stays open through its pending result until the late reply', () => {
  const h = harness()
  h.event('tool/call', { name: 'ask_user_question', callId: 'q1' })
  h.event('tool/result', answer('q1', { pending: true, callId: 'q1' }))
  h.elapse()
  assert.deepEqual(h.sent, [['top', 'question']])
  assert.equal(h.tracker.hasOpenQuestion('top'), true)
  h.event('user/message', { source: { kind: 'user-question-reply', callId: 'q1' } })
  assert.equal(h.tracker.hasOpenQuestion('top'), false)
})

test('a user message closes open questions; notices from tools do not', () => {
  const h = harness()
  h.event('tool/call', { name: 'ask_user_question', callId: 'q1' })
  h.event('user/message', { source: { kind: 'tool-jobs' } })
  assert.equal(h.tracker.hasOpenQuestion('top'), true)
  h.event('user/message', { source: { kind: 'user' } })
  assert.equal(h.tracker.hasOpenQuestion('top'), false)
  h.elapse()
  assert.deepEqual(h.sent, [])
})

test('other tool calls and results are ignored, and dispose clears timers', () => {
  const h = harness()
  h.event('tool/call', { name: 'bash', callId: 'b1' })
  h.event('tool/result', answer('b1', {}))
  h.event('approval/asked', { id: 'a1' })
  h.tracker.dispose()
  assert.equal(h.timers.size, 0)
  assert.deepEqual(h.sent, [])
})

test('isPendingAnswer only accepts the rendered pending JSON', () => {
  assert.equal(isPendingAnswer({ content: [{ type: 'text', text: '{"pending":true,"callId":"q1"}' }] }), true)
  assert.equal(isPendingAnswer({ content: [{ type: 'text', text: '{"answers":[]}' }] }), false)
  assert.equal(isPendingAnswer({ content: [{ type: 'text', text: 'not json' }] }), false)
  assert.equal(isPendingAnswer(undefined), false)
})
