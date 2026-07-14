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
      transactionExpenses:0,
      budgetSpent:0,
      actualSpent:0,
      pendingPayments:0,
      pendingInstallments:0,
      remainingBudget:0,
      stillPlanned:0,
      totalExpectedExpenses:0,
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

  const linkedPayrollIds = new Set(canonicalPayrolls.map(row=>String(row?.id || '')).filter(Boolean));
  const linkedPayrollPeriods = new Set(canonicalPayrolls.map(row=>String(row?.month || '')).filter(value=>/^\d{4}-\d{2}$/.test(value)));
  const salaryTransactions = transactions.filter(row =>
    row?.kind === 'income' &&
    row?.source === 'payroll' &&
    String(row?.date || '').startsWith(selectedMonth) &&
    !linkedPayrollIds.has(String(row?.payrollId || '')) &&
    !linkedPayrollPeriods.has(String(row?.payrollMonth || ''))
  );
  const salaryCredited = canonicalPayrolls.reduce((sum,row)=>{
    const fields = row?.fields || {};
    return sum + amount(fields.netPay || fields.cleanPay || fields.grossPay);
  },0) + salaryTransactions.reduce((sum,row)=>sum+amount(row?.amount),0);
  const salaryPeriods = [...new Set([
    ...canonicalPayrolls.map(row=>String(row?.month || '')),
    ...salaryTransactions.map(row=>String(row?.payrollMonth || ''))
  ].filter(value=>/^\d{4}-\d{2}$/.test(value)))].sort();

  const transactionExpenses = transactions
    .filter(row => row?.kind === 'expense' && String(row?.date || '').startsWith(selectedMonth))
    .reduce((sum,row)=>sum+amount(row?.amount),0);
  const budgetSpent = budgetEntries
    .filter(row => String(row?.date || '').startsWith(selectedMonth))
    .reduce((sum,row)=>sum+amount(row?.amount),0);
  const actualSpent = transactionExpenses + budgetSpent;

  const pendingPayments = householdPayments
    .filter(row => row?.status !== 'paid' && amount(row?.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(row?.dueDate || '')) && String(row.dueDate) <= end)
    .reduce((sum,row)=>sum+amount(row?.amount),0);

  const pendingInstallments = installments.reduce((sum,installment)=>{
    const startMonth = String(installment?.startMonth || '');
    if(/^\d{4}-\d{2}$/.test(startMonth) && startMonth > selectedMonth) return sum;
    const total = amount(installment?.total);
    const paid = Math.min(total, amount(installment?.paid));
    const remaining = Math.max(0, total-paid);
    const regularPlan = Math.min(remaining, amount(installment?.monthly));
    if(!(regularPlan > 0)) return sum;
    const regularPaidThisMonth = (Array.isArray(installment?.paymentHistory) ? installment.paymentHistory : [])
      .filter(row => row?.type === 'regular' && String(row?.date || '').startsWith(selectedMonth))
      .reduce((subtotal,row)=>subtotal+amount(row?.amount),0);
    return sum + Math.max(0, regularPlan-regularPaidThisMonth);
  },0);

  const plannedBudget = amount(foodBudget) + amount(fuelBudget);
  const remainingBudget = Math.max(0, plannedBudget-budgetSpent);
  const stillPlanned = pendingPayments + pendingInstallments + remainingBudget;
  const totalExpectedExpenses = actualSpent + stillPlanned;

  return {
    month:selectedMonth,
    salaryCredited,
    salaryPeriods,
    transactionExpenses,
    budgetSpent,
    actualSpent,
    pendingPayments,
    pendingInstallments,
    remainingBudget,
    stillPlanned,
    totalExpectedExpenses,
    remainingAfterPlan:salaryCredited-totalExpectedExpenses
  };
}
