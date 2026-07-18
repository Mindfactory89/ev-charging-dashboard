const dashboardBundleCache = new Map();

export function dashboardCacheKey(year, mode = "real", scopeKey = "") {
  const base = `${mode}:${Number(year) || 2026}`;
  return scopeKey ? `${base}:${encodeURIComponent(scopeKey)}` : base;
}

export function getDashboardCacheEntry(key) {
  return dashboardBundleCache.get(key);
}

export function setDashboardCacheValue(key, value) {
  dashboardBundleCache.set(key, { value, promise: Promise.resolve(value) });
  return value;
}

export function setDashboardCachePromise(key, promise) {
  dashboardBundleCache.set(key, { value: null, promise });
}

export function deleteDashboardCacheEntry(key) {
  dashboardBundleCache.delete(key);
}

export function invalidateDashboardBundleCache(mode, year = null) {
  if (year == null) {
    if (mode == null) {
      dashboardBundleCache.clear();
      return;
    }

    for (const key of dashboardBundleCache.keys()) {
      if (key.startsWith(`${mode}:`)) dashboardBundleCache.delete(key);
    }
    return;
  }

  const exactKey = dashboardCacheKey(year, mode || "real");
  for (const key of dashboardBundleCache.keys()) {
    if (key === exactKey || key.startsWith(`${exactKey}:`)) dashboardBundleCache.delete(key);
  }
}
