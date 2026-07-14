import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureUniqueIds, migrateStateSchema } from '../src/core/state-integrity.js';

test('migrace doplní aktuální schemaVersion bez změny vstupu', () => {
  const original={schemaVersion:2,notes:[{id:'a'}]};
  const migrated=migrateStateSchema(original);
  assert.equal(migrated.schemaVersion,8);
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


test('migrace pásek oddělí čistou mzdu od částky na účet', () => {
  const input={schemaVersion:5,payrolls:[{id:'p1',month:'2026-06',note:'čistá mzda 35 711 Kč, na účet 35 521 Kč',fields:{netPay:35521,grossPay:40910}}]};
  const out=migrateStateSchema(input,6);
  assert.equal(out.schemaVersion,6);
  assert.equal(out.payrolls[0].fields.cleanPay,35711);
  assert.equal(out.payrolls[0].fields.netPay,35521);
});


test('migrace převádí stará odměnová období a zapíná propojení plateb', () => {
  const input={schemaVersion:7,rewards:[{id:'r1',period:'2026-Z'},{id:'r2',period:'2026-L'}],householdPayments:[{id:'p1'}]};
  const out=migrateStateSchema(input);
  assert.equal(out.rewards[0].period,'2026-2027-A');
  assert.equal(out.rewards[1].period,'2025-2026-B');
  assert.equal(out.householdPayments[0].trackFinance,true);
  assert.equal(out.schemaVersion,8);
});
