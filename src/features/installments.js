function safeAmount(value){
  return Math.max(0, Number(value) || 0);
}

function parseMonth(value){
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if(!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if(!Number.isInteger(year) || month < 1 || month > 12) return null;
  return {year, month, index:year * 12 + (month - 1)};
}

function monthFromIndex(index){
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return {year, month};
}

function pad2(value){
  return String(value).padStart(2, '0');
}

function dueDateForMonth(index, dueDay){
  const {year, month} = monthFromIndex(index);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(lastDay, Math.max(1, Math.round(Number(dueDay) || 1)));
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function calculateRegularInstallmentPayment({total=0, paid=0, monthly=0} = {}) {
  const safeTotal = safeAmount(total);
  const safePaid = Math.min(safeTotal, safeAmount(paid));
  const remaining = Math.max(0, safeTotal - safePaid);
  const requested = safeAmount(monthly);
  const appliedAmount = Math.min(remaining, requested);
  return {
    appliedAmount,
    newPaid: Math.min(safeTotal, safePaid + appliedAmount),
    remainingBefore: remaining,
    remainingAfter: Math.max(0, remaining - appliedAmount),
    completed: remaining > 0 && appliedAmount >= remaining
  };
}

export function calculateDueInstallmentPayments(installment = {}, {today = ''} = {}) {
  const total = safeAmount(installment.total);
  const paid = Math.min(total, safeAmount(installment.paid));
  const monthly = safeAmount(installment.monthly);
  const start = parseMonth(installment.startMonth);
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ''));
  const dueDay = Math.min(31, Math.max(0, Math.round(Number(installment.dueDay) || 0)));

  if(!(total > 0) || !(monthly > 0) || !start || !todayMatch || dueDay < 1 || paid >= total){
    return {entries:[], appliedAmount:0, newPaid:paid, dueInstallments:0, expectedRegularPaid:0, creditedRegularPaid:0};
  }

  const todayMonth = parseMonth(`${todayMatch[1]}-${todayMatch[2]}`);
  if(!todayMonth || todayMonth.index < start.index){
    return {entries:[], appliedAmount:0, newPaid:paid, dueInstallments:0, expectedRegularPaid:0, creditedRegularPaid:0};
  }

  const dueDates = [];
  const maxMonths = Math.min(1200, todayMonth.index - start.index + 1);
  for(let offset = 0; offset < maxMonths; offset++){
    const date = dueDateForMonth(start.index + offset, dueDay);
    if(date <= today) dueDates.push(date);
  }

  const dueInstallments = dueDates.length;
  const extraPaid = (Array.isArray(installment.paymentHistory) ? installment.paymentHistory : [])
    .filter(entry => entry?.type === 'extra')
    .reduce((sum, entry) => sum + safeAmount(entry?.amount), 0);
  const hasBaseline = installment.autoPaidBaseline !== null
    && installment.autoPaidBaseline !== undefined
    && installment.autoPaidBaseline !== ''
    && Number.isFinite(Number(installment.autoPaidBaseline));
  const baseline = hasBaseline ? Math.min(total, safeAmount(installment.autoPaidBaseline)) : 0;
  const extraBaseline = hasBaseline ? Math.min(extraPaid, safeAmount(installment.autoExtraBaseline)) : 0;
  const expectedRegularPaid = Math.min(total, baseline + dueInstallments * monthly);
  const creditedRegularPaid = Math.min(total, Math.max(0, paid - Math.max(0, extraPaid - extraBaseline)));
  let amountToApply = Math.min(Math.max(0, total - paid), Math.max(0, expectedRegularPaid - creditedRegularPaid));

  if(!(amountToApply > 0)){
    return {entries:[], appliedAmount:0, newPaid:paid, dueInstallments, expectedRegularPaid, creditedRegularPaid};
  }

  const entries = [];
  for(let index = 0; index < dueDates.length && amountToApply > 0; index++){
    const slotStart = baseline + index * monthly;
    const slotEnd = Math.min(total, slotStart + monthly);
    const slotSize = Math.max(0, slotEnd - slotStart);
    const covered = Math.min(slotSize, Math.max(0, creditedRegularPaid - slotStart));
    const missing = Math.max(0, slotSize - covered);
    const amount = Math.min(missing, amountToApply);
    if(amount > 0){
      entries.push({date:dueDates[index], amount});
      amountToApply -= amount;
    }
  }

  const appliedAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    entries,
    appliedAmount,
    newPaid:Math.min(total, paid + appliedAmount),
    dueInstallments,
    expectedRegularPaid,
    creditedRegularPaid
  };
}
