import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('rodinné sdílení odděluje oslovení od jména autora', () => {
  assert.match(html, /id="familyDisplayName"/);
  assert.match(app, /state\.settings\.familyDisplayName/);
  assert.match(app, /Rodinný náhled/);
  assert.doesNotMatch(app, /<p class="eyebrow">\$\{esc\(state\.partner\?\.name/);
});

test('partnerův náhled zpřístupňuje bezpečné odkazy u sdílených položek', () => {
  assert.match(app, /partnerExternalLink\(x\.url,'Otevřít produkt \/ nabídku'\)/);
  assert.match(app, /partnerExternalLink\(g\.url,'Otevřít odkaz'\)/);
  assert.match(app, /rel="noopener noreferrer"/);
});

test('zamykací obrazovka a nastavení obsahují ovládání biometrie', () => {
  assert.match(html, /id="biometricUnlockBtn"/);
  assert.match(html, /id="enableBiometricBtn"/);
  assert.match(html, /id="removeBiometricBtn"/);
});
