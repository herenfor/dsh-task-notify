import assert from 'node:assert/strict'
import test from 'node:test'

import { declaredState, turnEndKind } from '../task-notify.mjs'

test('declaredState reads the task_status state from tool-call arguments', () => {
  assert.equal(declaredState('{"state":"waiting","waiting_for":"bash-1","expected_minutes":5}'), 'waiting')
  assert.equal(declaredState('{"state":"done"}'), 'done')
  assert.equal(declaredState('{"state":"asking"}'), 'asking')
  assert.equal(declaredState('{"state":"paused"}'), undefined)
  assert.equal(declaredState('not json'), undefined)
  assert.equal(declaredState('null'), undefined)
})

test('turnEndKind skips waiting turns and names turns that still need an answer', () => {
  assert.equal(turnEndKind('waiting', true), undefined)
  assert.equal(turnEndKind('asking', false), 'asking')
  assert.equal(turnEndKind(undefined, true), 'asking')
  assert.equal(turnEndKind('done', false), 'completed')
  assert.equal(turnEndKind(undefined, false), 'completed')
})
