import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureUniqueIds, migrateStateSchema } from '../src/core/state-integrity.js';

test('migrace doplní aktuální schemaVersion bez změny vstupu', () => {
  const original={schemaVersion:2,notes:[{id:'a'}]};
  const migrated=migrateStateSchema(original);
  assert.equal(migrated.schemaVersion,5);
  assert.equal(original.schemaVersion,2);
});

test('duplicitní ID z importu se nahradí v kolekcích i historii plateb', () => {
  let seq=0;
  const state={
    notes:[{id:'dup'},{id:'dup'},{id:''}],
    installments:[{id:'inst',paymentHistory:[{id:'h'},{id:'h'},{id:''}]}]
  };
  ensureUniqueIds(state,prefix=>`${prefix}_${++seq}`);
  assert.equal(new Set(state.notes.map(item=>item.id)).size,3);
  assert.equal(new Set(state.installments[0].paymentHistory.map(item=>item.id)).size,3);
  assert.equal(state.notes[0].id,'dup');
  assert.equal(state.installments[0].paymentHistory[0].id,'h');
});
