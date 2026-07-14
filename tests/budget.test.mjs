import test from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetMonthSummary,
  budgetYearData,
  sumMinutes,
  minutesLabel,
  rewardPeriodLabel,
  currentRewardPeriod,
  normalizeRewardPeriod,
  sumRewardHours,
  parseGroceryLines,
  parseGroceryEntries
} from '../src/features/budget.js';

test('měsíční souhrn rozpočtu počítá jídlo, benzín a bilanci', () => {
  const entries = [
    { date: '2026-07-02', kind: 'food', amount: 1200 },
    { date: '2026-07-10', kind: 'food', amount: '2 500' },
    { date: '2026-07-11', kind: 'fuel', amount: 1400 },
    { date: '2026-06-30', kind: 'food', amount: 9999 }
  ];
  const s = budgetMonthSummary(entries, '2026-07', { food: 10000, fuel: 3500 });
  assert.equal(s.food, 3700);
  assert.equal(s.fuel, 1400);
  assert.equal(s.foodRemaining, 6300);
  assert.equal(s.fuelRemaining, 2100);
  assert.equal(s.balance, 8400);
  assert.equal(s.count, 3);
});

test('překročený limit vede k záporné bilanci', () => {
  const entries = [{ date: '2026-07-01', kind: 'fuel', amount: 5000 }];
  const s = budgetMonthSummary(entries, '2026-07', { food: 10000, fuel: 3500 });
  assert.equal(s.fuelRemaining, -1500);
  assert.equal(s.balance, 8500);
});

test('roční data rozpočtu mají 12 měsíců ve správném pořadí', () => {
  const rows = budgetYearData([], 2026, { food: 10000, fuel: 3500 });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].month, '2026-01');
  assert.equal(rows[11].month, '2026-12');
  assert.equal(rows[5].limit, 13500);
});

test('součet minut respektuje měsíční prefix a formát hodin', () => {
  const entries = [
    { date: '2026-07-01', minutes: 90 },
    { date: '2026-07-15', minutes: '45' },
    { date: '2026-06-15', minutes: 600 }
  ];
  assert.equal(sumMinutes(entries, '2026-07'), 135);
  assert.equal(sumMinutes(entries, '2026'), 735);
  assert.equal(minutesLabel(135), '2 h 15 min');
  assert.equal(minutesLabel(120), '2 h');
  assert.equal(minutesLabel(45), '45 min');
});

test('období odměn odpovídají školnímu roku', () => {
  assert.equal(normalizeRewardPeriod('2026-Z'), '2026-2027-A');
  assert.equal(normalizeRewardPeriod('2026-L'), '2025-2026-B');
  assert.equal(rewardPeriodLabel('2026-2027-A'), 'Září–prosinec 2026 · školní rok 2026/2027');
  assert.equal(rewardPeriodLabel('2025-2026-B'), 'Leden–červen 2026 · školní rok 2025/2026');
  assert.equal(currentRewardPeriod(new Date('2026-03-15')), '2025-2026-B');
  assert.equal(currentRewardPeriod(new Date('2026-07-15')), '2025-2026-B');
  assert.equal(currentRewardPeriod(new Date('2026-11-15')), '2026-2027-A');
  assert.equal(sumRewardHours([
    { period: '2025-2026-B', hours: 4.5 },
    { period: '2025-2026-B', hours: '2,5' },
    { period: '2026-2027-A', hours: 10 }
  ], '2025-2026-B'), 7);
});

test('hromadné vložení nákupního seznamu čistí odrážky a číslování', () => {
  const items = parseGroceryLines('- mléko\n2) chleba,\n• vejce\n\n   máslo   \n');
  assert.deepEqual(items, ['mléko', 'chleba', 'vejce', 'máslo']);
});


test('hromadný nákup rozpozná oddíly obchodů, čárky a výchozí obchod', () => {
  const entries = parseGroceryEntries('Lidl:\n- mléko\nchleba, 2x vejce\n\nAlbert:\nmáslo; jogurty');
  assert.deepEqual(entries, [
    {name:'mléko',store:'Lidl'},
    {name:'chleba',store:'Lidl'},
    {name:'2x vejce',store:'Lidl'},
    {name:'máslo',store:'Albert'},
    {name:'jogurty',store:'Albert'}
  ]);
  assert.deepEqual(parseGroceryEntries('mléko; chleba','Kaufland'), [
    {name:'mléko',store:'Kaufland'},
    {name:'chleba',store:'Kaufland'}
  ]);
});
