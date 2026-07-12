export const FAMILY_COLLECTIONS = Object.freeze([
  'transactions',
  'budgetEntries',
  'groceries',
  'tasks',
  'shopping',
  'installments',
  'householdPayments',
  'gardenItems',
  'gardenLogs'
]);

export const FAMILY_EXCLUDED_DESCRIPTION = 'Výplatní pásky, mzdové transakce, dokumenty, poznámky, AI výkaz, odměny a seznam aplikací se do rodinného souboru nezahrnují.';

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

export function buildFamilySnapshot({state, version, ownerId, ownerName, exportedAt = new Date().toISOString()}){
  const sourceState = state && typeof state === 'object' ? state : {};
  const data = {};
  for(const collection of FAMILY_COLLECTIONS){
    const source = Array.isArray(sourceState[collection]) ? sourceState[collection] : [];
    data[collection] = source
      .filter(item => item?.shared !== false && !(collection === 'transactions' && item?.source === 'payroll'))
      .map(clone);
  }
  return {
    kind:'LifeHub family snapshot',
    schema:3,
    version:String(version || ''),
    exportedAt,
    owner:{id:String(ownerId || ''), name:String(ownerName || 'Partner')},
    note:`Šifrovaný náhled sdílených financí, rozpočtů, nákupů, úkolů, splátek, plateb a zahrady pro partnera. Importovaný obsah je pouze ke čtení. ${FAMILY_EXCLUDED_DESCRIPTION}`,
    householdSettings:{
      foodBudget:Math.max(0, Number(sourceState.settings?.foodBudget) || 0),
      fuelBudget:Math.max(0, Number(sourceState.settings?.fuelBudget) || 0),
      savingGoal:Math.max(0, Number(sourceState.settings?.savingGoal) || 0),
      updatedAt:String(sourceState.settings?.familySettingsUpdatedAt || sourceState.updatedAt || exportedAt)
    },
    data
  };
}

export function summarizeFamilySnapshot(snapshot){
  const counts = {};
  let total = 0;
  for(const collection of FAMILY_COLLECTIONS){
    const count = Array.isArray(snapshot?.data?.[collection]) ? snapshot.data[collection].length : 0;
    counts[collection] = count;
    total += count;
  }
  return {counts, total};
}
