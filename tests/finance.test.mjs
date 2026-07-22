import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransactionRecord, summarizeMonthlyFinancialPlan } from '../src/features/finance.js';

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

test('úprava propojeného výdaje zachová vazbu na splátku', () => {
  const existing={id:'trans_3',source:'installment',installmentId:'inst_1',installmentHistoryId:'ipay_1',createdAt:'2026-07-01T10:00:00.000Z'};
  const result=buildTransactionRecord({id:'trans_3',date:'2026-07-14',kind:'expense',category:'splátky',amount:5000,description:'Půjčka'},existing,'2026-07-14T11:00:00.000Z');
  assert.equal(result.source,'installment');
  assert.equal(result.installmentId,'inst_1');
  assert.equal(result.installmentHistoryId,'ipay_1');
});

test('měsíční plán porovná připsanou výplatu se skutečnými i zbývajícími výdaji', () => {
  const summary=summarizeMonthlyFinancialPlan({
    month:'2026-07',
    transactions:[
      {date:'2026-07-10',kind:'income',source:'payroll',amount:40000,payrollMonth:'2026-06'},
      {date:'2026-07-05',kind:'expense',source:'payment',amount:3000},
      {date:'2026-07-06',kind:'expense',source:'installment',amount:5000}
    ],
    budgetEntries:[{date:'2026-07-04',amount:2000}],
    householdPayments:[
      {status:'pending',dueDate:'2026-07-20',amount:1500},
      {status:'pending',dueDate:'2026-08-01',amount:9000}
    ],
    installments:[
      {total:60000,paid:15000,monthly:5000,paymentHistory:[{date:'2026-07-06',type:'regular',amount:5000}]},
      {total:30000,paid:5000,monthly:2500,startMonth:'2026-07',paymentHistory:[]},
      {total:20000,paid:0,monthly:2000,startMonth:'2026-08',paymentHistory:[]}
    ],
    foodBudget:8000,
    fuelBudget:2000
  });
  assert.equal(summary.salaryCredited,40000);
  assert.deepEqual(summary.salaryPeriods,['2026-06']);
  assert.equal(summary.actualSpent,10000);
  assert.equal(summary.pendingPayments,1500);
  assert.equal(summary.pendingInstallments,2500);
  assert.equal(summary.remainingBudget,8000);
  assert.equal(summary.stillPlanned,12000);
  assert.equal(summary.totalExpectedExpenses,22000);
  assert.equal(summary.remainingAfterPlan,18000);
});

test('měsíční plán načte výplatu přímo z pásky, když starší transakce chybí', () => {
  const summary=summarizeMonthlyFinancialPlan({
    month:'2026-07',
    transactions:[],
    payrolls:[{
      id:'payroll_1',
      month:'2026-06',
      paymentDate:'2026-07-10',
      fields:{netPay:38950},
      updatedAt:'2026-07-10T12:00:00.000Z'
    }]
  });
  assert.equal(summary.salaryCredited,38950);
  assert.deepEqual(summary.salaryPeriods,['2026-06']);
});

test('měsíční plán nepočítá stejnou výplatu dvakrát z pásky i transakce', () => {
  const summary=summarizeMonthlyFinancialPlan({
    month:'2026-07',
    payrolls:[{id:'payroll_1',month:'2026-06',paymentDate:'2026-07-10',fields:{netPay:40000}}],
    transactions:[{date:'2026-07-10',kind:'income',source:'payroll',amount:40000,payrollId:'payroll_1',payrollMonth:'2026-06'}]
  });
  assert.equal(summary.salaryCredited,40000);
});


test('úprava výdaje z velkého nákupu zachová vazbu na položku', () => {
  const existing={id:'trans_4',source:'shopping',shoppingId:'shop_1',createdAt:'2026-07-22T09:00:00.000Z'};
  const result=buildTransactionRecord({id:'trans_4',date:'2026-07-22',kind:'expense',category:'domácnost',amount:12500,description:'Sekačka'},existing,'2026-07-22T09:30:00.000Z');
  assert.equal(result.source,'shopping');
  assert.equal(result.shoppingId,'shop_1');
});
