import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');

function section(startMarker, endMarker){
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Chybí začátek sekce: ${startMarker}`);
  assert.notEqual(end, -1, `Chybí konec sekce: ${endMarker}`);
  return app.slice(start, end);
}

test('startovací brána má definovanou kontrolu staršího stavu', () => {
  const definition = app.indexOf('function hasLegacyState()');
  const usage = app.indexOf('const legacy = hasLegacyState();');
  assert.notEqual(definition, -1);
  assert.notEqual(usage, -1);
  assert.ok(definition < usage, 'hasLegacyState musí být definována před použitím');
});

test('migrace nemaže bezpečnostní kopii před úspěšným odemčením', () => {
  const loader = section('async function loadEncryptedStateEnvelope()', 'async function writeEncryptedStateEnvelope');
  assert.match(loader, /localStorage\.getItem\(ENC_STORE\)/);
  assert.doesNotMatch(loader, /localStorage\.removeItem\(ENC_STORE\)/);
  assert.match(app, /pendingLegacyEnvelopeCleanup/);
});

test('chyba úložiště blokuje založení prázdného trezoru', () => {
  assert.match(app, /if\(startupStorageError\)/);
  assert.match(app, /Nezadávejte nový PIN ani nemažte data aplikace/);
  assert.match(app, /unlockBtn'\)\.disabled = true/);
});

test('neočekávaná chyba startu se zobrazí jako recovery chyba', () => {
  assert.match(app, /init\(\)\.catch\(error =>/);
  assert.match(app, /Nezakládejte nový trezor a nemažte data aplikace/);
});
