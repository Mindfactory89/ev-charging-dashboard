import { formatCurrency, formatDate, formatNumber, getActiveLocale, translate } from "../i18n/runtime.js";

export function euro(value) {
  return formatCurrency(value, { maximumFractionDigits: 2 });
}

export function num(value, digits = 1) {
  return formatNumber(value, { maximumFractionDigits: digits });
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
  return formatDate(value);
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
  const locale = getActiveLocale();
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return translate(locale, "formatters.noData");
  if (numeric >= 80) return translate(locale, "formatters.efficiency.top");
  if (numeric >= 65) return translate(locale, "formatters.efficiency.good");
  if (numeric >= 50) return translate(locale, "formatters.efficiency.solid");
  return translate(locale, "formatters.efficiency.low");
}
