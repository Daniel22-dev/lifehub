import { uid } from './utils.js';

export const STATE_COLLECTIONS_WITH_IDS = Object.freeze([
  'notes','transactions','payrolls','documents','tasks','shopping','apps','installments',
  'householdPayments','budgetEntries','groceries','aiEntries','rewards','gardenItems','gardenLogs'
]);

export function migrateStateSchema(input, targetSchema = 5){
  const migrated = JSON.parse(JSON.stringify(input || {}));
  const current = Math.max(1, Math.round(Number(migrated.schemaVersion) || 1));
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
