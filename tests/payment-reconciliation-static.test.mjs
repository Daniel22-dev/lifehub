import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');

test('starší uhrazené účty se při odemčení doplní do finančních transakcí',()=>{
  assert.ok(app.includes('function reconcileHouseholdPaymentTransactions()'));
  assert.ok(app.includes('const paymentTransactionsReconciled = reconcileHouseholdPaymentTransactions()'));
  assert.ok(app.includes("payment.status==='paid'"));
  assert.ok(app.includes("source:'payment'"));
  assert.ok(app.includes('paymentTransactionsReconciled.changed'));
});

test('ručně odpojený účet se automaticky znovu nepřipojí',()=>{
  assert.ok(app.includes('historyEntry.financeDetached=true'));
  assert.ok(app.includes('historyEntry.financeDetached===true'));
  assert.ok(app.includes('financeDetached:h?.financeDetached===true'));
});
