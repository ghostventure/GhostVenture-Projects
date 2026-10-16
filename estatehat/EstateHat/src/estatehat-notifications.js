export const NOTIFICATION_TYPES = Object.freeze(["offer", "task", "document"]);

export function normalizeNotificationPreferences(value) {
  return Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, value?.[type] !== false]));
}

export function toggleNotificationPreference(value, type) {
  if (!NOTIFICATION_TYPES.includes(type)) throw new Error("Choose a supported notification type.");
  const current = normalizeNotificationPreferences(value);
  return { ...current, [type]: !current[type] };
}

export function applyNotificationPreferences(notifications, preferences) {
  const enabled = normalizeNotificationPreferences(preferences);
  return (Array.isArray(notifications) ? notifications : []).filter((item) => enabled[item.type] !== false);
}

export function countUnreadNotifications(notifications, readIds) {
  const read = new Set(Array.isArray(readIds) ? readIds : []);
  return (Array.isArray(notifications) ? notifications : []).filter((item) => !read.has(item.id)).length;
}

export function markNotificationsRead(notifications, readIds = []) {
  return [...new Set([...(Array.isArray(readIds) ? readIds : []), ...(Array.isArray(notifications) ? notifications.map((item) => item.id) : [])])];
}

export function removeReadNotifications(notifications, readIds = []) {
  const read = new Set(Array.isArray(readIds) ? readIds : []);
  return (Array.isArray(notifications) ? notifications : []).filter((item) => !read.has(item.id));
}
