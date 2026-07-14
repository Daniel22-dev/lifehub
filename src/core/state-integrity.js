import { uid } from './utils.js';

export const STATE_COLLECTIONS_WITH_IDS = Object.freeze([
  'notes','transactions','payrolls','documents','tasks','shopping','apps','installments',
  'householdPayments','budgetEntries','groceries','aiEntries','rewards','gardenItems','gardenLogs'
]);

export function migrateStateSchema(input, targetSchema = 8){
  const migrated = JSON.parse(JSON.stringify(input || {}));
  const current = Math.max(1, Math.round(Number(migrated.schemaVersion) || 1));
  if(current < 6 && Array.isArray(migrated.payrolls)){
    for(const payroll of migrated.payrolls){
      if(!payroll || typeof payroll !== 'object') continue;
      payroll.fields = payroll.fields && typeof payroll.fields === 'object' ? payroll.fields : {};
      if(!(Number(payroll.fields.cleanPay) > 0)){
        const note = String(payroll.note || '');
        const match = note.match(/(?:^|[;,.]\s*)čistá mzda\s+([0-9][0-9 \u00a0]*(?:,[0-9]{1,2})?)\s*Kč/i);
        if(match){
          const parsed = Number(match[1].replace(/[ \u00a0]/g,'').replace(',','.'));
          if(Number.isFinite(parsed) && parsed > 0) payroll.fields.cleanPay = parsed;
        }
      }
      // U starších nebo ne-Elanor pásek nebyla čistá mzda a částka na účet rozlišena.
      // Pokud zvláštní hodnota chybí, zachová se dosavadní částka jako čistá mzda.
      if(!(Number(payroll.fields.cleanPay) > 0) && Number(payroll.fields.netPay) > 0){
        payroll.fields.cleanPay = Number(payroll.fields.netPay);
      }
      if(!(Number(payroll.fields.netPay) > 0) && Number(payroll.fields.cleanPay) > 0){
        payroll.fields.netPay = Number(payroll.fields.cleanPay);
      }
    }
  }
  if(current < 8){
    if(Array.isArray(migrated.rewards)){
      for(const reward of migrated.rewards){
        const match=/^(\d{4})-(L|Z)$/.exec(String(reward?.period||''));
        if(!match) continue;
        const year=Number(match[1]);
        reward.period=match[2]==='Z' ? `${year}-${year+1}-A` : `${year-1}-${year}-B`;
      }
    }
    if(Array.isArray(migrated.householdPayments)){
      for(const payment of migrated.householdPayments){
        if(payment && payment.trackFinance===undefined) payment.trackFinance=true;
      }
    }
    if(Array.isArray(migrated.payrolls)){
      const transactions=Array.isArray(migrated.transactions)?migrated.transactions:[];
      for(const payroll of migrated.payrolls){
        if(!payroll || typeof payroll!=='object' || payroll.paymentDate) continue;
        const linked=transactions.find(t=>t?.source==='payroll' && (t.payrollId===payroll.id || t.payrollMonth===payroll.month));
        payroll.paymentDate=String(linked?.date||'').slice(0,10);
        payroll.paymentDateEstimated=true;
      }
    }
  }
  if(current < targetSchema) migrated.schemaVersion = targetSchema;
  return migrated;
}

export function ensureUniqueIds(clean, idFactory = uid){
  for(const collection of STATE_COLLECTIONS_WITH_IDS){
    const seen = new Set();
    for(const item of clean?.[collection] || []){
      if(!item.id || seen.has(item.id)) item.id = idFactory(collection.slice(0,5));
      seen.add(item.id);
      if(Array.isArray(item.paymentHistory)){
        const historySeen = new Set();
        for(const row of item.paymentHistory){
          if(!row.id || historySeen.has(row.id)) row.id = idFactory('history');
          historySeen.add(row.id);
        }
      }
    }
  }
  return clean;
}
