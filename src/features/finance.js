import { number, uid } from '../core/utils.js';

export function buildTransactionRecord(input, existing = null, now = new Date().toISOString()){
  return {
    id: input.id || existing?.id || uid('trans'),
    date: String(input.date || ''),
    kind: input.kind === 'expense' ? 'expense' : 'income',
    category: String(input.category || '').trim(),
    amount: Math.max(0, number(input.amount)),
    description: String(input.description || '').trim(),
    source: existing?.source || 'manual',
    payrollId: existing?.payrollId || '',
    payrollMonth: existing?.payrollMonth || '',
    paymentId: existing?.paymentId || '',
    paymentHistoryId: existing?.paymentHistoryId || '',
    installmentId: existing?.installmentId || '',
    installmentHistoryId: existing?.installmentHistoryId || '',
    shoppingId: existing?.shoppingId || '',
    gardenItemId: existing?.gardenItemId || '',
    gardenLogId: existing?.gardenLogId || '',
    maintenanceId: existing?.maintenanceId || '',
    vehicleLogId: existing?.vehicleLogId || '',
    paidBy: input.kind === 'expense' ? (input.paidBy === 'wife' ? 'wife' : 'me') : '',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function amount(value){
  return Math.max(0, Number(value) || 0);
}

function monthEnd(month){
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if(!match) return '';
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2,'0')}`;
}

/**
 * Creates the dashboard comparison "salary credited this month vs. all actual
 * and still expected expenses". Budget entries are stored outside the general
 * transaction ledger, so they are intentionally added separately.
 */
export function summarizeMonthlyFinancialPlan({
  month,
  transactions = [],
  payrolls = [],
  budgetEntries = [],
  householdPayments = [],
  installments = [],
  foodBudget = 0,
  fuelBudget = 0
} = {}){
  const selectedMonth = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : '';
  const end = monthEnd(selectedMonth);
  if(!selectedMonth || !end){
    return {
      month:selectedMonth,
      salaryCredited:0,
      salaryPeriods:[],
      payrollsMissingNetPay:0,
      transactionExpenses:0,myTransactionExpenses:0,wifeTransactionExpenses:0,
      budgetSpent:0,myBudgetSpent:0,wifeBudgetSpent:0,
      actualSpent:0,myActualSpent:0,wifeActualSpent:0,
      pendingPayments:0,myPendingPayments:0,wifePendingPayments:0,
      pendingInstallments:0,myPendingInstallments:0,wifePendingInstallments:0,
      remainingBudget:0,stillPlanned:0,myStillPlanned:0,wifeStillPlanned:0,
      totalExpectedExpenses:0,myTotalExpectedExpenses:0,wifeTotalExpectedExpenses:0,
      remainingAfterPlan:0
    };
  }

  // Výplatní páska je hlavní zdroj pravdy. Starší verze LifeHubu někdy
  // obsahovaly pásku a datum připsání, ale chyběla jim odpovídající položka
  // v transakcích. Přehled proto umí mzdu načíst přímo z pásky a transakce
  // používá jen jako doplněk pro osiřelé/starší záznamy.
  const payrollRows = payrolls
    .filter(row => String(row?.paymentDate || '').startsWith(selectedMonth))
    .sort((a,b)=>String(b?.updatedAt || b?.createdAt || '').localeCompare(String(a?.updatedAt || a?.createdAt || '')));
  const canonicalPayrolls = [];
  const seenPayrollPeriods = new Set();
  for(const row of payrollRows){
    const period = String(row?.month || '');
    const dedupeKey = /^\d{4}-\d{2}$/.test(period) ? period : String(row?.id || '');
    if(dedupeKey && seenPayrollPeriods.has(dedupeKey)) continue;
    if(dedupeKey) seenPayrollPeriods.add(dedupeKey);
    canonicalPayrolls.push(row);
  }

  const payrollCreditedAmount = row => amount(row?.fields?.netPay || row?.fields?.cleanPay);
  const creditedPayrolls = canonicalPayrolls.filter(row => payrollCreditedAmount(row) > 0);
  const payrollsMissingNetPay = canonicalPayrolls.length - creditedPayrolls.length;
  const linkedPayrollIds = new Set(creditedPayrolls.map(row=>String(row?.id || '')).filter(Boolean));
  const linkedPayrollPeriods = new Set(creditedPayrolls.map(row=>String(row?.month || '')).filter(value=>/^\d{4}-\d{2}$/.test(value)));
  const grossOnlyById = new Map(canonicalPayrolls
    .filter(row=>payrollCreditedAmount(row)===0 && amount(row?.fields?.grossPay)>0)
    .map(row=>[String(row?.id||''),amount(row?.fields?.grossPay)]));
  const grossOnlyByPeriod = new Map(canonicalPayrolls
    .filter(row=>payrollCreditedAmount(row)===0 && amount(row?.fields?.grossPay)>0 && /^\d{4}-\d{2}$/.test(String(row?.month||'')))
    .map(row=>[String(row.month),amount(row?.fields?.grossPay)]));
  const salaryTransactions = transactions.filter(row => {
    if(row?.kind !== 'income' || row?.source !== 'payroll' || !String(row?.date || '').startsWith(selectedMonth)) return false;
    if(linkedPayrollIds.has(String(row?.payrollId || '')) || linkedPayrollPeriods.has(String(row?.payrollMonth || ''))) return false;
    const suspectGross = grossOnlyById.get(String(row?.payrollId || '')) || grossOnlyByPeriod.get(String(row?.payrollMonth || ''));
    if(suspectGross > 0 && Math.abs(amount(row?.amount)-suspectGross) < 0.01) return false;
    return true;
  });
  const salaryCredited = creditedPayrolls.reduce((sum,row)=>sum+payrollCreditedAmount(row),0)
    + salaryTransactions.reduce((sum,row)=>sum+amount(row?.amount),0);
  const salaryPeriods = [...new Set([
    ...creditedPayrolls.map(row=>String(row?.month || '')),
    ...salaryTransactions.map(row=>String(row?.payrollMonth || ''))
  ].filter(value=>/^\d{4}-\d{2}$/.test(value)))].sort();

  const expenseRows = transactions.filter(row => row?.kind === 'expense' && String(row?.date || '').startsWith(selectedMonth));
  const transactionExpenses = expenseRows.reduce((sum,row)=>sum+amount(row?.amount),0);
  const myTransactionExpenses = expenseRows.filter(row=>row?.paidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const wifeTransactionExpenses = expenseRows.filter(row=>row?.paidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const budgetRows = budgetEntries.filter(row => String(row?.date || '').startsWith(selectedMonth));
  const budgetSpent = budgetRows.reduce((sum,row)=>sum+amount(row?.amount),0);
  const myBudgetSpent = budgetRows.filter(row=>row?.paidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const wifeBudgetSpent = budgetRows.filter(row=>row?.paidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const actualSpent = transactionExpenses + budgetSpent;
  const myActualSpent = myTransactionExpenses + myBudgetSpent;
  const wifeActualSpent = wifeTransactionExpenses + wifeBudgetSpent;

  const pendingPaymentRows = householdPayments
    .filter(row => row?.status !== 'paid' && amount(row?.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(row?.dueDate || '')) && String(row.dueDate) <= end);
  const pendingPayments = pendingPaymentRows.reduce((sum,row)=>sum+amount(row?.amount),0);
  const myPendingPayments = pendingPaymentRows.filter(row=>row?.defaultPaidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const wifePendingPayments = pendingPaymentRows.filter(row=>row?.defaultPaidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0);

  const pendingInstallmentTotals = installments.reduce((totals,installment)=>{
    const startMonth = String(installment?.startMonth || '');
    if(/^\d{4}-\d{2}$/.test(startMonth) && startMonth > selectedMonth) return totals;
    const total = amount(installment?.total);
    const paid = Math.min(total, amount(installment?.paid));
    const remaining = Math.max(0, total-paid);
    const regularPlan = Math.min(remaining, amount(installment?.monthly));
    if(!(regularPlan > 0)) return totals;
    const regularPaidThisMonth = (Array.isArray(installment?.paymentHistory) ? installment.paymentHistory : [])
      .filter(row => row?.type === 'regular' && String(row?.date || '').startsWith(selectedMonth))
      .reduce((subtotal,row)=>subtotal+amount(row?.amount),0);
    const pending = Math.max(0, regularPlan-regularPaidThisMonth);
    totals.total += pending;
    if(installment?.defaultPaidBy==='wife') totals.wife += pending;
    else totals.me += pending;
    return totals;
  },{total:0,me:0,wife:0});
  const pendingInstallments = pendingInstallmentTotals.total;
  const myPendingInstallments = pendingInstallmentTotals.me;
  const wifePendingInstallments = pendingInstallmentTotals.wife;

  const plannedBudget = amount(foodBudget) + amount(fuelBudget);
  const remainingBudget = Math.max(0, plannedBudget-budgetSpent);
  const stillPlanned = pendingPayments + pendingInstallments + remainingBudget;
  const myStillPlanned = myPendingPayments + myPendingInstallments + remainingBudget;
  const wifeStillPlanned = wifePendingPayments + wifePendingInstallments;
  const totalExpectedExpenses = actualSpent + stillPlanned;
  const myTotalExpectedExpenses = myActualSpent + myStillPlanned;
  const wifeTotalExpectedExpenses = wifeActualSpent + wifeStillPlanned;

  return {
    month:selectedMonth,
    salaryCredited,
    salaryPeriods,
    payrollsMissingNetPay,
    transactionExpenses,
    myTransactionExpenses,
    wifeTransactionExpenses,
    budgetSpent,
    myBudgetSpent,
    wifeBudgetSpent,
    actualSpent,
    myActualSpent,
    wifeActualSpent,
    pendingPayments,
    myPendingPayments,
    wifePendingPayments,
    pendingInstallments,
    myPendingInstallments,
    wifePendingInstallments,
    remainingBudget,
    stillPlanned,
    myStillPlanned,
    wifeStillPlanned,
    totalExpectedExpenses,
    myTotalExpectedExpenses,
    wifeTotalExpectedExpenses,
    remainingAfterPlan:salaryCredited-myTotalExpectedExpenses
  };
}


function isoDate(value){
  const text=String(value||'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:'';
}

function normalizeLabel(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}

/**
 * Returns true only for a real salary income. The exact "plat" check is
 * intentional: a category such as "platba" must never open a salary cycle.
 */
export function isSalaryIncome(row){
  if(row?.kind!=='income') return false;
  if(row?.source==='payroll') return true;
  const category=normalizeLabel(row?.category);
  const words=category.split(/[^a-z0-9]+/).filter(Boolean);
  const explicitPayout=category==='vyplata' || category==='cista vyplata' || category.startsWith('vyplata za ');
  return words.includes('mzda') || words.includes('plat') || explicitPayout || category==='salary';
}

/**
 * Summarises the currently active salary-backed calendar period. As soon as a
 * new salary is recorded, all expenses from the first day of its receipt month
 * are recalculated against it. Until then, the previous salary period remains
 * active and can temporarily include the first days of the following month.
 */
export function summarizeSalaryCycle({transactions=[],budgetEntries=[],asOf}={}){
  const end=isoDate(asOf)||new Date().toISOString().slice(0,10);
  const salaryRows=transactions
    .filter(row=>isSalaryIncome(row) && amount(row?.amount)>0 && isoDate(row?.date) && isoDate(row.date)<=end)
    .sort((a,b)=>isoDate(b.date).localeCompare(isoDate(a.date)) || String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  if(!salaryRows.length){
    return {startDate:'',salaryDate:'',endDate:end,salaryAmount:0,otherIncome:0,totalIncome:0,myTransactionExpenses:0,wifeTransactionExpenses:0,myBudgetExpenses:0,wifeBudgetExpenses:0,myExpenses:0,wifeExpenses:0,householdExpenses:0,balance:0,transactionCount:0,budgetCount:0};
  }
  const salaryDate=isoDate(salaryRows[0].date);
  const startDate=`${salaryDate.slice(0,7)}-01`;
  const inCycle=row=>{
    const date=isoDate(row?.date);
    return !!date && date>=startDate && date<=end;
  };
  const cycleTransactions=transactions.filter(inCycle);
  const cycleBudgets=budgetEntries.filter(inCycle);
  const salaries=cycleTransactions.filter(isSalaryIncome);
  const otherIncomeRows=cycleTransactions.filter(row=>row?.kind==='income'&&!isSalaryIncome(row));
  const expenseRows=cycleTransactions.filter(row=>row?.kind==='expense');
  const salaryAmount=salaries.reduce((sum,row)=>sum+amount(row?.amount),0);
  const otherIncome=otherIncomeRows.reduce((sum,row)=>sum+amount(row?.amount),0);
  const myTransactionExpenses=expenseRows.filter(row=>row?.paidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const wifeTransactionExpenses=expenseRows.filter(row=>row?.paidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const myBudgetExpenses=cycleBudgets.filter(row=>row?.paidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const wifeBudgetExpenses=cycleBudgets.filter(row=>row?.paidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
  const myExpenses=myTransactionExpenses+myBudgetExpenses;
  const wifeExpenses=wifeTransactionExpenses+wifeBudgetExpenses;
  const totalIncome=salaryAmount+otherIncome;
  return {
    startDate,salaryDate,endDate:end,salaryAmount,otherIncome,totalIncome,
    myTransactionExpenses,wifeTransactionExpenses,myBudgetExpenses,wifeBudgetExpenses,
    myExpenses,wifeExpenses,householdExpenses:myExpenses+wifeExpenses,
    balance:totalIncome-myExpenses,
    transactionCount:cycleTransactions.length,budgetCount:cycleBudgets.length
  };
}

/**
 * Builds twelve cash-flow buckets from actual receipt/payment dates. Food and
 * fuel entries live outside the transaction ledger, therefore they are merged
 * into the expense totals here.
 */
export function buildAnnualCashflowData({year,transactions=[],budgetEntries=[]}={}){
  const numericYear=Math.max(2000,Math.min(2100,Math.round(Number(year)||new Date().getFullYear())));
  return Array.from({length:12},(_,index)=>{
    const month=`${numericYear}-${String(index+1).padStart(2,'0')}`;
    const rows=transactions.filter(row=>isoDate(row?.date).startsWith(month));
    const budgets=budgetEntries.filter(row=>isoDate(row?.date).startsWith(month));
    const income=rows.filter(row=>row?.kind==='income').reduce((sum,row)=>sum+amount(row?.amount),0);
    const expenseRows=rows.filter(row=>row?.kind==='expense');
    const myExpense=expenseRows.filter(row=>row?.paidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0)
      + budgets.filter(row=>row?.paidBy!=='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
    const wifeExpense=expenseRows.filter(row=>row?.paidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0)
      + budgets.filter(row=>row?.paidBy==='wife').reduce((sum,row)=>sum+amount(row?.amount),0);
    return {month,income,myExpense,wifeExpense,householdExpense:myExpense+wifeExpense,balance:income-myExpense,transactionCount:rows.length,budgetCount:budgets.length};
  });
}
