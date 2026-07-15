import test from "node:test";
import assert from "node:assert/strict";
import {
  completeOnboarding,
  ONBOARDING_STORAGE_KEY,
  readOnboardingState,
  resetOnboarding,
  shouldShowOnboarding,
} from "../src/app/onboardingState.js";

function createWindow(search = "?demo=1") {
  const storage = new Map();
  const calls = [];
  const win = {
    location: { pathname: "/", search, hash: "" },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    history: {
      replaceState(state, _title, url) {
        calls.push({ state, url });
        const parsed = new URL(url, "http://localhost");
        win.location.search = parsed.search;
      },
    },
  };
  return { calls, storage, window: win };
}

test("new installations show onboarding and completed installations stay quiet", () => {
  const browser = createWindow();
  assert.equal(shouldShowOnboarding(browser.window), true);
  assert.equal(readOnboardingState(browser.window).status, "new");

  completeOnboarding(browser.window, "2026-07-15T12:00:00.000Z");

  assert.equal(shouldShowOnboarding(browser.window), false);
  assert.deepEqual(readOnboardingState(browser.window), {
    status: "completed",
    completedAt: "2026-07-15T12:00:00.000Z",
  });
  assert.match(browser.storage.get(ONBOARDING_STORAGE_KEY), /completed/);
});

test("replay query forces onboarding and is removed after completion", () => {
  const browser = createWindow("?demo=1&onboarding=1&screen=analysis");
  completeOnboarding(browser.window);

  assert.equal(shouldShowOnboarding(browser.window), false);
  assert.equal(browser.calls.length, 1);
  assert.doesNotMatch(browser.calls[0].url, /onboarding=/);
  assert.match(browser.calls[0].url, /screen=analysis/);
});

test("resetting onboarding enables a future first-run experience", () => {
  const browser = createWindow();
  completeOnboarding(browser.window);
  resetOnboarding(browser.window);
  assert.equal(shouldShowOnboarding(browser.window), true);
});
