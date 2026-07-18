function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function confidenceForSample(sampleSize) {
  const count = Math.max(0, Number(sampleSize) || 0);
  if (count >= 15) return "high";
  if (count >= 5) return "medium";
  return "low";
}

export function buildActionExplanation(action, { sessions = [], stats = null } = {}) {
  const sampleSize = Array.isArray(sessions) ? sessions.length : 0;
  const annualEnergy = finite(stats?.total_energy_kwh);
  const delta = finite(action?.metric?.delta);
  let savingsEur = null;
  let basis = "yearData";

  if (action?.kind === "providerOpportunity" && annualEnergy != null && delta != null) {
    savingsEur = Math.max(0, annualEnergy * delta);
    basis = "providerComparison";
  } else if (action?.kind === "goalBudget") {
    basis = "budgetGoal";
  } else if (action?.kind === "goalPrice") {
    basis = "priceGoal";
  } else if (action?.kind === "goalEfficiency") {
    basis = "efficiencyScore";
  } else if (action?.kind === "outliers") {
    basis = "outlierSignals";
  } else if (action?.kind === "highSocShare") {
    basis = "socSessions";
  }

  return {
    basis,
    confidence: confidenceForSample(sampleSize),
    sampleSize,
    savingsEur: savingsEur == null ? null : Number(savingsEur.toFixed(2)),
  };
}

export function buildGoalExplanation(item, { sessions = [] } = {}) {
  const sampleSize = Array.isArray(sessions) ? sessions.length : 0;
  return {
    basis: item?.key === "efficiency" ? "efficiencyScore" : item?.key === "price" ? "priceGoal" : "budgetGoal",
    confidence: confidenceForSample(sampleSize),
    sampleSize,
    savingsEur: null,
  };
}
