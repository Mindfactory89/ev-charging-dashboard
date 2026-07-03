'use strict';

const { parseTags } = require('./sessionMetadata');
const { buildSelectableYears } = require('./year');

function round(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function median(values) {
  const clean = (values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2 === 1) return clean[middle];
  return (clean[middle - 1] + clean[middle]) / 2;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function monthToSeason(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

const SEASON_META = {
  winter: { key: 'winter', label: 'Winter', months: [12, 1, 2] },
  spring: { key: 'spring', label: 'Frühling', months: [3, 4, 5] },
  summer: { key: 'summer', label: 'Sommer', months: [6, 7, 8] },
  autumn: { key: 'autumn', label: 'Herbst', months: [9, 10, 11] },
};

const SOC_BUCKET_SIZE = 10;
const EFFICIENCY_WEIGHTS = {
  price_score: 0.55,
  power_score: 0.25,
  speed_score: 0.20,
};
const EFFICIENCY_NEUTRAL_SCORE = 50;
const EFFICIENCY_MISSING_COMPONENT_SCORE = 35;
const MONTHS_PER_YEAR = 12;
const OUTLIER_RULES = [
  {
    key: 'price_per_kwh',
    label: 'Hoher Preis',
    direction: 'high',
    digits: 3,
    fallbackMultiplier: 1.18,
    weight: 1.8,
    read: (session) => session.price_per_kwh,
  },
  {
    key: 'avg_power_kw',
    label: 'Schwache Ladeleistung',
    direction: 'low',
    digits: 1,
    fallbackMultiplier: 0.78,
    weight: 1.4,
    read: (session) => session.avg_power_kw,
  },
  {
    key: 'duration_seconds',
    label: 'Lange Dauer',
    direction: 'high',
    digits: 0,
    fallbackMultiplier: 1.3,
    weight: 1.1,
    read: (session) => session.duration_seconds,
  },
  {
    key: 'score',
    label: 'Schwacher Score',
    direction: 'low',
    digits: 1,
    fallbackMultiplier: 0.82,
    weight: 1.9,
    read: (session) => session.score,
  },
];

function sessionDateIso(session) {
  return new Date(session.date).toISOString().slice(0, 10);
}

function labelOrFallback(value, fallback = 'Nicht zugeordnet') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function buildAvailableYearsFromSessions(sessions, fallbackYear = null) {
  const years = Array.from(
    new Set(
      (sessions || [])
        .map((session) => new Date(session.date).getUTCFullYear())
        .filter((year) => Number.isInteger(year))
    )
  );

  return buildSelectableYears(years, fallbackYear);
}

function getSessionMonthUTC(session) {
  return new Date(session.date).getUTCMonth() + 1;
}

function buildSessionDerived(session) {
  const energy = Number(session.energy_kwh || 0);
  const cost = Number(session.total_cost || 0);
  const duration = Number(session.duration_seconds || 0);
  const avgPowerKw = duration > 0 ? energy / (duration / 3600) : 0;
  const pricePerKwh = energy > 0 ? cost / energy : Number(session.price_per_kwh || 0);
  const socDelta = Math.max(0, Number(session.soc_end || 0) - Number(session.soc_start || 0));
  const minutes = duration > 0 ? duration / 60 : 0;
  const minutesPerKwh = energy > 0 ? minutes / energy : 0;

  return {
    energy_kwh: energy,
    total_cost: cost,
    duration_seconds: duration,
    avg_power_kw: avgPowerKw,
    price_per_kwh_effective: pricePerKwh,
    soc_delta: socDelta,
    minutes_per_kwh: minutesPerKwh,
  };
}

function enrichSessionsWithDerived(sessions) {
  return sessions.map((session) => ({ ...session, _derived: buildSessionDerived(session) }));
}

function collectPositiveDerivedValues(sessions, field) {
  return sessions
    .map((session) => session?._derived?.[field])
    .filter((value) => Number.isFinite(value) && value > 0);
}

function buildEfficiencyRanges(enrichedSessions) {
  const priceValues = collectPositiveDerivedValues(enrichedSessions, 'price_per_kwh_effective');
  const powerValues = collectPositiveDerivedValues(enrichedSessions, 'avg_power_kw');
  const minutesPerKwhValues = collectPositiveDerivedValues(enrichedSessions, 'minutes_per_kwh');

  return {
    price_min: priceValues.length ? Math.min(...priceValues) : 0,
    price_max: priceValues.length ? Math.max(...priceValues) : 0,
    power_min_kw: powerValues.length ? Math.min(...powerValues) : 0,
    power_max_kw: powerValues.length ? Math.max(...powerValues) : 0,
    minutes_per_kwh_min: minutesPerKwhValues.length ? Math.min(...minutesPerKwhValues) : 0,
    minutes_per_kwh_max: minutesPerKwhValues.length ? Math.max(...minutesPerKwhValues) : 0,
  };
}

function normalizeLowGood(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return EFFICIENCY_NEUTRAL_SCORE;
  if (max <= min) return EFFICIENCY_NEUTRAL_SCORE;
  return clamp(((max - numeric) / (max - min)) * 100, 0, 100);
}

function normalizeHighGood(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return EFFICIENCY_NEUTRAL_SCORE;
  if (max <= min) return EFFICIENCY_NEUTRAL_SCORE;
  return clamp(((numeric - min) / (max - min)) * 100, 0, 100);
}

function scoreEfficiencySession(session, ranges) {
  const derived = session._derived;
  const priceScore = normalizeLowGood(derived.price_per_kwh_effective, ranges.price_min, ranges.price_max);
  const powerScore = derived.avg_power_kw > 0
    ? normalizeHighGood(derived.avg_power_kw, ranges.power_min_kw, ranges.power_max_kw)
    : EFFICIENCY_MISSING_COMPONENT_SCORE;
  const speedScore = derived.minutes_per_kwh > 0
    ? normalizeLowGood(derived.minutes_per_kwh, ranges.minutes_per_kwh_min, ranges.minutes_per_kwh_max)
    : EFFICIENCY_MISSING_COMPONENT_SCORE;

  const score =
    priceScore * EFFICIENCY_WEIGHTS.price_score +
    powerScore * EFFICIENCY_WEIGHTS.power_score +
    speedScore * EFFICIENCY_WEIGHTS.speed_score;

  return {
    session_id: session.id,
    date: new Date(session.date).toISOString().slice(0, 10),
    connector: session.connector,
    energy_kwh: round(derived.energy_kwh, 1),
    total_cost: round(derived.total_cost, 2),
    duration_seconds: derived.duration_seconds || null,
    avg_power_kw: derived.avg_power_kw > 0 ? round(derived.avg_power_kw, 1) : null,
    price_per_kwh: derived.price_per_kwh_effective > 0 ? round(derived.price_per_kwh_effective, 3) : null,
    score: round(score, 1),
    breakdown: {
      price_score: round(priceScore, 1),
      power_score: round(powerScore, 1),
      speed_score: round(speedScore, 1),
    },
  };
}

function buildEfficiencyBaseline(ranges) {
  return {
    price_min: round(ranges.price_min, 3),
    price_max: round(ranges.price_max, 3),
    power_min_kw: round(ranges.power_min_kw, 1),
    power_max_kw: round(ranges.power_max_kw, 1),
    minutes_per_kwh_min: round(ranges.minutes_per_kwh_min, 2),
    minutes_per_kwh_max: round(ranges.minutes_per_kwh_max, 2),
  };
}

function calcEfficiencyFramework(sessions) {
  const enriched = enrichSessionsWithDerived(sessions);
  const ranges = buildEfficiencyRanges(enriched);

  return {
    enriched,
    perSessionScore: (session) => scoreEfficiencySession(session, ranges),
    baseline: buildEfficiencyBaseline(ranges),
  };
}

function selectLowestNumeric(rows, field) {
  return rows.reduce((best, row) => {
    const current = Number(row?.[field] ?? Infinity);
    const previous = Number(best?.[field] ?? Infinity);
    return current < previous ? row : best;
  }, null);
}

function selectHighestNumeric(rows, field) {
  return rows.reduce((best, row) => {
    const current = Number(row?.[field] ?? -Infinity);
    const previous = Number(best?.[field] ?? -Infinity);
    return current > previous ? row : best;
  }, null);
}

function averageNumeric(rows, field, digits) {
  const validRows = rows.filter((row) => row?.[field] != null);
  if (!validRows.length) return null;

  const average = validRows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / validRows.length;
  return round(average, digits);
}

function getEfficiencyScoreLabel(score) {
  if (score == null) return 'Keine Daten';
  if (score >= 80) return 'Sehr effizient';
  if (score >= 65) return 'Effizient';
  if (score >= 50) return 'Solide';
  return 'Optimierungspotenzial';
}

function aggregateGroup(rows, label, meta = {}) {
  const count = rows.length;
  const totalEnergy = rows.reduce((sum, session) => sum + Number(session.energy_kwh || 0), 0);
  const totalCost = rows.reduce((sum, session) => sum + Number(session.total_cost || 0), 0);
  const timedRows = rows.filter((row) => Number.isFinite(Number(row.duration_seconds)) && Number(row.duration_seconds) > 0);
  const durations = timedRows
    .map((session) => Number(session.duration_seconds || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const totalDuration = durations.reduce((sum, value) => sum + value, 0);
  const totalTimedEnergy = timedRows.reduce((sum, row) => sum + Number(row.energy_kwh || 0), 0);

  const avgDurationSeconds = durations.length ? totalDuration / durations.length : 0;
  const avgKwhPerSession = count ? totalEnergy / count : 0;
  const avgCostPerSession = count ? totalCost / count : 0;
  const avgPricePerKwh = totalEnergy > 0 ? totalCost / totalEnergy : 0;
  const avgPowerKw = totalDuration > 0 ? totalTimedEnergy / (totalDuration / 3600) : 0;

  return {
    key: meta.key || label.toLowerCase(),
    label,
    months: meta.months || [],
    count,
    energy_kwh: round(totalEnergy, 3),
    cost: round(totalCost, 2),
    avg_duration_seconds: Math.round(avgDurationSeconds),
    avg_kwh_per_session: round(avgKwhPerSession, 2),
    avg_cost_per_session: round(avgCostPerSession, 2),
    avg_price_per_kwh: totalEnergy > 0 ? round(avgPricePerKwh, 3) : null,
    avg_power_kw: totalDuration > 0 ? round(avgPowerKw, 1) : null,
  };
}

function quantileSorted(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = sortedValues[base];
  const upper = sortedValues[Math.min(base + 1, sortedValues.length - 1)];
  return lower + (upper - lower) * rest;
}

function buildOutlierBaseline(values, direction, fallbackMultiplier, digits = 2) {
  const clean = values
    .filter((value) => value != null && value !== '')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (!clean.length) {
    return {
      sample_count: 0,
      median: null,
      q1: null,
      q3: null,
      iqr: null,
      threshold: null,
      method: 'none',
      direction,
    };
  }

  const medianValue = quantileSorted(clean, 0.5);
  const q1 = quantileSorted(clean, 0.25);
  const q3 = quantileSorted(clean, 0.75);
  const iqr = q1 != null && q3 != null ? q3 - q1 : 0;
  const canUseIqr = clean.length >= 5 && Number.isFinite(iqr) && iqr > 0;

  let threshold = null;
  let method = 'median';

  if (direction === 'high') {
    threshold = canUseIqr ? q3 + iqr * 1.5 : medianValue > 0 ? medianValue * fallbackMultiplier : null;
    method = canUseIqr ? 'iqr' : 'median';
  } else {
    threshold = canUseIqr ? q1 - iqr * 1.5 : medianValue > 0 ? medianValue * fallbackMultiplier : null;
    method = canUseIqr ? 'iqr' : 'median';
  }

  return {
    sample_count: clean.length,
    median: medianValue != null ? round(medianValue, digits) : null,
    q1: q1 != null ? round(q1, digits) : null,
    q3: q3 != null ? round(q3, digits) : null,
    iqr: iqr != null ? round(iqr, digits) : null,
    threshold: threshold != null ? round(threshold, digits) : null,
    method,
    direction,
  };
}

function buildOutlierScoredSessions(sessions) {
  const framework = calcEfficiencyFramework(sessions);

  return framework.enriched.map((session) => {
    const scoredRow = framework.perSessionScore(session);
    return {
      ...scoredRow,
      minutes_per_kwh: session._derived.minutes_per_kwh > 0 ? round(session._derived.minutes_per_kwh, 2) : null,
      soc_delta: session._derived.soc_delta > 0 ? round(session._derived.soc_delta, 1) : null,
    };
  });
}

function isOutlierValue(value, baseline, direction) {
  if (value == null || value === '' || baseline?.threshold == null) return false;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;

  return direction === 'high'
    ? numericValue > Number(baseline.threshold)
    : numericValue < Number(baseline.threshold);
}

function getOutlierDeviationPct(value, baseline) {
  const numericValue = Number(value);
  const medianValue = Number(baseline?.median);

  if (!Number.isFinite(numericValue) || !Number.isFinite(medianValue) || medianValue === 0) {
    return null;
  }

  return round((Math.abs(numericValue - medianValue) / Math.abs(medianValue)) * 100, 1);
}

function getOutlierSeverity(deviationPct) {
  if (deviationPct == null) return 'low';
  if (deviationPct >= 35) return 'high';
  if (deviationPct >= 18) return 'medium';
  return 'low';
}

function buildOutlierReason(rule, value, baseline) {
  const deviationPct = getOutlierDeviationPct(value, baseline);

  return {
    key: rule.key,
    label: rule.label,
    direction: rule.direction,
    value: round(value, rule.digits),
    threshold: baseline.threshold,
    median: baseline.median,
    deviation_pct: deviationPct,
    severity: getOutlierSeverity(deviationPct),
  };
}

function applyOutlierReason(bySession, session, rule, reason) {
  const current = bySession.get(session.session_id) || {
    ...session,
    reasons: [],
    flag_count: 0,
    severity_score: 0,
  };

  current.reasons.push(reason);
  current.flag_count += 1;
  current.severity_score +=
    rule.weight + (reason.deviation_pct != null ? Math.min(4, reason.deviation_pct / 20) : 0);

  bySession.set(session.session_id, current);
}

function sortOutlierReasons(reasons) {
  return [...reasons].sort((left, right) => {
    const deviation = Number(right.deviation_pct || 0) - Number(left.deviation_pct || 0);
    if (deviation !== 0) return deviation;
    return String(left.label).localeCompare(String(right.label), 'de');
  });
}

function sortFlaggedSessions(rows) {
  return [...rows].sort((left, right) => {
    if (right.flag_count !== left.flag_count) return right.flag_count - left.flag_count;
    if (right.severity_score !== left.severity_score) return right.severity_score - left.severity_score;
    return String(right.date).localeCompare(String(left.date), 'de');
  });
}

function buildOutlierBaselines(scoredSessions, rules) {
  return Object.fromEntries(
    rules.map((rule) => [
      rule.key,
      buildOutlierBaseline(
        scoredSessions.map((session) => rule.read(session)),
        rule.direction,
        rule.fallbackMultiplier,
        rule.digits
      ),
    ])
  );
}

function buildFlaggedOutlierSessions(scoredSessions, baselines, rules) {
  const bySession = new Map();

  for (const rule of rules) {
    const baseline = baselines[rule.key];
    if (baseline?.threshold == null) continue;

    for (const session of scoredSessions) {
      const value = rule.read(session);
      if (!isOutlierValue(value, baseline, rule.direction)) continue;

      const reason = buildOutlierReason(rule, Number(value), baseline);
      applyOutlierReason(bySession, session, rule, reason);
    }
  }

  return sortFlaggedSessions(
    Array.from(bySession.values()).map((session) => ({
      ...session,
      severity_score: round(session.severity_score, 1),
      reasons: sortOutlierReasons(session.reasons),
    }))
  );
}

function filterOutlierSessionsByReason(rows, reasonKey) {
  return rows.filter((session) => session.reasons.some((reason) => reason.key === reasonKey));
}

function buildOutlierHighlights(flaggedSessions) {
  const priceOutliers = filterOutlierSessionsByReason(flaggedSessions, 'price_per_kwh');
  const powerOutliers = filterOutlierSessionsByReason(flaggedSessions, 'avg_power_kw');
  const durationOutliers = filterOutlierSessionsByReason(flaggedSessions, 'duration_seconds');
  const scoreOutliers = filterOutlierSessionsByReason(flaggedSessions, 'score');

  return {
    worst_session: flaggedSessions[0] || null,
    priciest_outlier: selectHighestNumeric(priceOutliers, 'price_per_kwh'),
    lowest_power_outlier: selectLowestNumeric(powerOutliers, 'avg_power_kw'),
    longest_outlier: selectHighestNumeric(durationOutliers, 'duration_seconds'),
    weakest_score_outlier: selectLowestNumeric(scoreOutliers, 'score'),
  };
}

function collectSessionMetricValues(sessions, selector, predicate = (value) => Number.isFinite(value)) {
  return sessions
    .map(selector)
    .filter(predicate);
}

function buildStatsMedians(enrichedSessions) {
  const durations = collectSessionMetricValues(
    enrichedSessions,
    (session) => Number(session._derived?.duration_seconds),
    (value) => Number.isFinite(value) && value > 0
  );
  const energies = collectSessionMetricValues(
    enrichedSessions,
    (session) => Number(session._derived?.energy_kwh),
    (value) => Number.isFinite(value) && value > 0
  );
  const costs = collectSessionMetricValues(
    enrichedSessions,
    (session) => Number(session._derived?.total_cost),
    (value) => Number.isFinite(value) && value >= 0
  );
  const prices = collectPositiveDerivedValues(enrichedSessions, 'price_per_kwh_effective');
  const powers = collectPositiveDerivedValues(enrichedSessions, 'avg_power_kw');

  return {
    energy_kwh: median(energies),
    cost_per_session: median(costs),
    duration_seconds: median(durations),
    price_per_kwh: median(prices),
    power_kw: median(powers),
  };
}

function calcOutlierAnalytics(sessions, year) {
  const scored = buildOutlierScoredSessions(sessions);
  const baselines = buildOutlierBaselines(scored, OUTLIER_RULES);
  const flagged_sessions = buildFlaggedOutlierSessions(scored, baselines, OUTLIER_RULES);

  return {
    ok: true,
    year: Number(year),
    session_count: scored.length,
    outlier_count: flagged_sessions.length,
    flagged_sessions,
    baselines,
    highlights: buildOutlierHighlights(flagged_sessions),
  };
}

function buildStatsPayload(sessions, year) {
  const enrichedSessions = enrichSessionsWithDerived(sessions);
  const aggregate = aggregateGroup(sessions, 'Alle Sessions', { key: 'all-sessions' });
  const medians = buildStatsMedians(enrichedSessions);
  const avg_cost_per_min = aggregate.avg_duration_seconds > 0
    ? aggregate.avg_cost_per_session / (aggregate.avg_duration_seconds / 60)
    : 0;

  return {
    ok: true,
    year: year ? Number(year) : null,
    count: aggregate.count,
    total_energy_kwh: aggregate.energy_kwh,
    total_cost: aggregate.cost,
    avg_kwh_per_session: aggregate.avg_kwh_per_session,
    avg_duration_seconds: aggregate.avg_duration_seconds,
    avg_price_per_kwh: aggregate.avg_price_per_kwh != null ? aggregate.avg_price_per_kwh : 0,
    avg_price_per_charge: aggregate.avg_cost_per_session,
    avg_power_kw: aggregate.avg_power_kw != null ? aggregate.avg_power_kw : 0,
    avg_cost_per_min: Number(avg_cost_per_min.toFixed(2)),
    medians: {
      energy_kwh: medians.energy_kwh != null ? round(medians.energy_kwh, 1) : null,
      cost_per_session: medians.cost_per_session != null ? round(medians.cost_per_session, 2) : null,
      duration_seconds: medians.duration_seconds != null ? Math.round(medians.duration_seconds) : null,
      price_per_kwh: medians.price_per_kwh != null ? round(medians.price_per_kwh, 3) : null,
      power_kw: medians.power_kw != null ? round(medians.power_kw, 1) : null,
    },
    best_session_kwh: selectHighestNumeric(sessions, 'energy_kwh'),
    most_expensive: selectHighestNumeric(sessions, 'total_cost'),
    longest: selectHighestNumeric(sessions, 'duration_seconds'),
  };
}

function createMonthlyBuckets() {
  return Array.from({ length: MONTHS_PER_YEAR }, (_, index) => ({
    month: index + 1,
    count: 0,
    energy_kwh: 0,
    cost: 0,
  }));
}

function accumulateMonthlyBuckets(sessions) {
  const months = createMonthlyBuckets();

  for (const session of sessions) {
    const monthIndex = new Date(session.date).getUTCMonth();
    months[monthIndex].count += 1;
    months[monthIndex].energy_kwh += Number(session.energy_kwh || 0);
    months[monthIndex].cost += Number(session.total_cost || 0);
  }

  return months;
}

function buildMonthlyBaseRow(month) {
  const energy_kwh = round(month.energy_kwh, 3);
  const cost = round(month.cost, 2);
  const avg_price_per_charge = month.count ? round(cost / month.count, 2) : 0;
  const price_per_kwh = energy_kwh > 0 ? round(cost / energy_kwh, 3) : null;

  return {
    ...month,
    energy_kwh,
    cost,
    avg_price_per_charge,
    price_per_kwh,
  };
}

function buildValueTrend(current, previous) {
  if (current == null || previous == null) return null;

  const currentValue = Number(current);
  const previousValue = Number(previous);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) {
    return null;
  }

  const delta = currentValue - previousValue;
  return {
    delta: round(delta, 3),
    pct: round(delta / previousValue, 4),
  };
}

function buildMonthlyTrend(month, previous) {
  return {
    energy: previous ? buildValueTrend(month.energy_kwh, previous.energy_kwh) : null,
    cost: previous ? buildValueTrend(month.cost, previous.cost) : null,
    price_per_kwh: previous ? buildValueTrend(month.price_per_kwh, previous.price_per_kwh) : null,
  };
}

function finalizeMonthlyRows(baseRows) {
  return baseRows.map((month, index) => ({
    ...month,
    trend: buildMonthlyTrend(month, index > 0 ? baseRows[index - 1] : null),
  }));
}

function calculateAverageSessionsPerActiveMonth(activeMonths) {
  if (!activeMonths.length) return 0;

  return Number((activeMonths.reduce((sum, month) => sum + month.count, 0) / activeMonths.length).toFixed(2));
}

function buildMonthlyAnalyticsPayload(sessions, year) {
  const baseRows = accumulateMonthlyBuckets(sessions).map(buildMonthlyBaseRow);
  const monthsFinal = finalizeMonthlyRows(baseRows);

  const activeMonths = monthsFinal.filter((month) => month.count > 0);

  return {
    ok: true,
    year: Number(year),
    months: monthsFinal,
    top_energy_month: selectHighestNumeric(activeMonths, 'energy_kwh'),
    top_cost_month: selectHighestNumeric(activeMonths, 'cost'),
    avg_sessions_per_month: calculateAverageSessionsPerActiveMonth(activeMonths),
  };
}

function createSeasonBuckets() {
  return Object.fromEntries(Object.values(SEASON_META).map((meta) => [meta.key, []]));
}

function bucketSessionsBySeason(sessions) {
  const buckets = createSeasonBuckets();

  for (const session of sessions) {
    const season = monthToSeason(getSessionMonthUTC(session));
    buckets[season].push(session);
  }

  return buckets;
}

function buildSeasonEfficiencyScore(scoredRows, emptyValue = null) {
  const score = averageNumeric(scoredRows, 'score', 1);
  return score == null ? emptyValue : score;
}

function buildSeasonSummary(meta, rows, framework, options = {}) {
  const scored = rows.map((session) => framework.perSessionScore(session));
  const summary = {
    ...aggregateGroup(rows, meta.label, meta),
    efficiency_score: buildSeasonEfficiencyScore(scored, options.emptyEfficiencyScore ?? null),
  };

  if (options.includeSessionHighlights) {
    summary.best_session = selectHighestNumeric(scored, 'score');
    summary.worst_session = selectLowestNumeric(scored, 'score');
  }

  return summary;
}

function buildSeasonRows(framework, options = {}) {
  const buckets = bucketSessionsBySeason(framework.enriched);

  return Object.values(SEASON_META).map((meta) =>
    buildSeasonSummary(meta, buckets[meta.key] || [], framework, options)
  );
}

function buildSeasonHighlights(seasons) {
  const activeSeasons = seasons.filter((season) => season.count > 0);

  return {
    best_efficiency_season: selectHighestNumeric(activeSeasons, 'efficiency_score'),
    cheapest_season: selectLowestNumeric(activeSeasons, 'avg_price_per_kwh'),
  };
}

function buildSeasonAnalyticsPayload(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const seasons = buildSeasonRows(framework, { includeSessionHighlights: true });

  return {
    ok: true,
    year: Number(year),
    seasons,
    highlights: buildSeasonHighlights(seasons),
    baseline: framework.baseline,
  };
}

function buildEfficiencyAnalyticsPayload(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const scored = framework.enriched.map((session) => framework.perSessionScore(session));

  const overall_score = scored.length
    ? round(scored.reduce((sum, session) => sum + Number(session.score || 0), 0) / scored.length, 1)
    : null;

  return {
    ok: true,
    year: Number(year),
    overall_score,
    score_label: getEfficiencyScoreLabel(overall_score),
    session_count: scored.length,
    averages: {
      price_per_kwh: averageNumeric(scored, 'price_per_kwh', 3),
      power_kw: averageNumeric(scored, 'avg_power_kw', 1),
    },
    best_session: selectHighestNumeric(scored, 'score'),
    worst_session: selectLowestNumeric(scored, 'score'),
    cheapest_session: selectLowestNumeric(scored, 'price_per_kwh'),
    fastest_session: selectHighestNumeric(scored, 'avg_power_kw'),
    baseline: framework.baseline,
    weights: EFFICIENCY_WEIGHTS,
    sessions: scored,
  };
}

function getSocBucketMeta(start) {
  const bucketStart = clamp(Math.floor(Number(start) / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  const bucketEnd = Math.min(100, bucketStart + SOC_BUCKET_SIZE);
  return {
    key: `${bucketStart}-${bucketEnd}`,
    label: `${bucketStart}-${bucketEnd}%`,
    start: bucketStart,
    end: bucketEnd,
  };
}

function parseSocRange(socStart, socEnd) {
  const start = Number(socStart);
  const end = Number(socEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  return { start, end };
}

function getSocWindowMeta(socStart, socEnd) {
  const range = parseSocRange(socStart, socEnd);
  if (!range) return null;
  const { start, end } = range;
  if (start < 0 || start > 100 || end < 0 || end > 100 || end <= start) return null;

  const bucketStart = clamp(Math.floor(start / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  let bucketEnd = clamp(Math.ceil(end / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, SOC_BUCKET_SIZE, 100);

  if (bucketEnd <= bucketStart) {
    bucketEnd = Math.min(100, bucketStart + SOC_BUCKET_SIZE);
  }

  return {
    key: `${bucketStart}-${bucketEnd}`,
    label: `${bucketStart}-${bucketEnd}%`,
    start: bucketStart,
    end: bucketEnd,
  };
}

function getClampedSocRange(socStart, socEnd) {
  const range = parseSocRange(socStart, socEnd);
  if (!range) return null;

  const start = clamp(range.start, 0, 100);
  const end = clamp(range.end, 0, 100);
  if (end <= start) return null;

  return {
    start,
    end,
    delta: end - start,
  };
}

function getSocBandSlices(socStart, socEnd) {
  const range = getClampedSocRange(socStart, socEnd);
  if (!range) return [];
  const { start, end, delta } = range;

  const firstBandStart = clamp(Math.floor(start / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  const slices = [];

  for (let bandStart = firstBandStart; bandStart < end; bandStart += SOC_BUCKET_SIZE) {
    const meta = getSocBucketMeta(bandStart);
    const overlapStart = Math.max(start, meta.start);
    const overlapEnd = Math.min(end, meta.end);
    const overlap = overlapEnd - overlapStart;
    if (overlap <= 0) continue;

    slices.push({
      ...meta,
      overlap_pct: round(overlap, 1),
      weight: overlap / delta,
    });
  }

  return slices;
}

function createSocAggregate(meta) {
  return {
    ...meta,
    count: 0,
    total_weight: 0,
    total_score: 0,
    score_weight: 0,
    total_price_per_kwh: 0,
    price_weight: 0,
    total_power_kw: 0,
    power_weight: 0,
    total_duration_seconds: 0,
    duration_weight: 0,
    total_energy_kwh: 0,
    energy_weight: 0,
    total_soc_delta: 0,
    soc_delta_weight: 0,
    best_session: null,
    worst_session: null,
  };
}

function addWeightedSocMetric(target, value, weight, totalKey, weightKey) {
  if (!Number.isFinite(value) || value <= 0) return;
  target[totalKey] += value * weight;
  target[weightKey] += weight;
}

function updateSocAggregateSessionHighlights(target, scored, session) {
  const sessionSnapshot = {
    ...scored,
    soc_start: Number(session.soc_start),
    soc_end: Number(session.soc_end),
  };

  target.best_session =
    !target.best_session || Number(scored.score || 0) > Number(target.best_session.score || -1)
      ? sessionSnapshot
      : target.best_session;
  target.worst_session =
    !target.worst_session || Number(scored.score || 0) < Number(target.worst_session.score || Infinity)
      ? sessionSnapshot
      : target.worst_session;
}

function accumulateSocAggregate(target, scored, session, options = {}) {
  const { weight = 1, countWeight = 1 } = options;
  const socDelta = Math.max(0, Number(session?.soc_end || 0) - Number(session?.soc_start || 0));
  const scoreValue = Number(scored.score);
  const priceValue = Number(scored.price_per_kwh);
  const powerValue = Number(scored.avg_power_kw);
  const durationValue = Number(scored.duration_seconds);
  const energyValue = Number(scored.energy_kwh);

  target.count += countWeight;
  target.total_weight += weight;

  if (Number.isFinite(scoreValue)) {
    target.total_score += scoreValue * weight;
    target.score_weight += weight;
  }
  addWeightedSocMetric(target, priceValue, weight, 'total_price_per_kwh', 'price_weight');
  addWeightedSocMetric(target, powerValue, weight, 'total_power_kw', 'power_weight');
  addWeightedSocMetric(target, durationValue, weight, 'total_duration_seconds', 'duration_weight');
  addWeightedSocMetric(target, energyValue, weight, 'total_energy_kwh', 'energy_weight');
  if (Number.isFinite(socDelta) && socDelta > 0) {
    target.total_soc_delta += socDelta * countWeight;
    target.soc_delta_weight += countWeight;
  }

  updateSocAggregateSessionHighlights(target, scored, session);
}

function getOrCreateSocAggregate(collection, meta) {
  const existing = collection.get(meta.key);
  if (existing) return existing;

  const created = createSocAggregate(meta);
  collection.set(meta.key, created);
  return created;
}

function finalizeSocAverage(total, weight, digits, fallback = null) {
  if (!weight) return fallback;
  return digits === 0 ? Math.round(total / weight) : round(total / weight, digits);
}

function finalizeSocAggregates(collection, analyzedSessionCount) {
  return Array.from(collection.values())
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      start: entry.start,
      end: entry.end,
      count: Math.round(entry.count),
      coverage_pct: analyzedSessionCount > 0 ? round((entry.count / analyzedSessionCount) * 100, 1) : 0,
      share_pct: analyzedSessionCount > 0 ? round((entry.count / analyzedSessionCount) * 100, 1) : 0,
      avg_score: finalizeSocAverage(entry.total_score, entry.score_weight, 1),
      avg_price_per_kwh: finalizeSocAverage(entry.total_price_per_kwh, entry.price_weight, 3),
      avg_power_kw: finalizeSocAverage(entry.total_power_kw, entry.power_weight, 1),
      avg_duration_seconds: finalizeSocAverage(entry.total_duration_seconds, entry.duration_weight, 0, 0),
      avg_energy_kwh: finalizeSocAverage(entry.total_energy_kwh, entry.energy_weight, 1),
      avg_soc_delta: finalizeSocAverage(entry.total_soc_delta, entry.soc_delta_weight, 1),
      best_session: entry.best_session,
      worst_session: entry.worst_session,
    }))
    .sort((left, right) => {
      if (Number(left.start || 0) !== Number(right.start || 0)) {
        return Number(left.start || 0) - Number(right.start || 0);
      }
      return Number(left.end || 0) - Number(right.end || 0);
    });
}

function buildSocAggregateCollections(framework) {
  const byWindow = new Map();
  const byBand = new Map();
  let analyzedSessionCount = 0;

  for (const session of framework.enriched) {
    const windowMeta = getSocWindowMeta(session?.soc_start, session?.soc_end);
    if (!windowMeta) continue;

    analyzedSessionCount += 1;
    const scored = framework.perSessionScore(session);

    accumulateSocAggregate(getOrCreateSocAggregate(byWindow, windowMeta), scored, session, { weight: 1, countWeight: 1 });

    for (const bandMeta of getSocBandSlices(session?.soc_start, session?.soc_end)) {
      accumulateSocAggregate(getOrCreateSocAggregate(byBand, bandMeta), scored, session, {
        weight: bandMeta.weight,
        countWeight: 1,
      });
    }
  }

  return {
    analyzedSessionCount,
    windows: finalizeSocAggregates(byWindow, analyzedSessionCount),
    bands: finalizeSocAggregates(byBand, analyzedSessionCount),
  };
}

function buildSocWindowHighlights(rows) {
  return {
    best_efficiency_window: selectHighestNumeric(rows, 'avg_score'),
    cheapest_window: selectLowestNumeric(rows, 'avg_price_per_kwh'),
    fastest_window: selectHighestNumeric(rows, 'avg_power_kw'),
    widest_window: selectHighestNumeric(rows, 'avg_soc_delta'),
  };
}

function buildSocWindowAnalyticsPayload(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const { analyzedSessionCount, windows, bands } = buildSocAggregateCollections(framework);
  const highlightPool = bands.length ? bands : windows;

  return {
    ok: true,
    year: Number(year),
    analyzed_session_count: analyzedSessionCount,
    windows,
    bands,
    highlights: buildSocWindowHighlights(highlightPool),
  };
}

function summarizeRows(rows, label, meta = {}) {
  const base = aggregateGroup(rows, label, meta);
  const providers = new Set(rows.map((row) => labelOrFallback(row.provider, '')).filter(Boolean));
  const locations = new Set(rows.map((row) => labelOrFallback(row.location, '')).filter(Boolean));
  const vehicles = new Set(rows.map((row) => labelOrFallback(row.vehicle, '')).filter(Boolean));
  const tags = new Set(rows.flatMap((row) => parseTags(row.tags)));
  const lastSessionDate = rows.length ? sessionDateIso(rows[rows.length - 1]) : null;
  const firstSessionDate = rows.length ? sessionDateIso(rows[0]) : null;

  return {
    ...base,
    first_session_date: firstSessionDate,
    last_session_date: lastSessionDate,
    providers,
    locations,
    vehicles,
    tags,
  };
}

function finalizeDimensionSummaries(collection) {
  return Array.from(collection.values())
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      count: entry.count,
      energy_kwh: entry.energy_kwh,
      cost: entry.cost,
      avg_duration_seconds: entry.avg_duration_seconds,
      avg_kwh_per_session: entry.avg_kwh_per_session,
      avg_cost_per_session: entry.avg_cost_per_session,
      avg_price_per_kwh: entry.avg_price_per_kwh,
      avg_power_kw: entry.avg_power_kw,
      first_session_date: entry.first_session_date,
      last_session_date: entry.last_session_date,
      provider_count: entry.providers?.size || 0,
      location_count: entry.locations?.size || 0,
      vehicle_count: entry.vehicles?.size || 0,
      tags: Array.from(entry.tags || []).sort((left, right) => left.localeCompare(right, 'de')),
    }))
    .sort((left, right) => {
      if (right.cost !== left.cost) return right.cost - left.cost;
      if (right.energy_kwh !== left.energy_kwh) return right.energy_kwh - left.energy_kwh;
      return String(left.label).localeCompare(String(right.label), 'de');
    });
}

function groupSessionsByLabel(sessions, labelResolver) {
  const grouped = new Map();

  for (const session of sessions) {
    const label = labelResolver(session);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(session);
  }

  return grouped;
}

function buildTagGroups(sessions) {
  const grouped = new Map();

  for (const session of sessions) {
    for (const tag of parseTags(session.tags)) {
      if (!grouped.has(tag)) grouped.set(tag, []);
      grouped.get(tag).push(session);
    }
  }

  return grouped;
}

function buildDimensionSummaryMap(groups) {
  return new Map(
    Array.from(groups.entries()).map(([label, rows]) => [label, summarizeRows(rows, label, { key: label.toLowerCase() })])
  );
}

function buildDimensionFilters(rows) {
  return rows.map((row) => row.label);
}

function buildIntelligenceHighlights(providerRows, locationRows, vehicleRows) {
  return {
    cheapest_provider: selectLowestNumeric(providerRows, 'avg_price_per_kwh'),
    fastest_provider: selectHighestNumeric(providerRows, 'avg_power_kw'),
    strongest_location: locationRows[0] || null,
    dominant_vehicle: vehicleRows[0] || null,
  };
}

function buildIntelligenceAnalyticsPayload(sessions, year) {
  const providers = buildDimensionSummaryMap(
    groupSessionsByLabel(sessions, (session) => labelOrFallback(session.provider))
  );
  const locations = buildDimensionSummaryMap(
    groupSessionsByLabel(sessions, (session) => labelOrFallback(session.location))
  );
  const vehicles = buildDimensionSummaryMap(
    groupSessionsByLabel(sessions, (session) => labelOrFallback(session.vehicle, 'Standardfahrzeug'))
  );
  const tags = buildDimensionSummaryMap(buildTagGroups(sessions));

  const providerRows = finalizeDimensionSummaries(providers);
  const locationRows = finalizeDimensionSummaries(locations);
  const vehicleRows = finalizeDimensionSummaries(vehicles);
  const tagRows = finalizeDimensionSummaries(tags);

  return {
    ok: true,
    year: Number(year),
    providers: providerRows,
    locations: locationRows,
    vehicles: vehicleRows,
    tags: tagRows,
    highlights: buildIntelligenceHighlights(providerRows, locationRows, vehicleRows),
    filters: {
      providers: buildDimensionFilters(providerRows),
      locations: buildDimensionFilters(locationRows),
      vehicles: buildDimensionFilters(vehicleRows),
      tags: buildDimensionFilters(tagRows),
    },
  };
}

function buildDashboardPayload({ sessions, allSessions = sessions, year }) {
  const numericYear = Number(year);
  return {
    ok: true,
    year: numericYear,
    available_years: buildAvailableYearsFromSessions(allSessions, numericYear),
    stats: buildStatsPayload(sessions, year),
    monthly: buildMonthlyAnalyticsPayload(sessions, year),
    seasons: buildSeasonAnalyticsPayload(sessions, year),
    efficiency: buildEfficiencyAnalyticsPayload(sessions, year),
    outliers: calcOutlierAnalytics(sessions, year),
    soc_window_analysis: buildSocWindowAnalyticsPayload(sessions, year),
    intelligence: buildIntelligenceAnalyticsPayload(sessions, year),
    sessions: {
      rows: [...sessions].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
      meta: {
        total: sessions.length,
        offset: 0,
        limit: null,
        has_more: false,
        truncated: false,
      },
    },
  };
}

function buildSessionsCsvRows(rows) {
  return rows.map((session) => {
    const energy = Number(session.energy_kwh || 0);
    const cost = Number(session.total_cost || 0);

    return {
      date: new Date(session.date).toISOString().slice(0, 10),
      provider: session.provider ?? '',
      location: session.location ?? '',
      vehicle: session.vehicle ?? '',
      tags: session.tags ?? '',
      connector: session.connector,
      soc_start: session.soc_start,
      soc_end: session.soc_end,
      energy_kwh: session.energy_kwh,
      price_per_kwh: session.price_per_kwh,
      total_cost: session.total_cost,
      duration_seconds: session.duration_seconds ?? '',
      note: session.note ?? '',
      odo_start_km: session.odo_start_km ?? '',
      odo_end_km: session.odo_end_km ?? '',
      calc_price_per_kwh: energy > 0 ? round(cost / energy, 3) : '',
    };
  });
}

function buildMonthlyCsvRows(sessions) {
  return accumulateMonthlyBuckets(sessions).map((month) => {
    const energy = round(month.energy_kwh, 1);
    const cost = round(month.cost, 2);
    const price_per_kwh = energy > 0 ? round(cost / energy, 3) : '';
    return {
      month: month.month,
      count: month.count,
      energy_kwh: energy,
      cost,
      avg_price_per_charge: month.count ? round(cost / month.count, 2) : 0,
      price_per_kwh,
    };
  });
}

function buildSeasonsCsvRows(sessions) {
  const framework = calcEfficiencyFramework(sessions);
  const seasons = buildSeasonRows(framework, { emptyEfficiencyScore: '' });

  return seasons.map((season) => ({
    season: season.label,
    months: season.months.join(','),
    count: season.count,
    energy_kwh: season.energy_kwh,
    cost: season.cost,
    avg_price_per_kwh: season.avg_price_per_kwh ?? '',
    avg_duration_seconds: season.avg_duration_seconds,
    avg_kwh_per_session: season.avg_kwh_per_session,
    avg_cost_per_session: season.avg_cost_per_session,
    avg_power_kw: season.avg_power_kw ?? '',
    efficiency_score: season.efficiency_score,
  }));
}

module.exports = {
  SEASON_META,
  buildDashboardPayload,
  calcEfficiencyFramework,
  buildEfficiencyAnalyticsPayload,
  buildIntelligenceAnalyticsPayload,
  buildMonthlyAnalyticsPayload,
  buildMonthlyCsvRows,
  buildSeasonAnalyticsPayload,
  buildSeasonsCsvRows,
  buildSessionDerived,
  buildSessionsCsvRows,
  buildSocWindowAnalyticsPayload,
  buildStatsPayload,
  calcOutlierAnalytics,
};
