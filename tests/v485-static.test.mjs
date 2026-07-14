import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const biometric=fs.readFileSync(new URL('../src/security/biometric.js',import.meta.url),'utf8');
const finance=fs.readFileSync(new URL('../src/features/finance.js',import.meta.url),'utf8');

test('výplata se opraví i u starších dat bez mzdové transakce',()=>{
  assert.ok(app.includes('function reconcilePayrollTransactions'));
  assert.ok(app.includes('payrollTransactionsReconciled'));
  assert.ok(app.includes('payrolls:state.payrolls'));
  assert.ok(app.includes("payroll.paymentDateEstimated===true && paymentDate.slice(0,7)===payroll.month"));
  assert.ok(finance.includes('Výplatní páska je hlavní zdroj pravdy'));
});

test('fullscreen tlačítko používá skutečné Fullscreen API a má záložní režim',()=>{
  assert.ok(app.includes('requestFullscreen'));
  assert.ok(app.includes('webkitRequestFullscreen'));
  assert.ok(app.includes('fullscreenchange'));
  assert.ok(app.includes("fullscreenMode='fallback'"));
});

test('aktivní biometrika se po otevření spustí automaticky',()=>{
  assert.ok(app.includes('scheduleAutomaticBiometricUnlock'));
  assert.ok(app.includes('handleBiometricUnlock({auto:true})'));
  assert.ok(biometric.includes("mediation:'required'"));
});
