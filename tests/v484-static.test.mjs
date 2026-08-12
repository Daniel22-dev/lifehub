import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');


test('Přehled obsahuje kalendářní období aktuální přijaté výplaty',()=>{
  assert.ok(html.includes('id="dashboardMonthlyFinance"'));
  assert.ok(html.includes('Z poslední výplaty zbývá'));
  assert.ok(app.includes('summarizeSalaryCycle'));
  assert.ok(app.includes('Kalendářní období aktuální výplaty'));
  assert.ok(app.includes('výdaje se po jejím načtení přepočítají od 1. dne měsíce'));
  assert.ok(app.includes('Dokud není načtena nová výplata, pokračuje předchozí období'));
  assert.ok(app.includes('Přijatá výplata'));
  assert.ok(app.includes('Další příjmy'));
  assert.ok(app.includes('Zaplatil jsem'));
  assert.ok(app.includes('Zaplatila manželka'));
  assert.ok(app.includes('Jídlo a benzín jsou zahrnuty'));
});


test('roční graf srozumitelně popisuje skutečné příjmy, výdaje a bilanci',()=>{
  assert.ok(html.includes('id="annualFinanceTitle"'));
  assert.ok(html.includes('id="annualFinanceNote"'));
  assert.ok(app.includes('Výplata patří do měsíce, kdy byla skutečně připsána.'));
  assert.ok(app.includes("'Skutečné příjmy, moje výdaje a bilance'"));
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
