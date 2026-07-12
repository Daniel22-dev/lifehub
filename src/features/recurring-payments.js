export function nextPaymentDueDate(dateValue, frequency) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  const originalDay = date.getDate();
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1, 1);
  else if (frequency === 'quarterly') date.setMonth(date.getMonth() + 3, 1);
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1, date.getMonth(), 1);
  else return String(dateValue);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
