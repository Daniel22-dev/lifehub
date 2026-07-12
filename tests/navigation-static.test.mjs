import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/lifehub.css', import.meta.url), 'utf8');

test('první navigační skupina není duplicitně pojmenovaná Přehled', () => {
  assert.match(html, /<div class="nav-group-label">Hlavní<\/div>/);
  assert.doesNotMatch(html, /<div class="nav-group-label">Přehled<\/div>/);
});

test('na telefonu a tabletu se skupinové nadpisy skryjí', () => {
  assert.match(css, /@media \(max-width:1080px\)[\s\S]*?\.nav-group-label\{display:none\}/);
  assert.match(css, /scroll-snap-type:x proximity/);
});
