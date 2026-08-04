import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/styles/lifehub.css',import.meta.url),'utf8');
const integrity=fs.readFileSync(new URL('../src/core/state-integrity.js',import.meta.url),'utf8');


test('Moje Fabia je samostatná záložka se čtyřmi schválenými typy událostí',()=>{
  assert.ok(html.includes('data-tab="vehicle"'));
  assert.ok(html.includes('id="vehicle"'));
  assert.ok(html.includes('Škoda Fabia I'));
  assert.ok(html.includes('1.2 HTP'));
  assert.ok(html.includes('2004/2005'));
  const select=html.match(/<select id="vehicleType">([\s\S]*?)<\/select>/)?.[1]||'';
  const options=[...select.matchAll(/<option value="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(options,['service','repair','inspection','other']);
});

test('formulář Fabie obsahuje datum, tachometr, cenu, plátce, poznámku a finanční přepínač',()=>{
  for(const id of ['vehicleDate','vehicleOdometer','vehicleDescription','vehiclePrice','vehiclePaidBy','vehicleNote','vehicleTrackFinance']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('id="vehicleTrackFinance" type="checkbox" checked'));
});

test('záznam Fabie vytváří jediný propojený výdaj a umí jej odpojit',()=>{
  assert.ok(app.includes('function upsertVehicleTransaction('));
  assert.ok(app.includes("source:'vehicle'"));
  assert.ok(app.includes('vehicleLogId:item.id'));
  assert.ok(app.includes("['payroll','vehicle'].includes(transaction.source)"));
  assert.ok(app.includes("category:'auto – servis a opravy'"));
  assert.ok(app.includes('function removeVehicleTransaction('));
  assert.ok(app.includes("linkedById?.source==='vehicle'&&linkedById.vehicleLogId===item.id"));
  assert.ok(app.includes("t.source==='vehicle'&&(t.vehicleLogId===item.id||(item.transactionId&&t.id===item.transactionId))"));
  assert.ok(app.includes('function reconcileVehicleTransactions('));
  assert.ok(app.includes('financeDetached=true'));
});

test('historie Fabie má hledání, filtry, statistiky a export',()=>{
  for(const id of ['vehicleKpis','vehicleCurrentOdometer','vehicleSearch','vehicleTypeFilter','vehicleYearFilter','vehicleList']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('data-action="export-vehicle-csv"'));
  assert.ok(app.includes('function renderVehicle()'));
  assert.ok(app.includes('function vehicleMarkdown()'));
  assert.ok(css.includes('.vehicle-profile-card'));
});

test('schéma a sanitizace zahrnují vehicleLogs a vehicleLogId',()=>{
  assert.ok(integrity.includes("'vehicleLogs'"));
  assert.ok(integrity.includes('targetSchema = 15'));
  assert.ok(app.includes('clean.vehicleLogs'));
  assert.ok(app.includes('vehicleLogId:textLimit'));
});


test('kompletní historie Fabie se přenáší rodinným souborem bez individuálního přepínače',()=>{
  const family=fs.readFileSync(new URL('../src/features/family-snapshot.js',import.meta.url),'utf8');
  const manual=fs.readFileSync(new URL('../public/manual.html',import.meta.url),'utf8');
  assert.ok(family.includes("'vehicleLogs'"));
  assert.ok(family.includes("collection === 'vehicleLogs' || item?.shared !== false"));
  assert.ok(manual.includes("share:'shared'"));
  assert.ok(manual.includes('kompletní historie Fabie'));
});
