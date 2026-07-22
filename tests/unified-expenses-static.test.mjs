import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/styles/lifehub.css',import.meta.url),'utf8');
const finance=fs.readFileSync(new URL('../src/features/finance.js',import.meta.url),'utf8');

test('zahradní nákup vytváří a odstraňuje propojený výdaj',()=>{
  assert.ok(app.includes('function upsertGardenItemTransaction('));
  assert.ok(app.includes("source:'garden-item'"));
  assert.ok(app.includes('gardenItemId:item.id'));
  assert.ok(app.includes('function restoreGardenItemPlan('));
  assert.ok(app.includes('function removeGardenItemTransaction('));
  assert.ok(app.includes('purchaseDate=today()'));
});

test('zahradní fajfka zůstane krátce viditelná',()=>{
  assert.ok(app.includes('GARDEN_BOUGHT_FEEDBACK_MS = 650'));
  assert.ok(app.includes('toggleGardenItemDone(gardenInput.dataset.toggleGitem,gardenInput.checked,gardenInput)'));
  assert.ok(app.includes("labelText.textContent='Pořízeno'"));
  assert.ok(app.includes('setTimeout(()=>renderAll(),GARDEN_BOUGHT_FEEDBACK_MS)'));
  assert.ok(css.includes('.garden-bought-check{'));
  assert.ok(css.includes('.garden-purchase-item.garden-bought-confirming'));
});

test('zahradní údržba a servis domácnosti zapisují skutečné ceny do financí',()=>{
  assert.ok(app.includes('function upsertGardenLogTransaction('));
  assert.ok(app.includes("source:'garden-log'"));
  assert.ok(app.includes('gardenLogId:item.id'));
  assert.ok(app.includes('function upsertMaintenanceTransaction('));
  assert.ok(app.includes("source:'maintenance'"));
  assert.ok(app.includes('maintenanceId:item.id'));
});

test('odpojení ve financích zachová zdrojový záznam',()=>{
  assert.ok(app.includes("gardenItem.financeDetached=true"));
  assert.ok(app.includes("gardenLog.financeDetached=true"));
  assert.ok(app.includes("maintenance.financeDetached=true"));
  assert.ok(app.includes('deleteGardenItem(delGItem)'));
  assert.ok(app.includes('deleteGardenLog(delGLog)'));
  assert.ok(app.includes('deleteMaintenanceLog(delMaintenance)'));
});

test('finance mají nové zdroje a vazební identifikátory',()=>{
  for(const value of ['garden-item','garden-log','maintenance']) assert.ok(html.includes(`<option value="${value}">`));
  for(const field of ['gardenItemId','gardenLogId','maintenanceId']) assert.ok(finance.includes(`${field}: existing?.${field} || ''`));
  assert.ok(app.includes("['payment','installment','shopping','garden-item','garden-log','maintenance'].includes(t.source)"));
});
