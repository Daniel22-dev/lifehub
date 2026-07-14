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

// ===== Odměny (školní rok: září–prosinec / leden–červen) =====

export function normalizeRewardPeriod(period){
  const raw=String(period||'');
  if(/^\d{4}-\d{4}-(A|B)$/.test(raw)) return raw;
  const legacy=/^(\d{4})-(L|Z)$/.exec(raw);
  if(!legacy) return raw;
  const year=Number(legacy[1]);
  return legacy[2]==='Z' ? `${year}-${year+1}-A` : `${year-1}-${year}-B`;
}

export function rewardPeriodLabel(period){
  const normalized=normalizeRewardPeriod(period);
  const match=/^(\d{4})-(\d{4})-(A|B)$/.exec(normalized);
  if(!match) return String(period || 'neznámé období');
  const schoolYear=`${match[1]}/${match[2]}`;
  return match[3]==='A'
    ? `Září–prosinec ${match[1]} · školní rok ${schoolYear}`
    : `Leden–červen ${match[2]} · školní rok ${schoolYear}`;
}

export function currentRewardPeriod(date = new Date()){
  const year=date.getFullYear();
  const month=date.getMonth()+1;
  if(month>=9) return `${year}-${year+1}-A`;
  if(month<=6) return `${year-1}-${year}-B`;
  // O prázdninách zůstává jako výchozí právě uzavřené období leden–červen.
  return `${year-1}-${year}-B`;
}

export function sumRewardHours(entries, period){
  return (Array.isArray(entries) ? entries : [])
    .filter(e => e?.period === period)
    .reduce((a, e) => a + Math.max(0, number(e.hours)), 0);
}

// ===== Nákupní seznam (hromadné vložení textu) =====

const GROCERY_STORES = Object.freeze(['Lidl','Albert','Kaufland','Billa','Tesco','Globus','Jiný']);

function normalizeStore(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  const found=GROCERY_STORES.find(store=>store.toLocaleLowerCase('cs-CZ')===raw.toLocaleLowerCase('cs-CZ'));
  return found || raw.slice(0,60);
}

export function parseGroceryEntries(text, fallbackStore=''){
  const source=String(text||'').replace(/\r/g,'').trim();
  if(!source) return [];
  const rawLines=source.split(/\n/);
  const parts=[];
  for(const line of rawLines){
    const trimmed=line.trim();
    if(!trimmed) continue;
    const heading=trimmed.match(/^([^:]{1,60}):\s*$/);
    if(heading){ parts.push({kind:'store',value:heading[1]}); continue; }
    const inline=trimmed.match(/^([^:]{1,60}):\s*(.+)$/);
    if(inline && GROCERY_STORES.some(store=>store.toLocaleLowerCase('cs-CZ')===inline[1].trim().toLocaleLowerCase('cs-CZ'))){
      parts.push({kind:'inline',store:inline[1],value:inline[2]});
      continue;
    }
    for(const segment of trimmed.split(/[;,]+/)) parts.push({kind:'item',value:segment});
  }
  let currentStore=normalizeStore(fallbackStore);
  const result=[];
  for(const part of parts){
    if(part.kind==='store'){
      currentStore=normalizeStore(part.value);
      continue;
    }
    const store=part.kind==='inline'?normalizeStore(part.store):currentStore;
    const name=String(part.value||'')
      .replace(/^\s*(?:\[[ xX✓✔]?\]|[-*•·–—]|\d+[.)])\s*/, '')
      .replace(/[,;]\s*$/, '')
      .trim()
      .slice(0,160);
    if(name) result.push({name,store});
    if(result.length>=100) break;
  }
  return result;
}

export function parseGroceryLines(text){
  return parseGroceryEntries(text).map(item=>item.name);
}
