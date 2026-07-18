import test from "node:test";
import assert from "node:assert/strict";
import {
  activateWaitingServiceWorker,
  isStandalonePwa,
  readPwaRuntimeState,
  requestPwaInstall,
} from "../src/platform/pwa.js";

test("PWA runtime state distinguishes online, installed, and supported modes", () => {
  const windowTarget = {
    isSecureContext: true,
    matchMedia: () => ({ matches: true }),
    navigator: {},
  };
  const navigatorTarget = { onLine: false, serviceWorker: {} };

  assert.equal(isStandalonePwa(windowTarget), true);
  assert.deepEqual(readPwaRuntimeState({ navigatorTarget, windowTarget }), {
    installed: true,
    online: false,
    supported: true,
  });
});

test("PWA install and update helpers keep browser events explicit", async () => {
  let prompted = false;
  const installResult = await requestPwaInstall({
    prompt: async () => { prompted = true; },
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  assert.equal(prompted, true);
  assert.deepEqual(installResult, { accepted: true, outcome: "accepted" });

  let message = null;
  assert.equal(activateWaitingServiceWorker({ waiting: { postMessage: (value) => { message = value; } } }), true);
  assert.deepEqual(message, { type: "SKIP_WAITING" });
  assert.equal(activateWaitingServiceWorker(null), false);
});
