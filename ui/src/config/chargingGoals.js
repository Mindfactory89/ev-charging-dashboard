import { getWindow } from "../platform/runtime.js";

export const CHARGING_GOALS_STORAGE_KEY = "mobility.chargingGoals.v1";

const GOAL_LIMITS = {
  annualBudgetEur: { min: 50, max: 100000, digits: 2 },
  maxAveragePricePerKwh: { min: 0.05, max: 5, digits: 3 },
  minEfficiencyScore: { min: 1, max: 100, digits: 1 },
};

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function optionalNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalizeGoalValue(key, value) {
  const number = optionalNumber(value);
  if (number == null) return null;
  return Number(number.toFixed(GOAL_LIMITS[key].digits));
}

export function validateChargingGoalsDraft(draft = {}) {
  const errors = {};
  const normalized = {};

  Object.entries(GOAL_LIMITS).forEach(([key, limits]) => {
    const rawValue = draft?.[key];
    const number = optionalNumber(rawValue);
    normalized[key] = number == null ? null : normalizeGoalValue(key, number);
    if (rawValue != null && rawValue !== "" && (number == null || number < limits.min || number > limits.max)) {
      errors[key] = key;
    }
  });

  if (!Object.values(normalized).some((value) => value != null)) errors.form = "empty";
  return { valid: Object.keys(errors).length === 0, errors, normalized };
}

function cleanChargingGoals(goals) {
  const validation = validateChargingGoalsDraft(goals);
  if (!validation.valid) return null;
  return {
    ...validation.normalized,
    updatedAt: String(goals?.updatedAt || new Date().toISOString()),
  };
}

export function readChargingGoals(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(CHARGING_GOALS_STORAGE_KEY);
    return raw ? cleanChargingGoals(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveChargingGoals(draft, target) {
  const validation = validateChargingGoalsDraft(draft);
  if (!validation.valid) return { goals: null, errors: validation.errors };
  const goals = { ...validation.normalized, updatedAt: new Date().toISOString() };
  try {
    storageTarget(target)?.setItem?.(CHARGING_GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // Local storage may be unavailable in restricted browser contexts.
  }
  return { goals, errors: {} };
}

export function clearChargingGoals(target) {
  try {
    storageTarget(target)?.removeItem?.(CHARGING_GOALS_STORAGE_KEY);
  } catch {
    // Keep the UI usable when storage is unavailable.
  }
  return null;
}

export function countChargingGoals(goals) {
  return Object.keys(GOAL_LIMITS).filter((key) => goals?.[key] != null).length;
}

function readMetric(value, { allowZero = true } = {}) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) return null;
  return number;
}

export function buildChargingGoalProgress(goals, { stats = null, efficiency = null } = {}) {
  if (!goals) return [];

  const definitions = [
    {
      key: "budget",
      target: goals.annualBudgetEur,
      actual: readMetric(stats?.total_cost),
      direction: "max",
    },
    {
      key: "price",
      target: goals.maxAveragePricePerKwh,
      actual: readMetric(stats?.avg_price_per_kwh, { allowZero: false }),
      direction: "max",
    },
    {
      key: "efficiency",
      target: goals.minEfficiencyScore,
      actual: readMetric(efficiency?.overall_score),
      direction: "min",
    },
  ];

  return definitions
    .filter((definition) => definition.target != null)
    .map((definition) => {
      const available = definition.actual != null;
      const met = available
        ? definition.direction === "max"
          ? definition.actual <= definition.target
          : definition.actual >= definition.target
        : null;
      const rawProgress = !available
        ? 0
        : definition.key === "budget"
          ? (definition.actual / definition.target) * 100
          : definition.direction === "max"
            ? (definition.target / Math.max(definition.actual, definition.target)) * 100
            : (definition.actual / definition.target) * 100;

      return {
        ...definition,
        available,
        delta: available ? definition.actual - definition.target : null,
        met,
        progress: Math.max(0, Math.min(100, rawProgress)),
      };
    });
}
