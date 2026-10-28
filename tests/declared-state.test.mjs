import assert from 'node:assert/strict'
import test from 'node:test'

import { declaredState } from '../task-notify.mjs'

test('declaredState reads the task_status state from tool-call arguments', () => {
  assert.equal(declaredState('{"state":"waiting","waiting_for":"bash-1","expected_minutes":5}'), 'waiting')
  assert.equal(declaredState('{"state":"done"}'), 'done')
  assert.equal(declaredState('{"state":"paused"}'), undefined)
  assert.equal(declaredState('not json'), undefined)
  assert.equal(declaredState('null'), undefined)
})
