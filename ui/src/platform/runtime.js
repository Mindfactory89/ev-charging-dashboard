const NATIVE_PROTOCOLS = new Set(["capacitor:", "ionic:", "file:", "app:"]);
const VIEWPORT_CLEANUP_KEY = "__mobilityViewportCleanup";

export function getWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function getDocument() {
  return typeof document !== "undefined" ? document : null;
}

export function getNavigator() {
  return typeof navigator !== "undefined" ? navigator : null;
}

export function getLocation() {
  return getWindow()?.location ?? null;
}

export function readQueryParam(name) {
  if (!name) return null;
  return new URLSearchParams(getLocation()?.search || "").get(name);
}

export function isNativeShell() {
  const win = getWindow();

  try {
    if (typeof win?.Capacitor?.isNativePlatform === "function") {
      return !!win.Capacitor.isNativePlatform();
    }
  } catch {
    // Ignore Capacitor bridge issues and fall back to protocol sniffing.
  }

  return NATIVE_PROTOCOLS.has(String(getLocation()?.protocol || ""));
}

export function hasHttpOrigin() {
  const protocol = String(getLocation()?.protocol || "");
  return protocol === "http:" || protocol === "https:";
}

export function getWindowOrigin() {
  const location = getLocation();
  if (!location || !hasHttpOrigin()) return "";
  return `${location.protocol}//${location.host}`;
}

export function createPlatformImage() {
  const ImageCtor = getWindow()?.Image;
  return typeof ImageCtor === "function" ? new ImageCtor() : null;
}

export function openExternalUrl(url, target = "_blank") {
  if (!url) return false;

  const win = getWindow();
  if (!win) return false;

  try {
    const opened = win.open(url, target, "noopener,noreferrer");
    if (opened) return true;
  } catch {
    // Fall back to same-window navigation when popups are blocked.
  }

  try {
    win.location.assign(url);
    return true;
  } catch {
    return false;
  }
}

export function reloadCurrentPage() {
  try {
    getWindow()?.location?.reload?.();
  } catch {
    // No-op outside the browser.
  }
}

export function confirmAction(message) {
  const text = String(message || "");
  const confirmFn = getWindow()?.confirm;
  if (typeof confirmFn === "function") return confirmFn(text);
  return true;
}

export function showAlert(message) {
  const text = String(message || "");
  const alertFn = getWindow()?.alert;
  if (typeof alertFn === "function") {
    alertFn(text);
    return;
  }

  if (text) console.warn(text);
}

function applyBodyClasses() {
  const doc = getDocument();
  const win = getWindow();
  const nav = getNavigator();

  if (!doc?.body) return;

  const hasTouch = Boolean("ontouchstart" in (win || {})) || Number(nav?.maxTouchPoints || 0) > 0;

  doc.body.classList.toggle("native-shell", isNativeShell());
  doc.body.classList.toggle("touch-shell", hasTouch);
}

function installViewportMetrics() {
  const doc = getDocument();
  const win = getWindow();

  if (!doc?.documentElement || !win) return () => {};

  const root = doc.documentElement;
  const viewport = win.visualViewport;

  const applyMetrics = () => {
    const height = Math.round(viewport?.height || win.innerHeight || 0);
    const width = Math.round(viewport?.width || win.innerWidth || 0);

    if (height > 0) root.style.setProperty("--app-height", `${height}px`);
    if (width > 0) root.style.setProperty("--app-width", `${width}px`);

    applyBodyClasses();
  };

  applyMetrics();

  win.addEventListener("resize", applyMetrics);
  win.addEventListener("orientationchange", applyMetrics);
  viewport?.addEventListener?.("resize", applyMetrics);

  return () => {
    win.removeEventListener("resize", applyMetrics);
    win.removeEventListener("orientationchange", applyMetrics);
    viewport?.removeEventListener?.("resize", applyMetrics);
  };
}

export function bootstrapRuntimeShell() {
  applyBodyClasses();

  const win = getWindow();
  if (!win) return;

  if (typeof win[VIEWPORT_CLEANUP_KEY] === "function") {
    win[VIEWPORT_CLEANUP_KEY]();
  }

  win[VIEWPORT_CLEANUP_KEY] = installViewportMetrics();
}
