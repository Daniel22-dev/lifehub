import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');


test('Přehled obsahuje souhrn výplaty proti skutečným i plánovaným výdajům',()=>{
  assert.ok(html.includes('id="dashboardMonthlyFinance"'));
  assert.ok(html.includes('Výplata vs. všechny aktuální a plánované výdaje'));
  assert.ok(app.includes('summarizeMonthlyFinancialPlan'));
  assert.ok(app.includes("kpi('Připsaná výplata'"));
  assert.ok(app.includes("kpi('Ještě plánováno'"));
  assert.ok(app.includes("kpiHtml('Po všech výdajích'"));
});


test('běžná i mimořádná splátka vytváří propojený finanční výdaj',()=>{
  assert.ok(app.includes('function upsertInstallmentTransaction'));
  assert.ok(app.includes("source:'installment'"));
  assert.ok(app.includes('upsertInstallmentTransaction(i,historyEntry)'));
  assert.ok(app.includes('reconcileInstallmentTransactions()'));
  assert.ok(app.includes('deleteInstallment(delInst)'));
  assert.ok(app.includes('historyEntry.financeDetached=true'));
  assert.ok(app.includes('historyEntry.financeDetached===true'));
});
