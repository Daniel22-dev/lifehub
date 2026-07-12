// Parser výplatních pásek ze systému Elanor Global (formát „Výplatní lístek").
// Souhrnná tabulka má 4 sloupce „popisek hodnota" na jednom řádku, takže obecný
// parser (poslední číslo v okně dvou řádků) vrací špatné hodnoty. Tento modul
// páruje každý popisek s číslem hned za ním a čte i položkové řádky podle SLM kódů.

const czk = n => Number(n).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ');
const strip = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// „D O B Í R K A" → „DOBÍRKA" (Elanor prokládá důležité položky mezerami)
export function collapseSpacedCaps(line){
  return String(line || '').replace(/(?:\p{Lu}\s){2,}\p{Lu}(?!\p{L})/gu, m => m.replace(/\s+/g, ''));
}

export function parseElanorAmount(value){
  if(value === undefined || value === null) return null;
  const n = Number(String(value).trim().replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function isElanorPayslip(text){
  const t = strip(collapseSpacedCaps(String(text || '')));
  return t.includes('elanor') || (t.includes('vyplatni listek') && t.includes('dobirka'));
}

const AMOUNT = '(-?\\d[\\d ]*(?:,\\d{1,2})?)';

// Popisky souhrnné tabulky (normalizované bez diakritiky) → interní klíč.
const SUMMARY_LABELS = [
  ['odprac\\.?\\s*hodiny', 'workedHours'],
  ['sz zamestnanec', 'socialInsurance'],
  ['zp zamestnanec', 'healthInsurance'],
  ['zaklad dane', 'taxBase'],
  ['sleva zakladni', 'taxpayerDiscount'],
  ['sleva na deti', 'childAllowance'],
  ['danovy bonus', 'childBonus'],
  ['zalohova dan', 'advanceTax'],
  ['srazkova dan', 'withheldTax'],
  ['hruba mzda', 'grossPay'],
  ['hruby prijem', 'grossIncome'],
  ['cista mzda', 'cleanPay'],
  ['dobirka', 'netPay']
];

// Položkové SLM kódy → interní klíč (částka je poslední číslo řádku).
const ITEM_CODES = {
  '22610': 'sickPay',      // Náhrady příjmu při nemoci
  '11290': 'overtime',     // Příplatek za přímou pedag. činnost nad rozsah
  '41050': 'deductions',   // Ostatní dohodnuté pohledávky (srážky)
  '41064': 'mealVouchers', // Stravenky / závodní stravování přes hranici
  '21320': 'dpp',          // Dohoda o provedení práce
  '11430': 'bonus',        // Odměna
  '21110': 'vacationPay'   // Náhrada za dovolenou
};

const ITEM_ROW = new RegExp(`^(\\d{2,5}) \\d{4}\\.\\d{2} (.+?) ${AMOUNT} ${AMOUNT} ${AMOUNT} ${AMOUNT}$`);

export function parseElanorPayslip(text){
  const rawLines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fields = {};
  const evidence = {};
  const items = {};
  const hints = [];
  let month = '';
  let employer = '';

  const put = (key, value, label, snippet) => {
    if(value === null || !Number.isFinite(value) || Math.abs(value) >= 10000000) return;
    fields[key] = value;
    evidence[key] = { value, label, snippet: String(snippet).slice(0, 220), confidence: 'vysoká' };
  };

  rawLines.forEach((raw, idx) => {
    const collapsed = collapseSpacedCaps(raw);
    const norm = strip(collapsed);

    if(idx === 0 && norm.includes('vytvoreno')){
      employer = collapsed.split(/vytvořeno/i)[0].replace(/[:\s]+$/, '').trim();
    }
    if(!month){
      const m = norm.match(/\b(20\d{2})-(\d{2})\b/);
      if(m && Number(m[2]) >= 1 && Number(m[2]) <= 12) month = `${m[1]}-${m[2]}`;
    }

    // Položkové řádky (SLM kód, PV, název, hodiny, kal. dny, směny, částka)
    const item = norm.match(ITEM_ROW);
    if(item){
      const key = ITEM_CODES[item[1]];
      const amount = parseElanorAmount(item[6]);
      if(key && amount !== null){
        items[key] = (items[key] || 0) + amount;
        if(!evidence[`item_${key}`]) evidence[`item_${key}`] = raw;
      }
      if(item[1] === '510'){
        const days = parseElanorAmount(item[4]);
        if(days) hints.push(`nemoc ${czk(days)} kal. dní`);
      }
      return;
    }

    // Souhrnné páry „popisek hodnota" (až 4 na řádku)
    for(const [labelRe, key] of SUMMARY_LABELS){
      const m = norm.match(new RegExp(`${labelRe}\\s*:?\\s*${AMOUNT}(?!\\d)`));
      if(m){
        const val = parseElanorAmount(m[1]);
        if(val !== null && fields[key] === undefined) put(key, val, collapsed.slice(0, 60), raw);
      }
    }
  });

  // Přemapování na pole aplikace
  const out = {};
  const ev = {};
  const take = (target, source, label) => {
    if(fields[source] === undefined) return;
    out[target] = fields[source];
    ev[target] = { ...evidence[source], label };
  };

  take('cleanPay', 'cleanPay', 'Čistá mzda');
  take('netPay', 'netPay', 'DOBÍRKA (částka na účet)');
  take('grossPay', 'grossPay', 'Hrubá mzda');
  take('taxBase', 'taxBase', 'Základ daně');
  take('taxpayerDiscount', 'taxpayerDiscount', 'Sleva základní (na poplatníka)');
  take('socialInsurance', 'socialInsurance', 'SZ zaměstnanec');
  take('healthInsurance', 'healthInsurance', 'ZP zaměstnanec');
  take('workedHours', 'workedHours', 'Odpracované hodiny');

  const advance = fields.advanceTax ?? null;
  const withheld = fields.withheldTax ?? null;
  if(advance !== null || withheld !== null){
    out.incomeTax = (advance || 0) + (withheld || 0);
    ev.incomeTax = { value: out.incomeTax, label: 'Zálohová + srážková daň', snippet: (evidence.advanceTax?.snippet || evidence.withheldTax?.snippet || '').slice(0, 220), confidence: 'vysoká' };
  }

  const allowance = fields.childAllowance ?? null;
  const bonus = fields.childBonus ?? null;
  if(allowance !== null || bonus !== null){
    out.childDiscount = (allowance || 0) + (bonus || 0);
    ev.childDiscount = { value: out.childDiscount, label: 'Sleva na děti + daňový bonus', snippet: (evidence.childAllowance?.snippet || '').slice(0, 220), confidence: 'vysoká' };
  }

  for(const key of ['sickPay', 'overtime', 'deductions', 'mealVouchers', 'bonus', 'vacationPay']){
    if(items[key] !== undefined){
      out[key] = items[key];
      ev[key] = { value: items[key], label: 'Položka výplatní pásky', snippet: String(evidence[`item_${key}`] || '').slice(0, 220), confidence: 'vysoká' };
    }
  }

  if(items.dpp) hints.push(`DPP ${czk(items.dpp)} Kč (zahrnuto v hrubé mzdě)`);
  if(fields.cleanPay !== undefined && fields.netPay !== undefined && fields.cleanPay !== fields.netPay){
    hints.push(`čistá mzda ${czk(fields.cleanPay)} Kč, na účet ${czk(fields.netPay)} Kč`);
  }
  if(fields.childBonus) hints.push(`daňový bonus ${czk(fields.childBonus)} Kč`);

  return { fields: out, evidence: ev, found: Object.keys(out).length, month, employer, hints };
}
