import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if(!globalThis.crypto) globalThis.crypto = webcrypto;
if(!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
if(!globalThis.atob) globalThis.atob = value => Buffer.from(value, 'base64').toString('binary');

import { deriveVaultKey, encryptObjectWithKey, decryptObjectWithKey, bytesToB64 } from '../src/security/crypto.js';
import { wrapVaultKey, unwrapVaultKey, sanitizeBiometricRecord, BIOMETRIC_RECORD_KIND } from '../src/security/biometric.js';

test('biometrický PRF klíč bezpečně zabalí a obnoví klíč trezoru', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const vaultKey = await deriveVaultKey('dlouhe-testovaci-heslo', salt, 210000);
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const wrapped = await wrapVaultKey(vaultKey, secret);
  const restored = await unwrapVaultKey(wrapped, secret);
  const envelope = await encryptObjectWithKey({ok:true, value:'LifeHub'}, vaultKey);
  assert.deepEqual(await decryptObjectWithKey(envelope, restored), {ok:true, value:'LifeHub'});
});

test('biometrický záznam odmítne poškozené hodnoty', () => {
  assert.equal(sanitizeBiometricRecord({kind:BIOMETRIC_RECORD_KIND,version:1}), null);
  const valid = sanitizeBiometricRecord({
    kind:BIOMETRIC_RECORD_KIND,
    version:1,
    credentialId:bytesToB64(new Uint8Array([1,2,3])),
    prfSalt:bytesToB64(new Uint8Array(32).fill(1)),
    wrappedKey:{alg:'AES-GCM',iv:bytesToB64(new Uint8Array(12).fill(2)),data:bytesToB64(new Uint8Array(48).fill(3))},
    createdAt:'2026-07-14T00:00:00.000Z',
    rpId:'example.test'
  });
  assert.equal(valid?.kind, BIOMETRIC_RECORD_KIND);
  assert.equal(valid?.rpId, 'example.test');
});
