import { getLocation, isNativeShell, readQueryParam } from "../platform/runtime.js";

const demoByQuery = readQueryParam("demo") === "1";
const ENV_DEMO_HOST_PREFIXES = String(import.meta.env.VITE_DEMO_HOST_PREFIX || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const demoByHost = (() => {
  const hostname = String(getLocation()?.hostname || "").trim().toLowerCase();
  if (!hostname || !ENV_DEMO_HOST_PREFIXES.length) return false;
  return ENV_DEMO_HOST_PREFIXES.some((prefix) => hostname === prefix || hostname.startsWith(prefix));
})();

const ENV_API_BASE = (import.meta.env.VITE_API_BASE || "").trim();
const ENV_MOBILE_API_BASE = (import.meta.env.VITE_MOBILE_API_BASE || "").trim();

export const isDemoMode = demoByQuery || demoByHost;

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const explicitBase = normalizeBaseUrl(ENV_MOBILE_API_BASE || ENV_API_BASE);
  if (explicitBase) return explicitBase;

  const location = getLocation();
  const protocol = String(location?.protocol || "");
  const hostname = String(location?.hostname || "").trim();

  if (!hostname || isNativeShell()) return "";
  if (protocol !== "http:" && protocol !== "https:") return "";

  return `${protocol}//${hostname}:18800`;
}

export function getApiBaseError() {
  if (getApiBase()) return "";

  if (isNativeShell()) {
    return "Mobile Build ohne API-Basis. Setze VITE_MOBILE_API_BASE oder VITE_API_BASE auf deinen HTTPS-Endpunkt.";
  }

  return "API-Basis konnte nicht automatisch ermittelt werden.";
}

function requireApiBase() {
  const base = getApiBase();
  if (base) return base;
  throw new Error(getApiBaseError());
}

function buildApiUrl(path) {
  return `${requireApiBase()}${path}`;
}

export function buildOptionalApiUrl(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : null;
}

export async function asJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `${response.status} ${response.statusText}`);
  return data;
}

export async function fetchApiJson(path) {
  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  return asJson(response);
}

export async function postJson(path, payload) {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return asJson(response);
}

export async function patchJson(path, payload) {
  const response = await fetch(buildApiUrl(path), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return asJson(response);
}

export async function deleteJson(path) {
  const response = await fetch(buildApiUrl(path), {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Delete failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json().catch(() => ({ ok: true }));
}
