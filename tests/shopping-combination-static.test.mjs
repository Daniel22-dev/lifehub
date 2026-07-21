import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/lifehub.css', import.meta.url), 'utf8');

test('Velké nákupy obsahují kalkulačku kombinace', () => {
  for (const id of ['shoppingCombo', 'shopComboTotal', 'shopComboSummary', 'shopComboItems', 'shopSelectVisible', 'shopClearSelection']) {
    assert.ok(html.includes(`id="${id}"`), `chybí prvek ${id}`);
  }
  assert.ok(html.includes('Kalkulačka kombinace'));
});

test('výběr položek se počítá odděleně od uloženého stavu', () => {
  assert.ok(app.includes('const selectedShoppingIds = new Set()'));
  assert.ok(app.includes('function shoppingComboItems()'));
  assert.ok(app.includes('function renderShoppingCombo()'));
  assert.ok(app.includes('function setShoppingComboSelection('));
  assert.ok(app.includes('function selectVisibleShoppingForCombo()'));
  assert.ok(app.includes('function clearShoppingComboSelection()'));
  assert.ok(app.includes("items.reduce((sum,item)=>sum+number(item.price),0)"));
  assert.ok(app.includes('selectedShoppingIds.clear()'));
});

test('nekoupené položky mají zaškrtávací volbu a koupené se z výběru odstraní', () => {
  assert.ok(app.includes("const selectable=s.status!=='bought'"));
  assert.ok(app.includes('data-shop-combo='));
  assert.ok(app.includes("if(status==='bought') selectedShoppingIds.delete(id)"));
  assert.ok(app.includes("state.shopping.find(s=>s.id===id && s.status!=='bought')"));
});

test('kalkulačka má mobilní styly a zvýraznění vybraných karet', () => {
  for (const selector of ['.shopping-combo{', '.shopping-combo-chip{', '.shopping-item-selected{', '.shopping-combo-check{']) {
    assert.ok(css.includes(selector), `chybí CSS ${selector}`);
  }
});
