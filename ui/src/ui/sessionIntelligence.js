import { getWeekdayLabels, parseSessionDate } from "./loadRhythm.js";
import { monthLabel } from "./monthLabels.js";
import { getActiveLocale, translate } from "../i18n/runtime.js";

const DRIVING_EFFICIENCY_TIERS = [
  { maxEnergyPer100Km: 15.0, key: "veryEfficient", emoji: "😄", tone: "mint" },
  { maxEnergyPer100Km: 16.5, key: "efficient", emoji: "🙂", tone: "frost" },
  { maxEnergyPer100Km: 18.0, key: "balanced", emoji: "😐", tone: "neutral" },
  { maxEnergyPer100Km: 19.5, key: "optimizable", emoji: "😕", tone: "warm" },
  { maxEnergyPer100Km: Number.POSITIVE_INFINITY, key: "highConsumption", emoji: "😬", tone: "danger" },
];

function t(key, values = {}, locale = getActiveLocale()) {
  return translate(locale, key, values);
}

function translatedTier(tier, locale = getActiveLocale()) {
  if (!tier) return null;
  return {
    ...tier,
    label: t(`mobilityProfile.tiers.${tier.key}`, {}, locale),
  };
}

function round(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** digits;
  return Math.round(num * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drivingEfficiencyTier(avgEnergyPer100Km) {
  if (!Number.isFinite(avgEnergyPer100Km) || avgEnergyPer100Km <= 0) return null;
  return (
    DRIVING_EFFICIENCY_TIERS.find((tier) => avgEnergyPer100Km <= tier.maxEnergyPer100Km) ||
    DRIVING_EFFICIENCY_TIERS[DRIVING_EFFICIENCY_TIERS.length - 1]
  );
}

function median(values = [], digits = 2) {
  const clean = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  const raw = clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
  return round(raw, digits);
}

function optionalNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function explicitDistanceKm(session) {
  const start = optionalNumber(session?.odo_start_km);
  const end = optionalNumber(session?.odo_end_km);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return round(end - start, 1);
}

export function getSessionOdometerKm(session) {
  const odoEnd = optionalNumber(session?.odo_end_km ?? session?.odometer_km);
  if (Number.isFinite(odoEnd) && odoEnd >= 0) return Math.round(odoEnd);
  const odoStart = optionalNumber(session?.odo_start_km);
  if (Number.isFinite(odoStart) && odoStart >= 0) return Math.round(odoStart);
  return null;
}

export function getDistanceKm(session) {
  const derived = Number(session?.distanceKm ?? session?.derived_distance_km ?? session?._distanceKm);
  if (Number.isFinite(derived) && derived > 0) return round(derived, 1);
  return explicitDistanceKm(session);
}

export function getEnergyPer100Km(session) {
  const distanceKm = getDistanceKm(session);
  const energy = Number(session?.energy_kwh);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(energy) || energy <= 0) return null;
  return round((energy / distanceKm) * 100, 1);
}

export function getCostPer100Km(session) {
  const distanceKm = getDistanceKm(session);
  const cost = Number(session?.total_cost);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(cost) || cost < 0) return null;
  return round((cost / distanceKm) * 100, 2);
}

export function getRecoveredRangeKm(session, referenceConsumptionPer100Km = 17.2) {
  const energy = Number(session?.energy_kwh);
  const reference = Number(referenceConsumptionPer100Km);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(reference) || reference <= 0) return null;
  return round((energy / reference) * 100, 0);
}

export function effectivePricePerKwh(session) {
  const direct = Number(session?.price_per_kwh);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const energy = Number(session?.energy_kwh);
  const totalCost = Number(session?.total_cost);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(totalCost) || totalCost < 0) return null;
  return totalCost / energy;
}

export function averagePowerKw(session) {
  const energy = Number(session?.energy_kwh);
  const durationSeconds = Number(session?.duration_seconds);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return round(energy / (durationSeconds / 3600), 1);
}

export function classifyChargingSegment(session) {
  const connector = String(session?.connector || "").toLowerCase();
  const provider = String(session?.provider || "").toLowerCase();
  const location = String(session?.location || "").toLowerCase();

  if (
    connector.includes("wallbox") ||
    connector.includes("home") ||
    provider.includes("wallbox") ||
    location.includes("zuhause") ||
    location.includes("home")
  ) {
    return "home";
  }
  if (connector.includes("ac")) return "public_ac";
  return "public_dc";
}

export function buildDrivingTimeline(sessions = []) {
  const sorted = [...(sessions || [])]
    .filter((session) => session?.date)
    .sort((left, right) => {
      const leftTs = new Date(left.date).getTime();
      const rightTs = new Date(right.date).getTime();
      if (leftTs !== rightTs) return leftTs - rightTs;
      return String(left.id || "").localeCompare(String(right.id || ""), "de");
    });

  let previousOdometer = null;

  const rows = sorted.map((session) => {
    const previousOdometerKm = previousOdometer;
    const odometerKm = getSessionOdometerKm(session);
    const explicitDistance = explicitDistanceKm(session);
    let distanceKm = explicitDistance;

    if (!Number.isFinite(distanceKm) && Number.isFinite(previousOdometerKm) && Number.isFinite(odometerKm) && odometerKm > previousOdometerKm) {
      distanceKm = round(odometerKm - previousOdometerKm, 1);
    }

    if (Number.isFinite(odometerKm) && odometerKm >= 0) {
      previousOdometer = odometerKm;
    }

    const energyPer100Km =
      Number.isFinite(distanceKm) && distanceKm > 0 && Number.isFinite(Number(session?.energy_kwh))
        ? round((Number(session.energy_kwh) / distanceKm) * 100, 1)
        : null;
    const costPer100Km =
      Number.isFinite(distanceKm) && distanceKm > 0 && Number.isFinite(Number(session?.total_cost))
        ? round((Number(session.total_cost) / distanceKm) * 100, 2)
        : null;

    return {
      ...session,
      previousOdometerKm,
      odometerKm,
      distanceKm,
      energyPer100Km,
      costPer100Km,
      recoveredRangeKm: getRecoveredRangeKm(session),
    };
  });

  return rows.map((row, index) => {
    const nextRow = rows.slice(index + 1).find((candidate) => Number.isFinite(candidate.odometerKm));
    return {
      ...row,
      nextOdometerKm: nextRow?.odometerKm ?? null,
    };
  });
}

export function deriveMobilityForSession(sessions = [], candidateSession = null) {
  if (!candidateSession) return null;
  const merged = [...(sessions || []).filter((session) => String(session.id) !== String(candidateSession.id)), candidateSession];
  return buildDrivingTimeline(merged).find((session) => String(session.id) === String(candidateSession.id)) || null;
}

function formatSegmentRow(base, locale = getActiveLocale()) {
  const count = Number(base.count || 0);
  const totalEnergyKwh = round(base.totalEnergyKwh, 1);
  const totalCost = round(base.totalCost, 2);
  const totalDurationSeconds = Math.round(base.totalDurationSeconds || 0);
  const totalDistanceKm = round(base.totalDistanceKm, 1);
  const avgPricePerKwh = totalEnergyKwh > 0 ? round(totalCost / totalEnergyKwh, 3) : null;
  const avgPowerKw = totalDurationSeconds > 0 ? round(totalEnergyKwh / (totalDurationSeconds / 3600), 1) : null;
  const avgCostPer100Km = totalDistanceKm > 0 ? round((totalCost / totalDistanceKm) * 100, 2) : null;
  const avgEnergyPer100Km = totalDistanceKm > 0 ? round((totalEnergyKwh / totalDistanceKm) * 100, 1) : null;

  return {
    ...segmentDefinitions(locale)[base.key],
    count,
    totalEnergyKwh,
    totalCost,
    totalDurationSeconds,
    totalDistanceKm,
    avgPricePerKwh,
    avgPowerKw,
    avgCostPer100Km,
    avgEnergyPer100Km,
    medianPricePerKwh: median(base.priceValues, 3),
    medianCostPerSession: median(base.costValues, 2),
  };
}

export function buildChargingMix(sessions = []) {
  const locale = getActiveLocale();
  const rowsWithDriving = buildDrivingTimeline(sessions);
  const buckets = Object.keys(segmentDefinitions(locale)).reduce((acc, key) => {
    acc[key] = {
      key,
      count: 0,
      totalEnergyKwh: 0,
      totalCost: 0,
      totalDurationSeconds: 0,
      totalDistanceKm: 0,
      priceValues: [],
      costValues: [],
    };
    return acc;
  }, {});

  rowsWithDriving.forEach((session) => {
    const key = classifyChargingSegment(session);
    const bucket = buckets[key];
    if (!bucket) return;

    const energy = Number(session?.energy_kwh || 0);
    const totalCost = Number(session?.total_cost || 0);
    const durationSeconds = Number(session?.duration_seconds || 0);
    const distanceKm = getDistanceKm(session);
    const pricePerKwh = effectivePricePerKwh(session);

    bucket.count += 1;
    bucket.totalEnergyKwh += Number.isFinite(energy) ? energy : 0;
    bucket.totalCost += Number.isFinite(totalCost) ? totalCost : 0;
    bucket.totalDurationSeconds += Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
    bucket.totalDistanceKm += Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
    if (Number.isFinite(pricePerKwh) && pricePerKwh > 0) bucket.priceValues.push(pricePerKwh);
    if (Number.isFinite(totalCost) && totalCost >= 0) bucket.costValues.push(totalCost);
  });

  const rows = Object.values(buckets)
    .map((bucket) => formatSegmentRow(bucket, locale))
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      if (right.totalEnergyKwh !== left.totalEnergyKwh) return right.totalEnergyKwh - left.totalEnergyKwh;
      return right.count - left.count;
    });

  const totalEnergyKwh = rows.reduce((sum, row) => sum + row.totalEnergyKwh, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.totalCost, 0);
  const totalDistanceKm = rows.reduce((sum, row) => sum + row.totalDistanceKm, 0);

  const byKey = rows.reduce((acc, row) => {
    acc[row.key] = {
      ...row,
      energySharePct: totalEnergyKwh > 0 ? round((row.totalEnergyKwh / totalEnergyKwh) * 100, 0) : 0,
      costSharePct: totalCost > 0 ? round((row.totalCost / totalCost) * 100, 0) : 0,
    };
    return acc;
  }, {});

  return {
    rows,
    byKey,
    totalEnergyKwh: round(totalEnergyKwh, 1),
    totalCost: round(totalCost, 2),
    totalDistanceKm: round(totalDistanceKm, 1),
    dominant: rows[0] || null,
    cheapest: [...rows].filter((row) => row.medianPricePerKwh != null).sort((a, b) => a.medianPricePerKwh - b.medianPricePerKwh)[0] || null,
    priciest: [...rows].filter((row) => row.medianPricePerKwh != null).sort((a, b) => b.medianPricePerKwh - a.medianPricePerKwh)[0] || null,
  };
}

export function buildWeekdayHeatmap(sessions = [], filters = {}) {
  const { year = null } = filters;
  const weekdayLabels = getWeekdayLabels();
  const monthRows = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: monthLabel(index + 1),
    cells: weekdayLabels.map((label, weekday) => ({
      weekday,
      label,
      count: 0,
      energyKwh: 0,
      cost: 0,
    })),
  }));

  (sessions || []).forEach((session) => {
    const parts = parseSessionDate(session?.date);
    if (!parts) return;
    if (year != null && Number(parts.year) !== Number(year)) return;

    const monthRow = monthRows[Number(parts.month) - 1];
    const cell = monthRow?.cells?.[Number(parts.weekday)];
    if (!cell) return;

    cell.count += 1;
    cell.energyKwh += Number(session?.energy_kwh || 0);
    cell.cost += Number(session?.total_cost || 0);
  });

  let maxCount = 0;
  let strongestCell = null;
  const weekdayTotals = new Map();

  monthRows.forEach((monthRow) => {
    monthRow.cells.forEach((cell) => {
      cell.energyKwh = round(cell.energyKwh, 1);
      cell.cost = round(cell.cost, 2);
      if (cell.count > maxCount) {
        maxCount = cell.count;
        strongestCell = { ...cell, month: monthRow.month, monthLabel: monthRow.label };
      }
      weekdayTotals.set(cell.label, (weekdayTotals.get(cell.label) || 0) + cell.count);
    });
  });

  const topWeekday = weekdayLabels.map((label, weekday) => ({
    weekday,
    label,
    count: weekdayTotals.get(label) || 0,
  }))
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.weekday - right.weekday;
    })[0] || null;

  const topMonth = [...monthRows]
    .map((monthRow) => ({
      month: monthRow.month,
      label: monthRow.label,
      count: monthRow.cells.reduce((sum, cell) => sum + cell.count, 0),
    }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count)[0] || null;

  return {
    months: monthRows,
    maxCount,
    strongestCell,
    topWeekday,
    topMonth,
  };
}

export function buildMobilityStats(sessions = []) {
  const coveredSessions = buildDrivingTimeline(sessions).filter((session) => Number.isFinite(session.distanceKm) && session.distanceKm > 0);

  const totalDistanceKm = coveredSessions.reduce((sum, session) => sum + Number(session.distanceKm || 0), 0);
  const totalEnergyKwh = coveredSessions.reduce((sum, session) => sum + Number(session.energy_kwh || 0), 0);
  const totalCost = coveredSessions.reduce((sum, session) => sum + Number(session.total_cost || 0), 0);
  const avgCostPer100Km = totalDistanceKm > 0 ? round((totalCost / totalDistanceKm) * 100, 2) : null;
  const avgEnergyPer100Km = totalDistanceKm > 0 ? round((totalEnergyKwh / totalDistanceKm) * 100, 1) : null;
  const avgDistanceKm = coveredSessions.length ? round(totalDistanceKm / coveredSessions.length, 1) : null;
  const coveragePct = sessions.length ? round((coveredSessions.length / sessions.length) * 100, 0) : 0;

  const bestTrip = [...coveredSessions]
    .filter((session) => Number.isFinite(session.costPer100Km))
    .sort((left, right) => left.costPer100Km - right.costPer100Km)[0] || null;
  const worstTrip = [...coveredSessions]
    .filter((session) => Number.isFinite(session.costPer100Km))
    .sort((left, right) => right.costPer100Km - left.costPer100Km)[0] || null;

  return {
    coveredSessions,
    coveragePct,
    totalDistanceKm: round(totalDistanceKm, 1),
    totalEnergyKwh: round(totalEnergyKwh, 1),
    totalCost: round(totalCost, 2),
    avgCostPer100Km,
    avgEnergyPer100Km,
    avgDistanceKm,
    bestTrip,
    worstTrip,
  };
}

export function buildDrivingEfficiencyProfile(sessions = []) {
  const locale = getActiveLocale();
  const mobility = buildMobilityStats(sessions);
  const mix = buildChargingMix(sessions);
  const rows = mobility.coveredSessions;
  const avgEnergy = Number(mobility.avgEnergyPer100Km);
  const winterShare =
    rows.length > 0
      ? rows.filter((session) => {
          const month = parseSessionDate(session?.date)?.month;
          return month === 12 || month === 1 || month === 2;
        }).length / rows.length
      : 0;
  const shortTripShare = rows.length > 0 ? rows.filter((session) => Number(session.distanceKm || 0) < 35).length / rows.length : 0;
  const highSocShare = sessions.length > 0 ? sessions.filter((session) => Number(session?.soc_end) >= 85).length / sessions.length : 0;
  const dcShare = mix.totalEnergyKwh > 0 ? Number(mix.byKey.public_dc?.totalEnergyKwh || 0) / mix.totalEnergyKwh : 0;
  const homeShare = mix.totalEnergyKwh > 0 ? Number(mix.byKey.home?.totalEnergyKwh || 0) / mix.totalEnergyKwh : 0;
  const tier = translatedTier(drivingEfficiencyTier(avgEnergy), locale);

  let label = t("mobilityProfile.statuses.noData", {}, locale);
  let tone = "neutral";
  let summaryHint = null;
  let narrative = t("mobilityProfile.narrative.pending", {}, locale);
  let coverageBadge = t("mobilityProfile.statuses.noRating", {}, locale);

  if (tier) {
    const decoratedTierLabel = `${tier.emoji} ${tier.label}`;
    coverageBadge =
      mobility.coveragePct < 40
        ? t("mobilityProfile.statuses.provisional", {}, locale)
        : mobility.coveragePct < 70
          ? t("mobilityProfile.statuses.tendency", {}, locale)
          : t("mobilityProfile.statuses.stable", {}, locale);

    if (mobility.coveragePct < 40) {
      label = t("mobilityProfile.statuses.notEnoughData", {}, locale);
      tone = "neutral";
      summaryHint = t("mobilityProfile.statuses.trend", { label: decoratedTierLabel }, locale);
    } else if (mobility.coveragePct < 70) {
      label = t("mobilityProfile.statuses.trend", { label: decoratedTierLabel }, locale);
      tone = tier.tone;
      summaryHint = t("mobilityProfile.statuses.dataHint", {}, locale);
    } else {
      label = decoratedTierLabel;
      tone = tier.tone;
    }

    const coverageNarrative =
      mobility.coveragePct < 40
        ? t("mobilityProfile.narrative.lowCoverage", { coverage: round(mobility.coveragePct, 0) }, locale)
        : mobility.coveragePct < 70
          ? t("mobilityProfile.narrative.mediumCoverage", { coverage: round(mobility.coveragePct, 0) }, locale)
          : t("mobilityProfile.narrative.highCoverage", { coverage: round(mobility.coveragePct, 0) }, locale);

    narrative = t(
      "mobilityProfile.narrative.base",
      {
        label: decoratedTierLabel,
        distance: round(mobility.totalDistanceKm, 0),
        energy: round(avgEnergy, 1),
        coverageNarrative,
      },
      locale
    );
  }

  const score = Number.isFinite(avgEnergy) && avgEnergy > 0 ? Math.round(clamp(100 - (avgEnergy - 14) * 12, 34, 96)) : null;
  const tips = [];
  const chips = [];

  if (Number.isFinite(avgEnergy) && avgEnergy >= 18.5) {
    tips.push(t("mobilityProfile.tips.highConsumption", {}, locale));
  }
  if (shortTripShare >= 0.35) {
    tips.push(t("mobilityProfile.tips.shortTrips", {}, locale));
    chips.push({ icon: "🏙️", label: t("mobilityProfile.chips.shortTrips", {}, locale), tone: "warm" });
  }
  if (winterShare >= 0.3) {
    tips.push(t("mobilityProfile.tips.winter", {}, locale));
    chips.push({ icon: "❄️", label: t("mobilityProfile.chips.winter", {}, locale), tone: "frost" });
  }
  if (dcShare >= 0.35) {
    tips.push(t("mobilityProfile.tips.highDc", {}, locale));
    chips.push({ icon: "⚡", label: t("mobilityProfile.chips.highDc", {}, locale), tone: "danger" });
  }
  if (highSocShare >= 0.4) {
    tips.push(t("mobilityProfile.tips.highSoc", {}, locale));
    chips.push({ icon: "🔋", label: t("mobilityProfile.chips.highSoc", {}, locale), tone: "warm" });
  }
  if (homeShare >= 0.45) {
    chips.push({ icon: "🏠", label: t("mobilityProfile.chips.homeCharging", {}, locale), tone: "mint" });
  }
  if (!tips.length && Number.isFinite(avgEnergy) && avgEnergy > 0) {
    tips.push(t("mobilityProfile.tips.calmProfile", {}, locale));
  }
  if (!chips.length && tier) {
    chips.push({ icon: "🧭", label: t("mobilityProfile.chips.consistent", {}, locale), tone: tier.tone === "danger" ? "warm" : tier.tone });
  }

  return {
    ...mobility,
    score,
    label,
    tone,
    summaryHint,
    coverageBadge,
    narrative,
    chips: chips.slice(0, 4),
    tips: tips.slice(0, 3),
  };
}

export function buildShiftScenario(sessions = [], options = {}) {
  const { shiftPct = 20, sourceKey = "public_dc", targetKey = "home" } = options;
  const mix = buildChargingMix(sessions);
  const source = mix.byKey[sourceKey] || null;
  const target = mix.byKey[targetKey] || null;

  if (!source || !target || sourceKey === targetKey) {
    return {
      ok: false,
      mix,
      source,
      target,
      annualSavings: null,
      shiftEnergyKwh: null,
      deltaPricePerKwh: null,
      projectedAvgPricePerKwh: null,
    };
  }

  const sourcePrice = Number(source.medianPricePerKwh ?? source.avgPricePerKwh);
  const targetPrice = Number(target.medianPricePerKwh ?? target.avgPricePerKwh);
  const safeShiftPct = Math.min(60, Math.max(5, Number(shiftPct) || 20));
  const shiftEnergyKwh = round((source.totalEnergyKwh * safeShiftPct) / 100, 1);
  const deltaPricePerKwh = Number.isFinite(sourcePrice) && Number.isFinite(targetPrice) ? round(sourcePrice - targetPrice, 3) : null;
  const annualSavings = Number.isFinite(deltaPricePerKwh) && deltaPricePerKwh > 0 ? round(shiftEnergyKwh * deltaPricePerKwh, 2) : 0;
  const projectedTotalCost = round(mix.totalCost - annualSavings, 2);
  const projectedAvgPricePerKwh = mix.totalEnergyKwh > 0 ? round(projectedTotalCost / mix.totalEnergyKwh, 3) : null;

  return {
    ok: true,
    mix,
    sourceKey,
    targetKey,
    source,
    target,
    shiftPct: safeShiftPct,
    shiftEnergyKwh,
    deltaPricePerKwh,
    annualSavings,
    projectedTotalCost,
    projectedAvgPricePerKwh,
  };
}

export function segmentDefinitions() {
  const locale = getActiveLocale();
  return {
    home: {
      key: "home",
      label: t("chargingSegments.home.label", {}, locale),
      shortLabel: t("chargingSegments.home.shortLabel", {}, locale),
      tone: "mint",
    },
    public_ac: {
      key: "public_ac",
      label: t("chargingSegments.publicAc.label", {}, locale),
      shortLabel: t("chargingSegments.publicAc.shortLabel", {}, locale),
      tone: "frost",
    },
    public_dc: {
      key: "public_dc",
      label: t("chargingSegments.publicDc.label", {}, locale),
      shortLabel: t("chargingSegments.publicDc.shortLabel", {}, locale),
      tone: "warm",
    },
  };
}
