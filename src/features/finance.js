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
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}
