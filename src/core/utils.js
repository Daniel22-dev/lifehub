export const pad = n => String(n).padStart(2, '0');

export const localDateParts = (date = new Date()) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate()
});

export const today = (date = new Date()) => {
  const { year, month, day } = localDateParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
};

export const currentYear = (date = new Date()) => date.getFullYear();

export const monthNow = (date = new Date()) => {
  const { year, month } = localDateParts(date);
  return `${year}-${pad(month)}`;
};

export const uid = (prefix = 'item') => {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16)
    || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
};

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const strip = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

export const attr = esc;

export const safeId = (value, prefix = 'item') => /^[A-Za-z0-9_-]{1,80}$/.test(String(value || '')) ? String(value) : uid(prefix);

export const safeUrl = value => {
  const v = String(value || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch (error) {
    return '';
  }
};

export const safeCsvCell = value => {
  const s = String(value ?? '');
  return /^[=+\-@]/.test(s.trimStart()) ? `'${s}` : s;
};

export const number = value => Number(String(value || '').replace(/\s/g, '').replace(',', '.')) || 0;

export const sanitizeCurrency = value => {
  const c = String(value || '').trim();
  return /^[A-Za-zÀ-ž$€£¥₿₽₩₹čČřŘšŠžŽůŮěĚáÁíÍéÉýÝóÓúÚ .,-]{1,12}$/.test(c) ? c : 'Kč';
};
