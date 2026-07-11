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

const timestamp = value => {
  const n = Date.parse(String(value || ''));
  return Number.isFinite(n) ? n : 0;
};

const cloneValue = value => JSON.parse(JSON.stringify(value));

export function latestTombstones(items = []) {
  const map = new Map();
  for (const raw of Array.isArray(items) ? items : []) {
    if (!raw || typeof raw !== 'object') continue;
    const collection = String(raw.collection || '');
    const id = String(raw.id || '');
    if (!FAMILY_COLLECTIONS.includes(collection) || !id) continue;
    const deletedAt = String(raw.deletedAt || '');
    const key = `${collection}:${id}`;
    const current = map.get(key);
    if (!current || timestamp(deletedAt) > timestamp(current.deletedAt)) {
      map.set(key, { collection, id, deletedAt });
    }
  }
  return map;
}

export function recordFamilyDeletion(state, collection, item, deletedAt = new Date().toISOString()) {
  if (!state || !FAMILY_COLLECTIONS.includes(collection) || !item?.id || item.shared === false) return false;
  const existing = latestTombstones(state.familyDeleted || []);
  const key = `${collection}:${item.id}`;
  const current = existing.get(key);
  if (!current || timestamp(deletedAt) >= timestamp(current.deletedAt)) {
    existing.set(key, { collection, id: String(item.id), deletedAt: String(deletedAt) });
  }
  state.familyDeleted = Array.from(existing.values())
    .sort((a, b) => timestamp(b.deletedAt) - timestamp(a.deletedAt))
    .slice(0, 5000);
  return true;
}

export function mergeFamilySnapshot(state, snapshot) {
  if (!state || !snapshot || typeof snapshot !== 'object') {
    throw new Error('Rodinná data nemají očekávaný formát.');
  }

  const result = { added: 0, updated: 0, deleted: 0, kept: 0, settingsUpdated: false };
  const combinedTombstones = latestTombstones([...(state.familyDeleted || []), ...(snapshot.tombstones || [])]);
  state.familyDeleted = Array.from(combinedTombstones.values())
    .sort((a, b) => timestamp(b.deletedAt) - timestamp(a.deletedAt))
    .slice(0, 5000);

  for (const collection of FAMILY_COLLECTIONS) {
    const local = Array.isArray(state[collection]) ? state[collection] : [];
    const localById = new Map(local.map(item => [String(item?.id || ''), item]).filter(([id]) => id));
    const incoming = Array.isArray(snapshot.data?.[collection]) ? snapshot.data[collection] : [];

    for (const incomingItem of incoming) {
      if (!incomingItem?.id || incomingItem.shared === false) continue;
      const id = String(incomingItem.id);
      const tombstone = combinedTombstones.get(`${collection}:${id}`);
      const incomingUpdatedAt = incomingItem.updatedAt || incomingItem.createdAt || snapshot.exportedAt || '';
      if (tombstone && timestamp(tombstone.deletedAt) >= timestamp(incomingUpdatedAt)) {
        result.kept += 1;
        continue;
      }

      const current = localById.get(id);
      if (!current) {
        const copy = cloneValue(incomingItem);
        local.push(copy);
        localById.set(id, copy);
        result.added += 1;
        continue;
      }

      const currentUpdatedAt = current.updatedAt || current.createdAt || '';
      if (timestamp(incomingUpdatedAt) > timestamp(currentUpdatedAt)) {
        Object.assign(current, cloneValue(incomingItem));
        result.updated += 1;
      } else {
        result.kept += 1;
      }
    }

    const before = local.length;
    state[collection] = local.filter(item => {
      if (!item?.id || item.shared === false) return true;
      const tombstone = combinedTombstones.get(`${collection}:${item.id}`);
      if (!tombstone) return true;
      const itemUpdatedAt = item.updatedAt || item.createdAt || '';
      return timestamp(itemUpdatedAt) > timestamp(tombstone.deletedAt);
    });
    result.deleted += before - state[collection].length;
  }

  const familySettings = snapshot.householdSettings;
  if (familySettings && typeof familySettings === 'object') {
    const incomingUpdatedAt = familySettings.updatedAt || snapshot.exportedAt || '';
    const localUpdatedAt = state.settings?.familySettingsUpdatedAt || '';
    if (timestamp(incomingUpdatedAt) > timestamp(localUpdatedAt)) {
      state.settings.foodBudget = Math.max(0, Number(familySettings.foodBudget) || 0);
      state.settings.fuelBudget = Math.max(0, Number(familySettings.fuelBudget) || 0);
      state.settings.savingGoal = Math.max(0, Number(familySettings.savingGoal) || 0);
      state.settings.familySettingsUpdatedAt = incomingUpdatedAt || new Date().toISOString();
      result.settingsUpdated = true;
    }
  }

  return result;
}

export function nextPaymentDueDate(dateValue, frequency) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  const originalDay = date.getDate();
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1, 1);
  else if (frequency === 'quarterly') date.setMonth(date.getMonth() + 3, 1);
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1, date.getMonth(), 1);
  else return String(dateValue);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
