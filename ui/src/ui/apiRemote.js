import { buildOptionalApiUrl, deleteJson, fetchApiJson, patchJson, postJson } from "./apiRuntime.js";

export function getStatsRemote(year = 2026) {
  return fetchApiJson(`/api/stats?year=${encodeURIComponent(year)}`);
}

export function getDashboardBundleRemote(year = 2026) {
  return fetchApiJson(`/api/dashboard?year=${encodeURIComponent(year)}`);
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

export function getMonthlyCsvUrlRemote(year = 2026) {
  return buildOptionalApiUrl(`/api/export/monthly.csv?year=${encodeURIComponent(year)}`);
}

export function getSessionsCsvUrlRemote(year = 2026) {
  return buildOptionalApiUrl(`/api/export/sessions.csv?year=${encodeURIComponent(year)}`);
}

export function getSeasonsCsvUrlRemote(year = 2026) {
  return buildOptionalApiUrl(`/api/export/seasons.csv?year=${encodeURIComponent(year)}`);
}
