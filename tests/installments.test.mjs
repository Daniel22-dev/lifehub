import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRegularInstallmentPayment } from '../src/features/installments.js';

test('poslední pravidelná splátka se zastropuje na zbývající dluh', () => {
  assert.deepEqual(calculateRegularInstallmentPayment({total:10000,paid:9900,monthly:1000}),{
    appliedAmount:100,newPaid:10000,remainingBefore:100,remainingAfter:0,completed:true
  });
});

test('nulová nebo již doplacená splátka nic nezapíše', () => {
  assert.equal(calculateRegularInstallmentPayment({total:10000,paid:10000,monthly:1000}).appliedAmount,0);
  assert.equal(calculateRegularInstallmentPayment({total:10000,paid:5000,monthly:0}).appliedAmount,0);
});
