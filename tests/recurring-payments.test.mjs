import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPaymentDueDate } from '../src/features/recurring-payments.js';

test('opakovaná platba respektuje poslední den měsíce', () => {
  assert.equal(nextPaymentDueDate('2026-01-31','monthly'),'2026-02-28');
  assert.equal(nextPaymentDueDate('2024-01-31','monthly'),'2024-02-29');
  assert.equal(nextPaymentDueDate('2026-11-30','quarterly'),'2027-02-28');
  assert.equal(nextPaymentDueDate('2024-02-29','yearly'),'2025-02-28');
});
