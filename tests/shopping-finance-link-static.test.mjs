import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/styles/lifehub.css',import.meta.url),'utf8');

test('velké nákupy mají přímé označení koupeno',()=>{
  assert.ok(app.includes('data-toggle-shop-bought='));
  assert.ok(app.includes('function toggleShoppingBought('));
  assert.ok(css.includes('.shopping-bought-check{'));
});

test('označení koupeno vytváří propojený finanční výdaj',()=>{
  assert.ok(app.includes('function upsertShoppingTransaction('));
  assert.ok(app.includes("source:'shopping'"));
  assert.ok(app.includes('shoppingId:item.id'));
  assert.ok(app.includes('item.purchaseDate=today()'));
  assert.ok(app.includes('state.transactions.unshift(transaction)'));
});

test('vrácení nákupu do plánu odstraní propojený výdaj',()=>{
  assert.ok(app.includes('function removeShoppingTransaction('));
  assert.ok(app.includes('function restoreShoppingPlan('));
  assert.ok(app.includes("t.source==='shopping'&&t.shoppingId===item.id"));
});

test('finance umí zdroj Velké nákupy',()=>{
  assert.ok(html.includes('<option value="shopping">Velké nákupy</option>'));
  assert.ok(app.includes("['payroll','payment','installment','shopping']"));
  assert.ok(app.includes('shoppingId:textLimit'));
});

test('odebrání ceny z koupené položky odstraní starý propojený výdaj',()=>{
  assert.ok(app.includes("financeMessage=removed?' Propojený výdaj byl odstraněn, protože položka už nemá cenu.'"));
});

test('stavové štítky používají existující barevné proměnné',()=>{
  assert.ok(css.includes('color:var(--ok)'));
  assert.ok(css.includes('color:var(--warn)'));
  assert.ok(!css.includes('color:var(--good)'));
  assert.ok(!css.includes('color:var(--warning)'));
});
