import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('service worker precachuje build assety a nepoužívá HTML fallback pro skripty', async () => {
  const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.match(sw,/discoverBuildAssets/);
  assert.match(sw,/\(\?:js\|css\)/);
  assert.match(sw,/request\.mode === 'navigate'/);
  assert.equal((sw.match(/caches\.match\('\.\/index\.html'\)/g)||[]).length,1);
});

test('integrovaný manuál hlásí aktivitu a iframe je sandboxovaný', async () => {
  const [manual,index]=await Promise.all([
    readFile(new URL('../public/manual.html',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(manual,/lifehub-manual-activity/);
  assert.match(index,/sandbox="allow-scripts allow-same-origin allow-popups allow-modals"/);
  assert.match(index,/18 částí/);
});
