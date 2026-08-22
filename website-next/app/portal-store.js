export const portalAccountsKey = 'overhead.sharedUsers.v1'
export const portalSessionKey = 'overhead.portalSession.v1'
export const portalTasksKey = 'overhead.portalTasks.v1'

export function timestamp() {
  return new Date().toISOString()
}

export function normalizeEmail(value) {
  return value.trim().toLowerCase()
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function getAccounts() {
  try {
    const value = JSON.parse(window.localStorage.getItem(portalAccountsKey) || '{}')
    return Array.isArray(value.user_profiles) ? value.user_profiles : []
  } catch {
    return []
  }
}

export function saveAccounts(accounts) {
  window.localStorage.setItem(portalAccountsKey, JSON.stringify({
    schema: 'overhead-shared-users-v1',
    user_profiles: accounts,
    updated_at: timestamp(),
  }))
}

export function getSession() {
  try {
    return JSON.parse(window.localStorage.getItem(portalSessionKey) || 'null')
  } catch {
    return null
  }
}

export function saveSession(account) {
  window.localStorage.setItem(portalSessionKey, JSON.stringify({
    accountId: account.id,
    email: account.email,
    startedAt: timestamp(),
  }))
}

export function clearSession() {
  window.localStorage.removeItem(portalSessionKey)
}

export function getTasks(accountId) {
  try {
    const taskStore = JSON.parse(window.localStorage.getItem(portalTasksKey) || '{}')
    return Array.isArray(taskStore[accountId]) ? taskStore[accountId] : []
  } catch {
    return []
  }
}

export function saveTasks(accountId, tasks) {
  let taskStore = {}
  try {
    taskStore = JSON.parse(window.localStorage.getItem(portalTasksKey) || '{}')
    if (Array.isArray(taskStore)) taskStore = {}
  } catch {
    taskStore = {}
  }
  window.localStorage.setItem(portalTasksKey, JSON.stringify({ ...taskStore, [accountId]: tasks }))
}

export async function hashSecret(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
