import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/lifehub.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mobile layout has viewport sizing and does not depend on fullscreen', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(css, /Mobile viewport containment: fixed navigation must not size the document/);
  assert.match(css, /@media \(max-width:1080px\)\{\s*html,body\{max-width:100%;overflow-x:clip\}/);
  assert.match(css, /\.layout\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('mobile fixed sidebar and five-button dock cannot grow outside viewport', () => {
  assert.match(css, /\.sidebar\{[\s\S]*?max-width:calc\(100vw - 16px\)!important;/);
  assert.match(css, /\.sidebar \.nav\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important;/);
  assert.match(css, /\.sidebar \.nav button\{[\s\S]*?min-width:0;/);
  assert.match(css, /\.mobile-dock\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\);/);
  assert.match(css, /\.mobile-dock button\{min-width:0;max-width:100%;overflow:hidden\}/);
});

test('reward selection and PDF controls stay within narrow phone screens', () => {
  assert.match(css, /#rewardPeriodSelect\{min-width:0;width:100%;max-width:100%\}/);
  assert.match(css, /#rewards \.section-head>\.actions\{min-width:0;width:100%\}/);
  assert.match(css, /#rewards \.panel-head>\.actions \.btn\{min-width:0;white-space:normal;overflow-wrap:anywhere\}/);
});

test('table content remains independently horizontally scrollable when needed', () => {
  assert.match(css, /\.table-wrap\{overflow:auto/);
  assert.match(css, /\.report-table-wrap\{overflow:auto/);
  assert.match(css, /\.nav\{display:flex;overflow-x:auto/);
});
