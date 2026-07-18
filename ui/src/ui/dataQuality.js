import { getWindow } from "../platform/runtime.js";
import { effectivePricePerKwh } from "./sessionEditForm.js";

export const DATA_QUALITY_STORAGE_KEY = "mobility.dataQuality.v1";

const MAX_YEARS = 8;
const MAX_REVIEWED = 300;

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function sessionId(session) {
  return String(session?.id ?? "").trim();
}

function normalizedText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function rounded(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "";
}

function duplicateSignature(session) {
  return [
    String(session?.date || "").slice(0, 10),
    normalizedText(session?.provider),
    normalizedText(session?.location),
    rounded(session?.energy_kwh, 2),
    rounded(session?.total_cost, 2),
    rounded(session?.soc_start, 0),
    rounded(session?.soc_end, 0),
  ].join("|");
}

function cleanReviewed(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").slice(0, 120)).filter(Boolean))).slice(0, MAX_REVIEWED);
}

function readStore(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(DATA_QUALITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const years = parsed?.years && typeof parsed.years === "object" ? parsed.years : {};
    return { years };
  } catch {
    return { years: {} };
  }
}

function writeReviewed(year, reviewed, target) {
  const storage = storageTarget(target);
  const current = readStore(target);
  const key = String(Number(year));
  const entries = Object.entries({
    ...current.years,
    [key]: { reviewed: cleanReviewed(reviewed), updatedAt: new Date().toISOString() },
  })
    .filter(([entryYear]) => /^\d{4}$/.test(String(entryYear)))
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .slice(0, MAX_YEARS);
  const next = { years: Object.fromEntries(entries) };
  try {
    storage?.setItem?.(DATA_QUALITY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the data-quality workflow usable when local storage is unavailable.
  }
  return next.years[key]?.reviewed || [];
}

export function readDataQualityPreferences(year, target) {
  const key = String(Number(year));
  return { reviewed: cleanReviewed(readStore(target).years[key]?.reviewed) };
}

export function reviewDataQualityIssues(year, issueIds, target) {
  const current = readDataQualityPreferences(year, target).reviewed;
  return writeReviewed(year, [...current, ...(Array.isArray(issueIds) ? issueIds : [issueIds])], target);
}

export function restoreDataQualityIssue(year, issueId, target) {
  const current = readDataQualityPreferences(year, target).reviewed;
  return writeReviewed(year, current.filter((id) => id !== String(issueId)), target);
}

export function clearReviewedDataQualityIssues(year, target) {
  return writeReviewed(year, [], target);
}

export function buildDataQualityReport({ sessions = [], sessionOutliersById = {}, reviewed = [] } = {}) {
  const rows = Array.isArray(sessions) ? sessions : [];
  const reviewedSet = new Set(cleanReviewed(reviewed));
  const issues = [];
  const duplicateGroups = new Map();

  rows.forEach((session) => {
    const id = sessionId(session);
    if (!id) return;
    const missing = ["provider", "location", "vehicle"].filter((field) => !String(session?.[field] || "").trim());
    if (missing.length) {
      issues.push({
        id: `context-${id}`,
        kind: "context",
        severity: "warning",
        sessionId: id,
        date: session?.date || null,
        fields: missing,
      });
    }

    const metricFields = [];
    if (!Number.isFinite(Number(session?.duration_seconds)) || Number(session.duration_seconds) <= 0) metricFields.push("duration");
    if (effectivePricePerKwh(session) == null) metricFields.push("price");
    if (metricFields.length) {
      issues.push({
        id: `metrics-${id}`,
        kind: "metrics",
        severity: "warning",
        sessionId: id,
        date: session?.date || null,
        fields: metricFields,
      });
    }

    const outlier = sessionOutliersById?.[id];
    if (Number(outlier?.flag_count) > 0) {
      issues.push({
        id: `outlier-${id}`,
        kind: "outlier",
        severity: Number(outlier.flag_count) >= 2 ? "danger" : "warning",
        sessionId: id,
        date: session?.date || null,
        count: Number(outlier.flag_count),
      });
    }

    const signature = duplicateSignature(session);
    const group = duplicateGroups.get(signature) || [];
    group.push(session);
    duplicateGroups.set(signature, group);
  });

  const actualDuplicateGroups = [...duplicateGroups.values()].filter((group) => group.length > 1);
  actualDuplicateGroups.forEach((group) => {
    group.slice(1).forEach((session) => {
      const id = sessionId(session);
      issues.push({
        id: `duplicate-${id}`,
        kind: "duplicate",
        severity: "danger",
        sessionId: id,
        referenceSessionId: sessionId(group[0]),
        date: session?.date || null,
        count: group.length,
      });
    });
  });

  const severityOrder = { danger: 0, warning: 1, neutral: 2 };
  issues.sort((left, right) => (severityOrder[left.severity] ?? 3) - (severityOrder[right.severity] ?? 3)
    || String(right.date || "").localeCompare(String(left.date || "")));
  const affectedSessionIds = new Set(issues.map((issue) => issue.sessionId));
  const cleanCount = Math.max(rows.length - affectedSessionIds.size, 0);
  const score = rows.length ? Math.round((cleanCount / rows.length) * 100) : 100;
  const actionableIssues = issues.filter((issue) => !reviewedSet.has(issue.id));

  return {
    score,
    issues,
    actionableIssues,
    reviewedCount: issues.length - actionableIssues.length,
    metrics: {
      total: rows.length,
      clean: cleanCount,
      affected: affectedSessionIds.size,
      duplicateGroups: actualDuplicateGroups.length,
      context: issues.filter((issue) => issue.kind === "context").length,
      metrics: issues.filter((issue) => issue.kind === "metrics").length,
      outliers: issues.filter((issue) => issue.kind === "outlier").length,
    },
  };
}
