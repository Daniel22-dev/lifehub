import { number, pad } from '../core/utils.js';

// ===== Jídlo & benzín (měsíční rozpočet) =====

export const DEFAULT_FOOD_BUDGET = 10000;
export const DEFAULT_FUEL_BUDGET = 3500;

export function budgetMonthSummary(entries, month, limits){
  const inMonth = (Array.isArray(entries) ? entries : []).filter(e => String(e?.date || '').startsWith(month));
  const food = inMonth.filter(e => e.kind !== 'fuel').reduce((a, e) => a + Math.max(0, number(e.amount)), 0);
  const fuel = inMonth.filter(e => e.kind === 'fuel').reduce((a, e) => a + Math.max(0, number(e.amount)), 0);
  const foodLimit = Math.max(0, number(limits?.food));
  const fuelLimit = Math.max(0, number(limits?.fuel));
  return {
    month,
    food,
    fuel,
    foodLimit,
    fuelLimit,
    foodRemaining: foodLimit - food,
    fuelRemaining: fuelLimit - fuel,
    spent: food + fuel,
    limit: foodLimit + fuelLimit,
    balance: (foodLimit + fuelLimit) - (food + fuel),
    count: inMonth.length
  };
}

export function budgetYearData(entries, year, limits){
  return Array.from({ length: 12 }, (_, i) => budgetMonthSummary(entries, `${year}-${pad(i + 1)}`, limits));
}

// ===== AI výkaz (minuty a hodiny) =====

export function sumMinutes(entries, prefix){
  return (Array.isArray(entries) ? entries : [])
    .filter(e => String(e?.date || '').startsWith(prefix))
    .reduce((a, e) => a + Math.max(0, Math.round(number(e.minutes))), 0);
}

export function minutesLabel(minutes){
  const total = Math.max(0, Math.round(number(minutes)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if(!h) return `${m} min`;
  if(!m) return `${h} h`;
  return `${h} h ${m} min`;
}

// ===== Odměny (období: léto / konec roku) =====

export function rewardPeriodLabel(period){
  const match = /^(\d{4})-(L|Z)$/.exec(String(period || ''));
  if(!match) return String(period || 'neznámé období');
  return match[2] === 'L' ? `Léto ${match[1]} (letní prázdniny)` : `Konec roku ${match[1]}`;
}

export function currentRewardPeriod(date = new Date()){
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month <= 7 ? `${year}-L` : `${year}-Z`;
}

export function sumRewardHours(entries, period){
  return (Array.isArray(entries) ? entries : [])
    .filter(e => e?.period === period)
    .reduce((a, e) => a + Math.max(0, number(e.hours)), 0);
}

// ===== Nákupní seznam (hromadné vložení textu) =====

export function parseGroceryLines(text){
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•·–—]|\d+[.)])\s*/, '').replace(/[,;]\s*$/, '').trim())
    .filter(Boolean)
    .slice(0, 100);
}
