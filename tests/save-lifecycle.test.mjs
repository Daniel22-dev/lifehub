import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveLifecycle } from '../src/core/save-lifecycle.js';

test('selhání uložení blokuje bezpečné zamknutí až do úspěšného opakování', () => {
  const state = new SaveLifecycle();
  state.markDirty();
  state.begin();
  state.fail(new Error('quota'));
  assert.equal(state.blocksSafeLock,true);
  assert.equal(state.dirty,true);
  state.begin();
  state.succeed('2026-07-11T12:00:00.000Z');
  assert.equal(state.blocksSafeLock,false);
  assert.equal(state.lastSavedAt,'2026-07-11T12:00:00.000Z');
});
