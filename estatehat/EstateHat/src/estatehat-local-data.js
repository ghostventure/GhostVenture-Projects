export const LOCAL_DATA_CATEGORIES = Object.freeze({
  tasks: "Personal tasks",
  finances: "Financial scenarios",
  listings: "Listing collections and price alerts",
  checklists: "Property checklists",
  offers: "Offer drafts",
  appointments: "Appointments",
  notifications: "Notification settings and read state",
});

export function getProfileStorageKeys(userKey) {
  const safe = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  return {
    tasks: [`estatehat-personal-tasks-v1-${safe}`],
    finances: [`estatehat-finance-scenarios-v1-${safe}`],
    listings: [`estatehat-listing-collections-v1-${safe}`, `estatehat-price-watches-v1-${safe}`],
    checklists: [`estatehat-contingencies-v1-${safe}`],
    offers: [`estatehat-offers-v1-${safe}`],
    appointments: [`estatehat-tours-v1-${safe}`],
    notifications: [`estatehat-read-notifications-v1-${safe}`, `estatehat-dismissed-notifications-v1-${safe}`, `estatehat-notification-preferences-v1-${safe}`, `estatehat-vault-uploads-v1-${safe}`],
  };
}

export function summarizeProfileLocalData(storage, userKey) {
  const keys = getProfileStorageKeys(userKey);
  return Object.entries(keys).map(([category, names]) => {
    const entries = names.map((key) => ({ key, value: storage.getItem(key) })).filter((item) => item.value !== null);
    return { category, label: LOCAL_DATA_CATEGORIES[category], keys: entries.length, bytes: entries.reduce((total, item) => total + item.key.length + item.value.length, 0) };
  });
}

export function exportProfileLocalData(storage, userKey, exportedAt = new Date().toISOString()) {
  const keys = getProfileStorageKeys(userKey);
  const data = Object.fromEntries(Object.entries(keys).map(([category, names]) => [category, Object.fromEntries(names.map((key) => [key, storage.getItem(key)]).filter(([, value]) => value !== null))]));
  return JSON.stringify({ schemaVersion: 1, exportedAt, scope: "This browser and this account key only", data }, null, 2);
}

export function deleteProfileLocalData(storage, userKey, categories) {
  const keys = getProfileStorageKeys(userKey);
  const selected = [...new Set(Array.isArray(categories) ? categories : [])];
  if (!selected.length || selected.some((category) => !Object.hasOwn(keys, category))) throw new Error("Choose one or more supported data categories.");
  let removed = 0;
  for (const category of selected) for (const key of keys[category]) {
    if (storage.getItem(key) !== null) { storage.removeItem(key); removed += 1; }
  }
  return removed;
}
