import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPaymentDueDate, advanceAutomaticPayment } from '../src/features/recurring-payments.js';

test('opakovaná platba respektuje poslední den měsíce', () => {
  assert.equal(nextPaymentDueDate('2026-01-31','monthly'),'2026-02-28');
  assert.equal(nextPaymentDueDate('2024-01-31','monthly'),'2024-02-29');
  assert.equal(nextPaymentDueDate('2026-11-30','quarterly'),'2027-02-28');
  assert.equal(nextPaymentDueDate('2024-02-29','yearly'),'2025-02-28');
});


test('automatická měsíční platba doplní historii a posune další termín', () => {
  const result = advanceAutomaticPayment({
    id:'p1', title:'Plyn', amount:2550, frequency:'monthly', dueDate:'2026-05-13',
    automatic:true, status:'pending', paymentHistory:[]
  }, '2026-07-12');
  assert.equal(result.changed, true);
  assert.deepEqual(result.occurrences, [
    {date:'2026-05-13', amount:2550},
    {date:'2026-06-13', amount:2550}
  ]);
  assert.equal(result.payment.dueDate, '2026-07-13');
  assert.equal(result.payment.lastPaidAt, '2026-06-13');
  assert.equal(result.payment.status, 'pending');
});

test('ruční platba se automaticky neposune', () => {
  const result = advanceAutomaticPayment({amount:1200,frequency:'monthly',dueDate:'2026-06-01',automatic:false}, '2026-07-12');
  assert.equal(result.changed, false);
  assert.equal(result.occurrences.length, 0);
});

test('jednorázová automatická platba se po termínu uzavře', () => {
  const result = advanceAutomaticPayment({amount:900,frequency:'once',dueDate:'2026-07-01',automatic:true,status:'pending'}, '2026-07-12');
  assert.equal(result.changed, true);
  assert.equal(result.payment.status, 'paid');
  assert.equal(result.payment.lastPaidAt, '2026-07-01');
  assert.deepEqual(result.occurrences, [{date:'2026-07-01',amount:900}]);
});
