export function calculateRegularInstallmentPayment({total=0, paid=0, monthly=0} = {}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePaid = Math.min(safeTotal, Math.max(0, Number(paid) || 0));
  const remaining = Math.max(0, safeTotal - safePaid);
  const requested = Math.max(0, Number(monthly) || 0);
  const appliedAmount = Math.min(remaining, requested);
  return {
    appliedAmount,
    newPaid: Math.min(safeTotal, safePaid + appliedAmount),
    remainingBefore: remaining,
    remainingAfter: Math.max(0, remaining - appliedAmount),
    completed: remaining > 0 && appliedAmount >= remaining
  };
}
