import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('reward PDF does not show a duplicate confirmation over Android download sheet', () => {
  const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
  const start=app.indexOf('async function downloadRewardReportPdf()');
  assert.ok(start>=0);
  const method=app.slice(start,app.indexOf('// ===== Projekty domu',start));
  assert.match(method,/download\(`lifehub-odmeny-\$\{period\}\.pdf`,blob,'application\/pdf'\)/);
  assert.doesNotMatch(method,/toast\('PDF s podklady pro odměny bylo staženo/);
  assert.match(method,/toast\('PDF s podklady pro odměny se nepodařilo vytvořit/);
});

test('mobile notifications fit inside viewport and above navigation', () => {
  const css=fs.readFileSync(new URL('../src/styles/lifehub.css',import.meta.url),'utf8');
  assert.match(css,/\.toast-wrap\{left:12px;right:12px;bottom:calc\(100px \+ env\(safe-area-inset-bottom\)\);width:auto;max-width:none;z-index:130/);
  assert.match(css,/\.toast-wrap \.toast\{max-width:100%;min-width:0;overflow-wrap:anywhere/);
});
