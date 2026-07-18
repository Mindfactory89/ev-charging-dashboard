export function isStandalonePwa(windowTarget = typeof window !== "undefined" ? window : null) {
  if (!windowTarget) return false;
  return Boolean(
    windowTarget.matchMedia?.("(display-mode: standalone)")?.matches
      || windowTarget.navigator?.standalone
  );
}

export function readPwaRuntimeState({
  navigatorTarget = typeof navigator !== "undefined" ? navigator : null,
  windowTarget = typeof window !== "undefined" ? window : null,
} = {}) {
  return {
    installed: isStandalonePwa(windowTarget),
    online: navigatorTarget?.onLine !== false,
    supported: Boolean(windowTarget?.isSecureContext && navigatorTarget?.serviceWorker),
  };
}

export async function registerMobilityServiceWorker({
  navigatorTarget = typeof navigator !== "undefined" ? navigator : null,
  scriptUrl = "/sw.js",
} = {}) {
  if (!navigatorTarget?.serviceWorker?.register) return null;
  return navigatorTarget.serviceWorker.register(scriptUrl, { scope: "/" });
}

export async function requestPwaInstall(promptEvent) {
  if (!promptEvent?.prompt) return { accepted: false, outcome: "unavailable" };
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  return {
    accepted: choice?.outcome === "accepted",
    outcome: choice?.outcome || "dismissed",
  };
}

export function activateWaitingServiceWorker(registration) {
  if (!registration?.waiting?.postMessage) return false;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
