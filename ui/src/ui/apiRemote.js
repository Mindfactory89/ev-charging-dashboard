import { buildOptionalApiUrl, deleteJson, fetchApiJson, patchJson, postJson } from "./apiRuntime.js";

export function getStatsRemote(year = 2026) {
  return fetchApiJson(`/api/stats?year=${encodeURIComponent(year)}`);
}

export function getDashboardBundleRemote(year = 2026, vehicleScope = null) {
  const query = new URLSearchParams({ year: String(year) });
  if (vehicleScope?.id) query.set("vehicleProfileId", vehicleScope.id);
  if (vehicleScope?.name) query.set("vehicle", vehicleScope.name);
  return fetchApiJson(`/api/dashboard?${query.toString()}`);
}

export function getSessionsRemote(year = 2026) {
  return fetchApiJson(`/api/sessions?year=${encodeURIComponent(year)}`);
}

export function getMonthlyRemote(year = 2026) {
  return fetchApiJson(`/api/analytics/monthly?year=${encodeURIComponent(year)}`);
}

export function getSeasonsRemote(year = 2026) {
  return fetchApiJson(`/api/analytics/seasons?year=${encodeURIComponent(year)}`);
}

export function getEfficiencyRemote(year = 2026) {
  return fetchApiJson(`/api/analytics/efficiency?year=${encodeURIComponent(year)}`);
}

export function getOutliersRemote(year = 2026) {
  return fetchApiJson(`/api/analytics/outliers?year=${encodeURIComponent(year)}`);
}

export function createSessionRemote(payload) {
  return postJson("/api/sessions", payload);
}

export function updateSessionRemote(id, payload) {
  return patchJson(`/api/sessions/${encodeURIComponent(id)}`, payload);
}

export function deleteSessionRemote(id) {
  return deleteJson(`/api/sessions/${encodeURIComponent(id)}`);
}

export function checkReleaseUpdateRemote() {
  return fetchApiJson('/api/release/check');
}

export function installReleaseUpdateRemote(tagName, installToken) {
  return postJson('/api/release/install', { tagName }, {
    'X-Mobility-Release-Token': installToken || '',
  });
}

export function getReleaseInstallStatusRemote() {
  return fetchApiJson('/api/release/install/status');
}

export function getMonthlyCsvUrlRemote(year = 2026) {
  return buildOptionalApiUrl(`/api/export/monthly.csv?year=${encodeURIComponent(year)}`);
}

export function getSessionsCsvUrlRemote(year = 2026) {
  const query = year == null || year === "" ? "" : `?year=${encodeURIComponent(year)}`;
  return buildOptionalApiUrl(`/api/export/sessions.csv${query}`);
}

export function getSeasonsCsvUrlRemote(year = 2026) {
  return buildOptionalApiUrl(`/api/export/seasons.csv?year=${encodeURIComponent(year)}`);
}
