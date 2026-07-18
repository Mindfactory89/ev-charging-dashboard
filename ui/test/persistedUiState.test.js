import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPersistedUiState() {
  const moduleUrl = pathToFileURL(path.resolve("src/app/persistedUiState.js"));
  return import(`${moduleUrl.href}?test=${Date.now()}-${Math.random()}`);
}

function createBrowserWindow(search = "?demo=1") {
  const calls = [];
  const storage = new Map();
  const win = {
    location: {
      pathname: "/",
      search,
      hash: "",
    },
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    history: {
      pushState(state, _title, url) {
        calls.push({ method: "push", state, url });
        applyUrl(url);
      },
      replaceState(state, _title, url) {
        calls.push({ method: "replace", state, url });
        applyUrl(url);
      },
    },
  };

  function applyUrl(url) {
    const parsed = new URL(url, "http://localhost");
    win.location.pathname = parsed.pathname;
    win.location.search = parsed.search;
    win.location.hash = parsed.hash;
  }

  return { calls, window: win };
}

test("writePersistedUiState can push navigational URL state without duplicate entries", async () => {
  const previousWindow = globalThis.window;
  const browser = createBrowserWindow("?demo=1");
  globalThis.window = browser.window;

  try {
    const { readPersistedUiState, writePersistedUiState } = await loadPersistedUiState();

    writePersistedUiState({
      year: 2031,
      activeScreen: "analysis",
      overviewMode: "cost",
      analysisMode: "time",
      historyFilters: { month: 5, provider: "Ionity", query: "Hamburg", sort: "cost_desc" },
      historyMode: "push",
    });

    assert.equal(browser.calls.length, 1);
    assert.equal(browser.calls[0].method, "push");
    assert.match(browser.calls[0].url, /demo=1/);
    assert.match(browser.calls[0].url, /screen=analysis/);
    assert.match(browser.calls[0].url, /analysis=time/);
    assert.match(browser.calls[0].url, /month=5/);
    assert.match(browser.calls[0].url, /q=Hamburg/);
    assert.match(browser.calls[0].url, /sort=cost_desc/);

    const restored = readPersistedUiState();
    assert.equal(restored.year, 2031);
    assert.equal(restored.activeScreen, "analysis");
    assert.equal(restored.analysisMode, "time");
    assert.equal(restored.historyFilters.month, 5);
    assert.equal(restored.historyFilters.provider, "Ionity");
    assert.equal(restored.historyFilters.query, "Hamburg");
    assert.equal(restored.historyFilters.sort, "cost_desc");

    writePersistedUiState({
      year: 2031,
      activeScreen: "analysis",
      overviewMode: "cost",
      analysisMode: "time",
      historyFilters: { month: 5, provider: "Ionity", query: "Hamburg", sort: "cost_desc" },
      historyMode: "push",
    });

    assert.equal(browser.calls.length, 1);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("writePersistedUiState replaces synchronization state by default", async () => {
  const previousWindow = globalThis.window;
  const browser = createBrowserWindow("?demo=1");
  globalThis.window = browser.window;

  try {
    const { writePersistedUiState } = await loadPersistedUiState();

    writePersistedUiState({
      year: 2032,
      activeScreen: "overview",
      overviewMode: "forecast",
      analysisMode: "compare",
      historyFilters: {},
    });

    assert.equal(browser.calls.length, 1);
    assert.equal(browser.calls[0].method, "replace");
    assert.match(browser.calls[0].url, /overview=forecast/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("unknown screen routes fall back to the overview shell", async () => {
  const previousWindow = globalThis.window;
  const browser = createBrowserWindow("?demo=1&screen=unknown");
  globalThis.window = browser.window;

  try {
    const { readPersistedUiState, writePersistedUiState } = await loadPersistedUiState();

    assert.equal(readPersistedUiState().activeScreen, "overview");

    writePersistedUiState({
      year: 2026,
      activeScreen: "not-a-screen",
      overviewMode: "cost",
      analysisMode: "compare",
      historyFilters: {},
    });

    assert.match(browser.calls[0].url, /screen=overview/);
  } finally {
    globalThis.window = previousWindow;
  }
});
