import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeFamilySnapshot, nextPaymentDueDate, recordFamilyDeletion } from '../src/features/family-sync.js';

test('family merge adds new records and updates newer records without duplicating IDs', () => {
  const state = {
    settings: { foodBudget: 1000, fuelBudget: 500, savingGoal: 0, familySettingsUpdatedAt: '2026-01-01T00:00:00.000Z' },
    familyDeleted: [],
    transactions: [{ id: 'trans_1', amount: 100, shared: true, updatedAt: '2026-01-01T00:00:00.000Z' }],
    budgetEntries: [], groceries: [], tasks: [], shopping: [], installments: [], householdPayments: [], gardenItems: [], gardenLogs: []
  };
  const result = mergeFamilySnapshot(state, {
    exportedAt: '2026-02-01T00:00:00.000Z',
    householdSettings: { foodBudget: 12000, fuelBudget: 4000, savingGoal: 5000, updatedAt: '2026-02-01T00:00:00.000Z' },
    tombstones: [],
    data: {
      transactions: [
        { id: 'trans_1', amount: 200, shared: true, updatedAt: '2026-01-02T00:00:00.000Z' },
        { id: 'trans_2', amount: 300, shared: true, updatedAt: '2026-01-03T00:00:00.000Z' }
      ]
    }
  });
  assert.equal(state.transactions.length, 2);
  assert.equal(state.transactions.find(x => x.id === 'trans_1').amount, 200);
  assert.equal(result.updated, 1);
  assert.equal(result.added, 1);
  assert.equal(state.settings.foodBudget, 12000);
  assert.equal(result.settingsUpdated, true);
});

test('family tombstone removes an older local shared record and prevents re-add', () => {
  const state = {
    settings: {}, familyDeleted: [],
    transactions: [], budgetEntries: [], groceries: [{ id: 'groc_1', name: 'Mléko', shared: true, updatedAt: '2026-01-01T00:00:00.000Z' }],
    tasks: [], shopping: [], installments: [], householdPayments: [], gardenItems: [], gardenLogs: []
  };
  mergeFamilySnapshot(state, {
    exportedAt: '2026-01-03T00:00:00.000Z',
    tombstones: [{ collection: 'groceries', id: 'groc_1', deletedAt: '2026-01-02T00:00:00.000Z' }],
    data: { groceries: [{ id: 'groc_1', name: 'Mléko', shared: true, updatedAt: '2026-01-01T00:00:00.000Z' }] }
  });
  assert.equal(state.groceries.length, 0);
});

test('local deletion creates a compact tombstone', () => {
  const state = { familyDeleted: [] };
  assert.equal(recordFamilyDeletion(state, 'tasks', { id: 'task_1', shared: true }, '2026-01-01T00:00:00.000Z'), true);
  assert.deepEqual(state.familyDeleted, [{ collection: 'tasks', id: 'task_1', deletedAt: '2026-01-01T00:00:00.000Z' }]);
});

test('recurring payment advances safely across short months', () => {
  assert.equal(nextPaymentDueDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextPaymentDueDate('2026-11-30', 'quarterly'), '2027-02-28');
  assert.equal(nextPaymentDueDate('2024-02-29', 'yearly'), '2025-02-28');
});
