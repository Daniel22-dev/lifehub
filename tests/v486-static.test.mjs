import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarizeMonthlyFinancialPlan } from '../src/features/finance.js';

const app = fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');
const constants = fs.readFileSync(new URL('../src/config/constants.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/lifehub.css', import.meta.url), 'utf8');

// Kritická migrace staršího plaintextu.
test('merge je definovaná a používá ochranu proti zakázaným klíčům', () => {
  assert.ok(app.includes('function merge(base, patch)'));
  assert.ok(app.includes('FORBIDDEN_IMPORT_KEYS.has(key)'));
  assert.ok([...app.matchAll(/\bmerge\s*\(/g)].length >= 2);
});

test('loadLegacyState nepolyká chybu návratem prázdného stavu', () => {
  const start = app.indexOf('function loadLegacyState()');
  const end = app.indexOf('function hasEncryptedState', start);
  const body = app.slice(start, end);
  assert.ok(start > -1 && end > start);
  assert.equal(/catch\s*\([^)]*\)\s*\{\s*return\s+defaultState\(\)/.test(body), false);
  assert.ok(body.includes('throw new Error'));
  assert.ok(body.includes('return null'));
});

test('migrace kontroluje načtený stav před zápisem šifrovaného trezoru', () => {
  const load = app.indexOf('migratedState = loadLegacyState()');
  const guard = app.indexOf('if(!migratedState) throw new Error', load);
  const persist = app.indexOf('await persistEncryptedState();', load);
  assert.ok(load > -1 && guard > load && persist > guard);
});

// Velikost vlastního trezoru versus cizího importu.
test('osm megabajtů omezuje pouze cizí import', () => {
  assert.ok(constants.includes('MAX_IMPORT_STATE_BYTES = 8 * 1024 * 1024'));
  assert.ok(app.includes('function sanitizeImportedState(input, { preserveStoredFiles = false, trusted = false } = {})'));
  assert.ok(app.includes('if(!trusted)'));
  assert.ok(app.includes('approxSize > MAX_IMPORT_STATE_BYTES'));
  assert.equal(app.includes('approxSize > 8 * 1024 * 1024'), false);
});

test('obě odemykací cesty a legacy migrace označují vlastní stav jako trusted', () => {
  assert.ok(app.includes('state=sanitizeImportedState(plain,{preserveStoredFiles:true,trusted:true})'));
  assert.ok(app.includes('state = sanitizeImportedState(plain, { preserveStoredFiles: true, trusted: true })'));
  assert.ok(app.includes('sanitizeImportedState(migratedState, { preserveStoredFiles: true, trusted: true })'));
});

test('cizí záloha nezískává trusted režim', () => {
  assert.ok(app.includes('sanitizeImportedState(data.state)'));
  assert.equal(app.includes('sanitizeImportedState(data.state, { trusted: true })'), false);
  assert.equal(app.includes('sanitizeImportedState(rawState, { trusted: true })'), false);
});

// CSP a měsíční výkaz.
test('výkaz používá datové atributy a CSSOM místo závislosti na inline style atributu', () => {
  assert.ok(app.includes('function cssVar(name, value)'));
  assert.ok(app.includes('function applyCssVars(root)'));
  assert.ok(app.includes('el.style.setProperty(name, value)'));
  assert.ok(app.includes('applyCssVars(box);'));
  assert.ok(app.includes('cssVar("--report-donut",donut)'));
  assert.ok(app.includes('cssVar("--legend-color",group.color)'));
  assert.ok(app.includes('cssVar("--row-color",color)'));
  assert.equal(app.includes('style="--report-donut:${donut}"'), false);
});

test('CSS proměnné výkazu mají bezpečné fallbacky v aplikaci i exportovaném dokumentu', () => {
  for (const expected of [
    'var(--row-color,#082e67)',
    'var(--legend-color,#64748b)',
    'var(--report-donut,conic-gradient(#dce5f2 0 100%))'
  ]) {
    assert.ok(css.includes(expected), `chybí v hlavním CSS: ${expected}`);
    assert.ok(app.includes(expected), `chybí v exportním CSS: ${expected}`);
  }
});

// Mzdová logika.
test('hrubá mzda bez čisté částky se nevydává za připsanou výplatu', () => {
  const result = summarizeMonthlyFinancialPlan({
    month: '2026-07',
    payrolls: [{ id:'p1', month:'2026-06', paymentDate:'2026-07-10', fields:{ grossPay:62000 } }]
  });
  assert.equal(result.salaryCredited, 0);
  assert.equal(result.payrollsMissingNetPay, 1);
});

test('čistá mzda se započte jednou i s propojenou transakcí', () => {
  const result = summarizeMonthlyFinancialPlan({
    month: '2026-07',
    payrolls: [{ id:'p1', month:'2026-06', paymentDate:'2026-07-10', fields:{ netPay:43210, grossPay:62000 } }],
    transactions: [{ id:'t1', date:'2026-07-10', kind:'income', source:'payroll', payrollId:'p1', payrollMonth:'2026-06', amount:43210 }]
  });
  assert.equal(result.salaryCredited, 43210);
  assert.equal(result.payrollsMissingNetPay, 0);
});

test('cleanPay je platný zdroj připsané mzdy', () => {
  const result = summarizeMonthlyFinancialPlan({
    month: '2026-07',
    payrolls: [{ id:'p1', month:'2026-06', paymentDate:'2026-07-10', fields:{ cleanPay:41000, grossPay:62000 } }]
  });
  assert.equal(result.salaryCredited, 41000);
});

test('stará propojená transakce přesně ve výši hrubé mzdy se ignoruje', () => {
  const result = summarizeMonthlyFinancialPlan({
    month: '2026-07',
    payrolls: [{ id:'p1', month:'2026-06', paymentDate:'2026-07-10', fields:{ grossPay:62000 } }],
    transactions: [{ id:'t1', date:'2026-07-10', kind:'income', source:'payroll', payrollId:'p1', payrollMonth:'2026-06', amount:62000 }]
  });
  assert.equal(result.salaryCredited, 0);
});

test('ručně opravená propojená částka zůstane použitelná, i když na pásce chybí čistá mzda', () => {
  const result = summarizeMonthlyFinancialPlan({
    month: '2026-07',
    payrolls: [{ id:'p1', month:'2026-06', paymentDate:'2026-07-10', fields:{ grossPay:62000 } }],
    transactions: [{ id:'t1', date:'2026-07-10', kind:'income', source:'payroll', payrollId:'p1', payrollMonth:'2026-06', amount:43210 }]
  });
  assert.equal(result.salaryCredited, 43210);
});

test('vytváření a odhady mzdových příjmů nepoužívají grossPay jako fallback', () => {
  const start = app.indexOf('function payrollIncomeAmount(payroll)');
  const end = app.indexOf('function payrollTransactionDescription', start);
  const helper = app.slice(start, end);
  assert.ok(helper.includes('fields.netPay||fields.cleanPay'));
  assert.equal(helper.includes('grossPay'), false);
  assert.ok(app.includes('removedGrossFallbacks'));
  assert.ok(app.includes('payrollAccountAmount(p)>0'));
});

// Service worker.
test('instalace service workeru odděluje kritické a volitelné soubory', () => {
  assert.ok(sw.includes("const critical = ['./', './index.html']"));
  assert.ok(sw.includes('await cache.addAll(critical)'));
  assert.ok(sw.includes('Promise.allSettled'));
});

test('navigace má timeout a jediný cache lookup indexu', () => {
  assert.ok(sw.includes('NAVIGATE_TIMEOUT_MS = 3000'));
  assert.ok(sw.includes('Promise.race'));
  assert.equal((sw.match(/caches\.match\('\.\/index\.html'\)/g) || []).length, 1);
});

// Úklid a prevence návratu mrtvého kódu.
test('mrtvý modul family-sync a nepoužívané pomocné funkce byly odstraněny', () => {
  assert.equal(fs.existsSync(new URL('../src/features/family-sync.js', import.meta.url)), false);
  for (const name of ['function idbHasRecord', 'function sumByMonth', 'function familyCountText', 'const fmt2 =']) {
    assert.equal(app.includes(name), false, `${name} se nemá vrátit`);
  }
});
