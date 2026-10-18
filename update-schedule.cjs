const UPDATE_INTERVAL_MS = 72 * 60 * 60 * 1000

function nextUpdateCheck(lastAttemptAt, now = Date.now()) {
  const last = Date.parse(lastAttemptAt)
  if (!Number.isFinite(last)) return now
  return last + UPDATE_INTERVAL_MS
}

module.exports = { UPDATE_INTERVAL_MS, nextUpdateCheck }
