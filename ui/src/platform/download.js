import { getDocument, getNavigator, isNativeShell, openExternalUrl } from "./runtime.js";

function parseDispositionFilename(disposition) {
  const raw = String(disposition || "");
  if (!raw) return "";

  const utfMatch = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const plainMatch = raw.match(/filename\s*=\s*"([^"]+)"/i) || raw.match(/filename\s*=\s*([^;]+)/i);
  return plainMatch?.[1]?.trim() || "";
}

function inferFileName(url) {
  try {
    const resolved = new URL(url, "http://local.invalid");
    const candidate = resolved.pathname.split("/").filter(Boolean).pop();
    return candidate || "download";
  } catch {
    return "download";
  }
}

function sanitizeFileName(value) {
  return String(value || "download")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
}

async function tryShareFile(blob, fileName, title) {
  const nav = getNavigator();
  if (typeof nav?.share !== "function" || typeof File !== "function") return false;

  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const payload = { files: [file], title };

  if (typeof nav.canShare === "function") {
    try {
      if (!nav.canShare(payload)) return false;
    } catch {
      return false;
    }
  }

  try {
    await nav.share(payload);
    return true;
  } catch (error) {
    if (error?.name === "AbortError") return true;
    throw error;
  }
}

function triggerBrowserDownload(blob, fileName) {
  const doc = getDocument();
  if (!doc?.body || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;

  const href = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";

  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  if (typeof URL.revokeObjectURL === "function") {
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return true;
}

export async function downloadFileFromUrl(url, options = {}) {
  if (!url) return false;

  const response = await fetch(url, {
    headers: {
      Accept: options.accept || "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen (${response.status} ${response.statusText})`);
  }

  const blob = await response.blob();
  const responseName = parseDispositionFilename(response.headers.get("Content-Disposition"));
  const fileName = sanitizeFileName(options.fileName || responseName || inferFileName(url));

  if (await tryShareFile(blob, fileName, options.title || fileName)) {
    return true;
  }

  if (!isNativeShell() && triggerBrowserDownload(blob, fileName)) {
    return true;
  }

  return openExternalUrl(url);
}
