const STORAGE_KEY = "mobility-dashboard-ui-state-v2";

function parseSearch() {
  try {
    return new URLSearchParams(window.location.search || "");
  } catch {
    return new URLSearchParams();
  }
}

function readStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function readYear(value, fallback = 2026) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : fallback;
}

function normalizeHistoryFilters(value = {}) {
  return {
    month: value?.month != null && value.month !== "" ? Number(value.month) : null,
    provider: readString(value?.provider, ""),
    location: readString(value?.location, ""),
    vehicle: readString(value?.vehicle, ""),
    tag: readString(value?.tag, ""),
  };
}

export function readPersistedUiState() {
  if (typeof window === "undefined") {
    return {
      year: 2026,
      activeScreen: "overview",
      overviewMode: "cost",
      analysisMode: "compare",
      historyFilters: normalizeHistoryFilters(),
    };
  }

  const search = parseSearch();
  const stored = readStorage();

  return {
    year: readYear(search.get("year") ?? stored.year, 2026),
    activeScreen: readString(search.get("screen") ?? stored.activeScreen, "overview"),
    overviewMode: readString(search.get("overview") ?? stored.overviewMode, "cost"),
    analysisMode: readString(search.get("analysis") ?? stored.analysisMode, "compare"),
    historyFilters: normalizeHistoryFilters({
      month: search.get("month") ?? stored.historyFilters?.month,
      provider: search.get("provider") ?? stored.historyFilters?.provider,
      location: search.get("location") ?? stored.historyFilters?.location,
      vehicle: search.get("vehicle") ?? stored.historyFilters?.vehicle,
      tag: search.get("tag") ?? stored.historyFilters?.tag,
    }),
  };
}

export function writePersistedUiState(state) {
  if (typeof window === "undefined") return;

  const payload = {
    year: readYear(state?.year, 2026),
    activeScreen: readString(state?.activeScreen, "overview"),
    overviewMode: readString(state?.overviewMode, "cost"),
    analysisMode: readString(state?.analysisMode, "compare"),
    historyFilters: normalizeHistoryFilters(state?.historyFilters),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}

  try {
    const params = new URLSearchParams(window.location.search || "");
    params.set("year", String(payload.year));
    params.set("screen", payload.activeScreen);
    params.set("overview", payload.overviewMode);
    params.set("analysis", payload.analysisMode);

    const filterEntries = [
      ["month", payload.historyFilters.month != null ? String(payload.historyFilters.month) : ""],
      ["provider", payload.historyFilters.provider],
      ["location", payload.historyFilters.location],
      ["vehicle", payload.historyFilters.vehicle],
      ["tag", payload.historyFilters.tag],
    ];

    for (const [key, value] of filterEntries) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);
  } catch {}
}

export function mergeHistoryFilters(current, updates) {
  return normalizeHistoryFilters({
    ...(current || {}),
    ...(updates || {}),
  });
}

export function clearHistoryFilters() {
  return normalizeHistoryFilters();
}
