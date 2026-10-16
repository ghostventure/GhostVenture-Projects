const LOCAL_KEY_PREFIXES = ['cltch_', 'cltch:', 'cltch-'];

function isCltchKey(key) {
  const normalized = String(key || '').toLowerCase();
  return LOCAL_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** Remove only browser-local CLTCH keys and named caches; Firebase auth/account data is not targeted. */
export async function clearLocalCltchData({ localStorage, sessionStorage, cacheStorage } = {}) {
  let removed = 0;
  let failures = 0;

  for (const storage of [localStorage, sessionStorage]) {
    if (!storage) continue;
    try {
      const matchingKeys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (isCltchKey(key)) matchingKeys.push(key);
      }
      for (const key of matchingKeys) {
        storage.removeItem(key);
        removed += 1;
      }
    } catch {
      failures += 1;
    }
  }

  if (cacheStorage) {
    try {
      const names = await cacheStorage.keys();
      const matches = names.filter(isCltchKey);
      const results = await Promise.all(matches.map((name) => cacheStorage.delete(name)));
      removed += results.filter(Boolean).length;
      failures += results.filter((result) => !result).length;
    } catch {
      failures += 1;
    }
  }

  return { removed, failures };
}
