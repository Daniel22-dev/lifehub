import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');


test('úvodní bezpečnostní panel neduplikuje rychlý úkol ani finance', () => {
  const command = html.match(/<aside class="hero-command"[\s\S]*?<\/aside>/)?.[0] || '';
  assert.ok(command.includes('Trezor a ochrana dat'));
  assert.ok(!command.includes('Přidat dnešní úkol'));
  assert.ok(!command.includes('Otevřít finance'));
});

test('AI výkaz je mobilně lehký a exportuje prémiový dokument s logem školy', () => {
  assert.ok(!html.includes('id="aiReportPreview"'));
  assert.ok(!app.includes('function renderAiReportPreview()'));
  assert.ok(app.includes('SCHOOL_LOGO_DATA_URI'));
  assert.ok(app.includes('Měsíční výkaz činností pedagoga'));
  assert.ok(app.includes('report-donut'));
});

test('měsíční závazky zahrnují i aktivní splátkové kalendáře', () => {
  assert.ok(app.includes('const installmentMonthly='));
  assert.ok(app.includes('const totalMonthlyCommitments=monthlyRecurring+installmentMonthly'));
  assert.ok(app.includes('Účty ${fmt(monthlyRecurring)} + splátky ${fmt(installmentMonthly)}'));
});

test('pořízené zahradní položky jsou oddělené v rozbalovacím archivu', () => {
  assert.ok(html.includes('id="gardenCompletedArchive"'));
  assert.ok(app.includes("const completedItems=state.gardenItems.filter(g=>g.done)"));
  assert.ok(app.includes("completedArchive.hidden=!completedItems.length"));
});

test('rozšířený režim nepoužívá nestabilní mobilní Fullscreen API', () => {
  const functionBody = app.match(/function toggleFullscreen\(\)[\s\S]*?\n    }/)?.[0] || '';
  assert.ok(functionBody.includes("classList.toggle('focus-mode'"));
  assert.ok(!functionBody.includes('requestFullscreen'));
});

test('úhrady účtů mohou automaticky vytvořit propojený výdaj', () => {
  assert.ok(html.includes('id="paymentTrackFinance"'));
  assert.ok(app.includes("source:'payment'"));
  assert.ok(app.includes('function upsertPaymentTransaction'));
  assert.ok(app.includes('additions.forEach(historyEntry=>upsertPaymentTransaction'));
});

test('mzda rozlišuje mzdové období a datum připsání', () => {
  assert.ok(html.includes('id="payPaidDate"'));
  assert.ok(app.includes('function transactionAccountingMonth'));
  assert.ok(app.includes('function cashflowMonthSummary'));
  assert.ok(app.includes('function projectedMonthSummary'));
});


test('smazání a odpojení propojených plateb nenechá osiřelé finanční vazby', () => {
  assert.ok(app.includes('function deleteHouseholdPayment'));
  assert.ok(app.includes('function deleteTransaction'));
  assert.ok(app.includes('delete historyEntry.transactionId'));
  assert.ok(app.includes("t.source==='payment'&&t.paymentId===id"));
});
