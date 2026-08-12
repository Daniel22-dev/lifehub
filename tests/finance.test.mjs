import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnualCashflowData, buildTransactionRecord, isSalaryIncome, summarizeMonthlyFinancialPlan, summarizeSalaryCycle } from '../src/features/finance.js';

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

test('výdaj zaplacený manželkou zůstane nákladem domácnosti, ale nesníží můj zůstatek', () => {
  const summary=summarizeMonthlyFinancialPlan({
    month:'2026-07',
    transactions:[
      {date:'2026-07-10',kind:'income',source:'payroll',amount:40000,payrollMonth:'2026-06'},
      {date:'2026-07-12',kind:'expense',source:'maintenance',amount:2700,paidBy:'wife'},
      {date:'2026-07-14',kind:'expense',source:'payment',amount:3000,paidBy:'me'}
    ]
  });
  assert.equal(summary.myActualSpent,3000);
  assert.equal(summary.wifeActualSpent,2700);
  assert.equal(summary.actualSpent,5700);
  assert.equal(summary.totalExpectedExpenses,5700);
  assert.equal(summary.myTotalExpectedExpenses,3000);
  assert.equal(summary.remainingAfterPlan,37000);
});

test('nový výdaj si ukládá plátce a starší výdaj bezpečně připadne mně', () => {
  const wife=buildTransactionRecord({date:'2026-07-12',kind:'expense',category:'servis',amount:2700,description:'Servis kotle',paidBy:'wife'});
  const legacy=buildTransactionRecord({date:'2026-07-13',kind:'expense',category:'dům',amount:500,description:'Materiál'});
  const income=buildTransactionRecord({date:'2026-07-10',kind:'income',category:'mzda',amount:40000,paidBy:'wife'});
  assert.equal(wife.paidBy,'wife');
  assert.equal(legacy.paidBy,'me');
  assert.equal(income.paidBy,'');
});


test('úprava výdaje z velkého nákupu zachová vazbu na položku', () => {
  const existing={id:'trans_4',source:'shopping',shoppingId:'shop_1',createdAt:'2026-07-22T09:00:00.000Z'};
  const result=buildTransactionRecord({id:'trans_4',date:'2026-07-22',kind:'expense',category:'domácnost',amount:12500,description:'Sekačka'},existing,'2026-07-22T09:30:00.000Z');
  assert.equal(result.source,'shopping');
  assert.equal(result.shoppingId,'shop_1');
});


test('úprava propojeného výdaje z Moje Fabia zachová vazbu na servisní událost', () => {
  const existing={id:'trans_vehicle',source:'vehicle',vehicleLogId:'vehicle_1',createdAt:'2026-07-30T08:00:00.000Z'};
  const result=buildTransactionRecord({id:'trans_vehicle',date:'2026-07-29',kind:'expense',category:'auto – servis a opravy',amount:2450,description:'Oprava EGR ventilu',paidBy:'me'},existing,'2026-07-30T09:00:00.000Z');
  assert.equal(result.source,'vehicle');
  assert.equal(result.vehicleLogId,'vehicle_1');
  assert.equal(result.amount,2450);
});

test('aktivní finanční období po načtení výplaty začíná prvním dnem jejího kalendářního měsíce', () => {
  const summary=summarizeSalaryCycle({
    asOf:'2026-08-15',
    transactions:[
      {id:'old-salary',date:'2026-06-30',kind:'income',source:'payroll',category:'mzda',amount:38000},
      {id:'before',date:'2026-07-29',kind:'expense',amount:9000,paidBy:'me'},
      {id:'salary',date:'2026-07-31',kind:'income',source:'payroll',category:'mzda',amount:40000},
      {id:'bonus',date:'2026-08-04',kind:'income',source:'manual',category:'odměna',amount:1200},
      {id:'mine',date:'2026-08-05',kind:'expense',amount:6500,paidBy:'me'},
      {id:'wife',date:'2026-08-06',kind:'expense',amount:2100,paidBy:'wife'}
    ],
    budgetEntries:[
      {date:'2026-08-07',kind:'food',amount:1800,paidBy:'me'},
      {date:'2026-08-08',kind:'fuel',amount:900,paidBy:'wife'}
    ]
  });
  assert.equal(summary.startDate,'2026-07-01');
  assert.equal(summary.salaryDate,'2026-07-31');
  assert.equal(summary.myExpenses,17300);
  assert.equal(summary.salaryAmount,40000);
  assert.equal(summary.otherIncome,1200);
  assert.equal(summary.wifeExpenses,3000);
  assert.equal(summary.balance,23900);
});

test('nová výplata přijatá 11. dne převezme všechny výdaje od prvního dne měsíce', () => {
  const before=summarizeSalaryCycle({
    asOf:'2026-08-10',
    transactions:[
      {date:'2026-07-10',kind:'income',source:'payroll',category:'mzda',amount:40000},
      {date:'2026-08-03',kind:'expense',amount:5000,paidBy:'me'}
    ]
  });
  assert.equal(before.startDate,'2026-07-01');
  assert.equal(before.balance,35000);

  const after=summarizeSalaryCycle({
    asOf:'2026-08-12',
    transactions:[
      {date:'2026-07-10',kind:'income',source:'payroll',category:'mzda',amount:40000},
      {date:'2026-08-03',kind:'expense',amount:5000,paidBy:'me'},
      {date:'2026-08-11',kind:'income',source:'payroll',category:'mzda',amount:42000},
      {date:'2026-08-12',kind:'expense',amount:2000,paidBy:'me'}
    ]
  });
  assert.equal(after.startDate,'2026-08-01');
  assert.equal(after.salaryDate,'2026-08-11');
  assert.equal(after.salaryAmount,42000);
  assert.equal(after.myExpenses,7000);
  assert.equal(after.balance,35000);
});

test('nesouvisející platba ani výplata pojistky neotevřou mzdový cyklus', () => {
  assert.equal(isSalaryIncome({kind:'income',source:'manual',category:'platba od klienta'}),false);
  assert.equal(isSalaryIncome({kind:'income',source:'manual',category:'výplata pojistky'}),false);
  assert.equal(isSalaryIncome({kind:'income',source:'manual',category:'výplata'}),true);
  assert.equal(isSalaryIncome({kind:'income',source:'manual',category:'výplata za červenec'}),true);
});

test('ruční příjem čistá mzda nebo základní plat otevře výplatní cyklus', () => {
  assert.equal(isSalaryIncome({kind:'income',source:'manual',category:'čistá mzda'}),true);
  assert.equal(isSalaryIncome({kind:'income',source:'manual',category:'základní plat'}),true);
});


test('nulová mzdová položka nepřepíše poslední skutečně přijatou výplatu', () => {
  const summary=summarizeSalaryCycle({
    asOf:'2026-08-20',
    transactions:[
      {date:'2026-08-10',kind:'income',source:'payroll',category:'mzda',amount:40000},
      {date:'2026-08-15',kind:'income',source:'manual',category:'mzda',amount:0},
      {date:'2026-08-16',kind:'expense',paidBy:'me',amount:5000}
    ]
  });
  assert.equal(summary.startDate,'2026-08-01');
  assert.equal(summary.salaryDate,'2026-08-10');
  assert.equal(summary.balance,35000);
});

test('roční cashflow používá skutečná data a zahrnuje jídlo i benzín', () => {
  const rows=buildAnnualCashflowData({
    year:2026,
    transactions:[
      {date:'2026-07-31',kind:'income',source:'payroll',payrollMonth:'2026-06',amount:40000},
      {date:'2026-08-02',kind:'expense',amount:3000,paidBy:'me'},
      {date:'2026-08-03',kind:'expense',amount:1500,paidBy:'wife'}
    ],
    budgetEntries:[
      {date:'2026-08-04',kind:'food',amount:1200,paidBy:'me'},
      {date:'2026-08-05',kind:'fuel',amount:700,paidBy:'wife'}
    ]
  });
  assert.equal(rows[6].income,40000);
  assert.equal(rows[7].income,0);
  assert.equal(rows[7].myExpense,4200);
  assert.equal(rows[7].wifeExpense,2200);
  assert.equal(rows[7].householdExpense,6400);
});
