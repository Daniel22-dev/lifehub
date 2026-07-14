import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('src/app/lifehub-app.js', root), 'utf8');

test('aktivní seznamy mají samostatné rozbalovací archivy', () => {
  for (const id of [
    'taskCompletedArchive',
    'shoppingPausedArchive',
    'shoppingBoughtArchive',
    'installmentsCompletedArchive'
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
});

test('archivované položky lze vrátit zpět', () => {
  assert.match(app, /data-shop-status="planned"/);
  assert.match(app, /function setShoppingStatus\(/);
  assert.match(app, /data-reopen-inst=/);
  assert.match(app, /function reopenInstallment\(/);
  assert.match(app, /data-toggle-task=/);
});

test('výchozí velké nákupy zobrazují jen plánované položky', () => {
  assert.match(app, /stat==='open'\?s\.status==='planned'/);
});
