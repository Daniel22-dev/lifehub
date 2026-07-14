import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransactionRecord } from '../src/features/finance.js';

test('úprava mzdové transakce zachová vazbu na výplatní pásku', () => {
  const existing = {
    id:'trans_1', source:'payroll', payrollId:'payroll_1', payrollMonth:'2026-06',
    createdAt:'2026-06-30T10:00:00.000Z'
  };
  const result = buildTransactionRecord({
    id:'trans_1', date:'2026-06-30', kind:'income', category:'mzda', amount:'42 000', description:'upraveno'
  }, existing, '2026-07-10T10:00:00.000Z');
  assert.equal(result.payrollId, 'payroll_1');
  assert.equal(result.payrollMonth, '2026-06');
  assert.equal(result.source, 'payroll');
  assert.equal(result.amount, 42000);
  assert.equal(result.createdAt, existing.createdAt);
});


test('úprava propojeného výdaje zachová vazbu na platbu', () => {
  const existing={id:'trans_2',source:'payment',paymentId:'pay_1',paymentHistoryId:'hpay_1',createdAt:'2026-07-01T10:00:00.000Z'};
  const result=buildTransactionRecord({id:'trans_2',date:'2026-07-14',kind:'expense',category:'bydlení',amount:2500,description:'Elektřina'},existing,'2026-07-14T11:00:00.000Z');
  assert.equal(result.source,'payment');
  assert.equal(result.paymentId,'pay_1');
  assert.equal(result.paymentHistoryId,'hpay_1');
});
