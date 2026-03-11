export function euro(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function num(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "–";
  return numeric.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export function minutesFromSeconds(seconds) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return "–";
  return `${Math.round(numeric / 60)} min`;
}

export function sessionPricePerKwh(session) {
  const direct = Number(session?.price_per_kwh);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const energy = Number(session?.energy_kwh);
  const totalCost = Number(session?.total_cost);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(totalCost) || totalCost < 0) return null;
  return totalCost / energy;
}

export function datumDE(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "–";
    return date.toLocaleDateString("de-DE");
  } catch {
    return "–";
  }
}

export function calcTrend(currentVal, prevVal) {
  const current = Number(currentVal);
  const previous = Number(prevVal);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  const delta = current - previous;
  return {
    delta,
    pct: delta / previous,
  };
}

export function trendPctLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${Math.round(numeric * 100)}%`;
}

export function scoreTone(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "rgba(255,255,255,0.78)";
  if (numeric >= 80) return "rgba(86, 214, 156, 0.95)";
  if (numeric >= 65) return "rgba(216, 140, 78, 0.95)";
  if (numeric >= 50) return "rgba(255, 210, 120, 0.95)";
  return "rgba(255, 132, 132, 0.95)";
}

export function scoreLabel(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "Keine Daten";
  if (numeric >= 80) return "Sehr effizient";
  if (numeric >= 65) return "Effizient";
  if (numeric >= 50) return "Solide";
  return "Optimierungspotenzial";
}
