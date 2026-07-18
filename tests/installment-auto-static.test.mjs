import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const manual=fs.readFileSync(new URL('../public/manual.html',import.meta.url),'utf8');

test('aplikace automaticky zpracuje splátky po termínu při odemčení',()=>{
  assert.ok(app.includes('const automaticInstallmentsAdvanced = reconcileAutomaticInstallmentPayments();'));
  assert.ok(app.includes('calculateDueInstallmentPayments(installment,{today:today()})'));
  assert.ok(app.includes("automatic:true"));
});

test('manuál popisuje automatické odečtení po dni splatnosti',()=>{
  assert.ok(manual.includes('Po dosažení dne splatnosti LifeHub při otevření automaticky zaznamená běžnou splátku'));
  assert.ok(manual.includes('bez dvojího započtení'));
});
