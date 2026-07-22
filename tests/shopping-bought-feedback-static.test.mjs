import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/styles/lifehub.css',import.meta.url),'utf8');

test('koupený nákup nejprve ukáže fajfku a až potom se přesune',()=>{
  assert.ok(app.includes('SHOPPING_BOUGHT_FEEDBACK_MS = 650'));
  assert.ok(app.includes("toggleShoppingBought(shoppingInput.dataset.toggleShopBought,shoppingInput.checked,shoppingInput)"));
  assert.ok(app.includes("labelText.textContent='Koupeno'"));
  assert.ok(app.includes('save(false)'));
  assert.ok(app.includes('setTimeout(()=>renderAll(),SHOPPING_BOUGHT_FEEDBACK_MS)'));
});

test('potvrzení nákupu má výrazný stav a respektuje omezený pohyb',()=>{
  assert.ok(css.includes('.shopping-bought-check.shopping-bought-confirming'));
  assert.ok(css.includes('.shopping-item.shopping-bought-confirming'));
  assert.ok(css.includes('@keyframes shoppingBoughtPulse'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('width:20px;height:20px'));
});
