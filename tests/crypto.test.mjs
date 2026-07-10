import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesToB64,
  decryptObjectWithKey,
  deriveVaultKey,
  encryptObjectWithKey,
  validateKdfIterations
} from '../src/security/crypto.js';
import { MIN_KDF_ITERATIONS, MAX_KDF_ITERATIONS } from '../src/config/constants.js';

test('KDF iterace mají bezpečný horní i dolní limit', () => {
  assert.equal(validateKdfIterations(MIN_KDF_ITERATIONS), MIN_KDF_ITERATIONS);
  assert.throws(() => validateKdfIterations(MIN_KDF_ITERATIONS - 1), /Neplatný počet iterací/);
  assert.throws(() => validateKdfIterations(MAX_KDF_ITERATIONS + 1), /Neplatný počet iterací/);
});

test('stav lze otevřít jen s klíčem odvozeným se stejným počtem iterací', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey('velmi-dlouhe-testovaci-heslo', salt, MIN_KDF_ITERATIONS);
  const encrypted = await encryptObjectWithKey({ok:true}, key);
  const envelope = {crypto:{iterations:MIN_KDF_ITERATIONS,salt:bytesToB64(salt),iv:encrypted.iv},data:encrypted.data};
  const restored = await decryptObjectWithKey(envelope, key);
  assert.deepEqual(restored, {ok:true});
});
