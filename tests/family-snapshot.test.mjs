import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilySnapshot, FAMILY_COLLECTIONS, summarizeFamilySnapshot } from '../src/features/family-snapshot.js';

test('rodinný snapshot zahrne jen povolené sdílené kolekce a vynechá mzdu', () => {
  const state={
    updatedAt:'2026-07-11T10:00:00.000Z',
    settings:{foodBudget:10000,fuelBudget:3000,savingGoal:5000,familySettingsUpdatedAt:'2026-07-10T10:00:00.000Z'},
    transactions:[
      {id:'shared',shared:true,source:'manual',amount:100},
      {id:'private',shared:false,source:'manual',amount:200},
      {id:'salary',shared:true,source:'payroll',amount:30000}
    ],
    tasks:[{id:'task1',shared:true},{id:'task2',shared:false}],
    payrolls:[{id:'payroll1',storedPdf:true}],
    documents:[{id:'doc1'}],
    notes:[{id:'note1'}]
  };
  const snapshot=buildFamilySnapshot({state,version:'4.4.0',ownerId:'member1',ownerName:'Alex',exportedAt:'2026-07-11T12:00:00.000Z'});
  assert.deepEqual(Object.keys(snapshot.data), [...FAMILY_COLLECTIONS]);
  assert.deepEqual(snapshot.data.transactions.map(item=>item.id), ['shared']);
  assert.deepEqual(snapshot.data.tasks.map(item=>item.id), ['task1']);
  assert.equal('payrolls' in snapshot.data, false);
  assert.equal('documents' in snapshot.data, false);
  assert.equal('notes' in snapshot.data, false);
  assert.match(snapshot.note,/pouze ke čtení/i);
});

test('souhrn rodinného snapshotu počítá všechny zahrnuté položky', () => {
  const snapshot={data:{transactions:[{},{}],tasks:[{}],shopping:[{}]}};
  const summary=summarizeFamilySnapshot(snapshot);
  assert.equal(summary.total,4);
  assert.equal(summary.counts.transactions,2);
  assert.equal(summary.counts.gardenLogs,0);
});
