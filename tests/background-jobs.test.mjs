import assert from 'node:assert/strict'
import test from 'node:test'

import { createJobTracker, declaredServices } from '../background-jobs.mjs'

function harness() {
  const timers = [], notified = []
  const tracker = createJobTracker({
    graceMs: 10_000,
    setTimer: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t },
    clearTimer: (t) => { t.cleared = true },
    notify: (sessionId) => notified.push(sessionId),
  })
  const session = { id: 's' }
  const ev = (type, data = {}) => tracker.onEvent(session, { type, data })
  const userAsks = () => ev('user/message', { source: { kind: 'user' } })
  const turn = (body = () => {}) => { ev('turn/start'); body(); ev('turn/end', { reason: { kind: 'completed' } }) }
  return { tracker, timers, notified, ev, userAsks, turn }
}

test('declaredServices reads the services list from task_status arguments', () => {
  assert.deepEqual(declaredServices('{"state":"done","services":["bash-dev"]}'), ['bash-dev'])
  assert.deepEqual(declaredServices('{"state":"done"}'), [])
  assert.deepEqual(declaredServices('not json'), [])
})

test('a turn that ends while its job runs is waiting; the job settling clears it', () => {
  const h = harness()
  h.userAsks()
  h.turn(() => h.ev('job/registered', { jobId: 'bash-1', owner: 's' }))
  assert.equal(h.tracker.isWaiting('s'), true)
  h.ev('job/settled', { jobId: 'bash-1' })
  assert.equal(h.tracker.isWaiting('s'), false)
})

test('services and jobs from an earlier request do not hold later turns', () => {
  const h = harness()
  h.userAsks()
  h.turn(() => {
    h.ev('job/registered', { jobId: 'bash-dev', owner: 's' })
    h.ev('tool/call', { name: 'task_status', arguments: '{"state":"done","services":["bash-dev"]}' })
  })
  assert.equal(h.tracker.isWaiting('s'), false)

  h.turn(() => h.ev('job/registered', { jobId: 'bash-watch', owner: 's' }))
  assert.equal(h.tracker.isWaiting('s'), true)
  h.userAsks()  // a new request: the watcher started for the old one no longer counts
  assert.equal(h.tracker.isWaiting('s'), false)
})

test('jobs owned by another session are ignored', () => {
  const h = harness()
  h.ev('job/registered', { jobId: 'bash-x', owner: 'other' })
  assert.equal(h.tracker.isWaiting('s'), false)
})

test('a quiet turn whose job settles with no new turn is announced after the grace period', () => {
  const h = harness()
  h.userAsks()
  h.turn(() => h.ev('job/registered', { jobId: 'bash-1', owner: 's' }))
  h.tracker.markQuiet('s')
  h.ev('job/settled', { jobId: 'bash-1' })
  assert.equal(h.timers.length, 1)
  assert.equal(h.timers[0].ms, 10_000)
  h.timers[0].fn()
  assert.deepEqual(h.notified, ['s'])
})

test('the completion notice starting a new turn cancels the fallback', () => {
  const h = harness()
  h.userAsks()
  h.turn(() => h.ev('job/registered', { jobId: 'bash-1', owner: 's' }))
  h.tracker.markQuiet('s')
  h.ev('job/settled', { jobId: 'bash-1' })
  h.ev('turn/start')
  assert.equal(h.timers[0].cleared, true)
  assert.deepEqual(h.notified, [])
})

test('no fallback when the turn was not quiet or the job settles mid-turn', () => {
  const notQuiet = harness()
  notQuiet.userAsks()
  notQuiet.turn(() => notQuiet.ev('job/registered', { jobId: 'bash-1', owner: 's' }))
  notQuiet.ev('job/settled', { jobId: 'bash-1' })
  assert.equal(notQuiet.timers.length, 0)

  const midTurn = harness()
  midTurn.userAsks()
  midTurn.turn(() => midTurn.ev('job/registered', { jobId: 'bash-1', owner: 's' }))
  midTurn.tracker.markQuiet('s')
  midTurn.ev('turn/start')
  midTurn.ev('job/settled', { jobId: 'bash-1' })
  assert.equal(midTurn.timers.length, 0)
})
