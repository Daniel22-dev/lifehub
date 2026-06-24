export const pad = n => String(n).padStart(2, '0');

export const today = () => new Date().toISOString().slice(0, 10);

export const currentYear = () => new Date().getFullYear();

export const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const uid = (prefix = 'item') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const strip = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
