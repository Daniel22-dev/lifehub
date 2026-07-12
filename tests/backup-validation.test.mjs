import test from 'node:test';
import assert from 'node:assert/strict';
import { PDF_STORE, VAULT_STORE } from '../src/config/constants.js';
import { estimateBase64Bytes } from '../src/features/backup.js';
import { validateBackupFileRecord, validateBackupFileSet } from '../src/features/backup-validation.js';

const base64 = bytes => Buffer.from(bytes).toString('base64');

test('odhad Base64 velikosti respektuje padding', () => {
  assert.equal(estimateBase64Bytes('YQ=='), 1);
  assert.equal(estimateBase64Bytes('YWI='), 2);
  assert.equal(estimateBase64Bytes('YWJj'), 3);
});

test('soubor zálohy se validuje podle skutečných dat, ne jen deklarované velikosti', () => {
  const record = validateBackupFileRecord({id:'payroll_1', store:PDF_STORE, name:'p.pdf', size:3, data:base64('abc')});
  assert.equal(record.size, 3);
  assert.throws(() => validateBackupFileRecord({id:'payroll_1', store:PDF_STORE, size:1, data:base64('abcdef')}), /nekonzistentní/);
  assert.throws(() => validateBackupFileRecord({id:'x', store:'unknown', data:base64('x')}), /neznámé úložiště/);
});

test('kompletní záloha odmítne osiřelý nebo duplicitní soubor', () => {
  const state = {payrolls:[{id:'payroll_1',storedPdf:true}], documents:[{id:'doc_1',storedFile:true}]};
  const pdf = {id:'payroll_1', store:PDF_STORE, size:1, data:base64('a')};
  const doc = {id:'doc_1', store:VAULT_STORE, size:1, data:base64('b')};
  assert.equal(validateBackupFileSet([pdf,doc], state).records.length, 2);
  assert.throws(() => validateBackupFileSet([pdf,pdf], state), /duplicitní/);
  assert.throws(() => validateBackupFileSet([{...doc,id:'doc_missing'}], state), /nemá odpovídající metadata/);
});


test('kompletní záloha odmítne chybějící očekávaný soubor', () => {
  const state={payrolls:[{id:'payroll_1',storedPdf:true}],documents:[{id:'doc_1',storedFile:true}]};
  const pdf={id:'payroll_1',store:PDF_STORE,size:1,data:base64('a')};
  assert.throws(()=>validateBackupFileSet([pdf],state),/neúplná/);
});
