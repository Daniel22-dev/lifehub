import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('WhatsApp share uses a broadly supported text file wrapper', () => {
  assert.match(app, /shareFileName=`\$\{baseName\}\.lifehub-family\.txt`/);
  assert.match(app, /shareMime='text\/plain;charset=utf-8'/);
  assert.match(app, /await navigator\.share\(shareData\)/);
});

test('family import accepts text wrapper and native family files', () => {
  assert.match(html, /accept="[^"]*\.lifehub-family[^"]*\.txt[^"]*text\/plain/);
});
