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

function calcEfficiencyFramework(sessions) {
  const enriched = sessions.map((session) => ({ ...session, _derived: buildSessionDerived(session) }));

  const priceValues = enriched
    .map((session) => session._derived.price_per_kwh_effective)
    .filter((value) => Number.isFinite(value) && value > 0);

  const powerValues = enriched
    .map((session) => session._derived.avg_power_kw)
    .filter((value) => Number.isFinite(value) && value > 0);

  const minsPerKwhValues = enriched
    .map((session) => session._derived.minutes_per_kwh)
    .filter((value) => Number.isFinite(value) && value > 0);

  const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
  const priceMax = priceValues.length ? Math.max(...priceValues) : 0;
  const powerMin = powerValues.length ? Math.min(...powerValues) : 0;
  const powerMax = powerValues.length ? Math.max(...powerValues) : 0;
  const mpkMin = minsPerKwhValues.length ? Math.min(...minsPerKwhValues) : 0;
  const mpkMax = minsPerKwhValues.length ? Math.max(...minsPerKwhValues) : 0;

  function normLowGood(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 50;
    if (max <= min) return 50;
    return clamp(((max - numeric) / (max - min)) * 100, 0, 100);
  }

  function normHighGood(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 50;
    if (max <= min) return 50;
    return clamp(((numeric - min) / (max - min)) * 100, 0, 100);
  }

  function perSessionScore(session) {
    const derived = session._derived;
    const priceScore = normLowGood(derived.price_per_kwh_effective, priceMin, priceMax);
    const powerScore = derived.avg_power_kw > 0 ? normHighGood(derived.avg_power_kw, powerMin, powerMax) : 35;
    const speedScore = derived.minutes_per_kwh > 0 ? normLowGood(derived.minutes_per_kwh, mpkMin, mpkMax) : 35;

    const score =
      priceScore * 0.55 +
      powerScore * 0.25 +
      speedScore * 0.20;

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

  return {
    enriched,
    perSessionScore,
    baseline: {
      price_min: round(priceMin, 3),
      price_max: round(priceMax, 3),
      power_min_kw: round(powerMin, 1),
      power_max_kw: round(powerMax, 1),
      minutes_per_kwh_min: round(mpkMin, 2),
      minutes_per_kwh_max: round(mpkMax, 2),
    },
  };
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

function calcOutlierAnalytics(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const scored = framework.enriched.map((session) => {
    const scoredRow = framework.perSessionScore(session);
    return {
      ...scoredRow,
      minutes_per_kwh: session._derived.minutes_per_kwh > 0 ? round(session._derived.minutes_per_kwh, 2) : null,
      soc_delta: session._derived.soc_delta > 0 ? round(session._derived.soc_delta, 1) : null,
    };
  });

  const rules = [
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

  const baselines = {};
  const bySession = new Map();

  for (const rule of rules) {
    const baseline = buildOutlierBaseline(
      scored.map((session) => rule.read(session)),
      rule.direction,
      rule.fallbackMultiplier,
      rule.digits
    );

    baselines[rule.key] = baseline;
    if (baseline.threshold == null) continue;

    for (const session of scored) {
      const rawValue = rule.read(session);
      if (rawValue == null || rawValue === '') continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const isOutlier =
        rule.direction === 'high'
          ? value > Number(baseline.threshold)
          : value < Number(baseline.threshold);

      if (!isOutlier) continue;

      const medianValue = Number(baseline.median);
      const deviationPct =
        Number.isFinite(medianValue) && medianValue !== 0
          ? round((Math.abs(value - medianValue) / Math.abs(medianValue)) * 100, 1)
          : null;

      const reason = {
        key: rule.key,
        label: rule.label,
        direction: rule.direction,
        value: round(value, rule.digits),
        threshold: baseline.threshold,
        median: baseline.median,
        deviation_pct: deviationPct,
        severity:
          deviationPct != null && deviationPct >= 35
            ? 'high'
            : deviationPct != null && deviationPct >= 18
              ? 'medium'
              : 'low',
      };

      const current = bySession.get(session.session_id) || {
        ...session,
        reasons: [],
        flag_count: 0,
        severity_score: 0,
      };

      current.reasons.push(reason);
      current.flag_count += 1;
      current.severity_score +=
        rule.weight + (deviationPct != null ? Math.min(4, deviationPct / 20) : 0);

      bySession.set(session.session_id, current);
    }
  }

  const flagged_sessions = Array.from(bySession.values())
    .map((session) => ({
      ...session,
      severity_score: round(session.severity_score, 1),
      reasons: [...session.reasons].sort((left, right) => {
        const deviation = Number(right.deviation_pct || 0) - Number(left.deviation_pct || 0);
        if (deviation !== 0) return deviation;
        return String(left.label).localeCompare(String(right.label), 'de');
      }),
    }))
    .sort((left, right) => {
      if (right.flag_count !== left.flag_count) return right.flag_count - left.flag_count;
      if (right.severity_score !== left.severity_score) return right.severity_score - left.severity_score;
      return String(right.date).localeCompare(String(left.date), 'de');
    });

  const priceOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === 'price_per_kwh')
  );
  const powerOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === 'avg_power_kw')
  );
  const durationOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === 'duration_seconds')
  );
  const scoreOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === 'score')
  );

  const priciest_outlier = priceOutliers.reduce((best, session) => {
    const current = Number(session.price_per_kwh ?? -1);
    const previous = Number(best?.price_per_kwh ?? -1);
    return current > previous ? session : best;
  }, null);

  const lowest_power_outlier = powerOutliers.reduce((best, session) => {
    const current = Number(session.avg_power_kw ?? Infinity);
    const previous = Number(best?.avg_power_kw ?? Infinity);
    return current < previous ? session : best;
  }, null);

  const longest_outlier = durationOutliers.reduce((best, session) => {
    const current = Number(session.duration_seconds ?? -1);
    const previous = Number(best?.duration_seconds ?? -1);
    return current > previous ? session : best;
  }, null);

  const weakest_score_outlier = scoreOutliers.reduce((best, session) => {
    const current = Number(session.score ?? Infinity);
    const previous = Number(best?.score ?? Infinity);
    return current < previous ? session : best;
  }, null);

  return {
    ok: true,
    year: Number(year),
    session_count: scored.length,
    outlier_count: flagged_sessions.length,
    flagged_sessions,
    baselines,
    highlights: {
      worst_session: flagged_sessions[0] || null,
      priciest_outlier,
      lowest_power_outlier,
      longest_outlier,
      weakest_score_outlier,
    },
  };
}

function buildStatsPayload(sessions, year) {
  const count = sessions.length;
  const total_energy_kwh = sessions.reduce((sum, session) => sum + Number(session.energy_kwh || 0), 0);
  const total_cost = sessions.reduce((sum, session) => sum + Number(session.total_cost || 0), 0);
  const avg_kwh_per_session = count ? total_energy_kwh / count : 0;

  const timedSessions = sessions.filter((session) => Number.isFinite(Number(session.duration_seconds)) && Number(session.duration_seconds) > 0);
  const durations = timedSessions.map((session) => Number(session.duration_seconds || 0));
  const totalTimedEnergy = timedSessions.reduce((sum, session) => sum + Number(session.energy_kwh || 0), 0);
  const avg_duration_seconds = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  const avg_price_per_kwh = total_energy_kwh > 0 ? total_cost / total_energy_kwh : 0;
  const avg_price_per_charge = count ? total_cost / count : 0;
  const avg_power_kw = durations.length ? totalTimedEnergy / (durations.reduce((sum, value) => sum + value, 0) / 3600) : 0;
  const avg_cost_per_min = avg_duration_seconds > 0 ? avg_price_per_charge / (avg_duration_seconds / 60) : 0;

  const perSessionPrices = sessions
    .map((session) => buildSessionDerived(session).price_per_kwh_effective)
    .filter((value) => Number.isFinite(value) && value > 0);
  const perSessionPowers = sessions
    .map((session) => buildSessionDerived(session).avg_power_kw)
    .filter((value) => Number.isFinite(value) && value > 0);
  const energyValues = sessions
    .map((session) => Number(session.energy_kwh))
    .filter((value) => Number.isFinite(value) && value > 0);
  const costValues = sessions
    .map((session) => Number(session.total_cost))
    .filter((value) => Number.isFinite(value) && value >= 0);

  const best_session_kwh = sessions.reduce((best, session) => (best == null || session.energy_kwh > best.energy_kwh ? session : best), null);
  const most_expensive = sessions.reduce((best, session) => (best == null || session.total_cost > best.total_cost ? session : best), null);
  const longest = sessions.reduce(
    (best, session) => (best == null || (session.duration_seconds || 0) > (best.duration_seconds || 0) ? session : best),
    null
  );

  const medianDuration = median(durations);
  const medianEnergy = median(energyValues);
  const medianCost = median(costValues);
  const medianPrice = median(perSessionPrices);
  const medianPower = median(perSessionPowers);

  return {
    ok: true,
    year: year ? Number(year) : null,
    count,
    total_energy_kwh: Number(total_energy_kwh.toFixed(3)),
    total_cost: Number(total_cost.toFixed(2)),
    avg_kwh_per_session: Number(avg_kwh_per_session.toFixed(2)),
    avg_duration_seconds: Math.round(avg_duration_seconds),
    avg_price_per_kwh: Number(avg_price_per_kwh.toFixed(3)),
    avg_price_per_charge: Number(avg_price_per_charge.toFixed(2)),
    avg_power_kw: Number(avg_power_kw.toFixed(1)),
    avg_cost_per_min: Number(avg_cost_per_min.toFixed(2)),
    medians: {
      energy_kwh: medianEnergy != null ? round(medianEnergy, 1) : null,
      cost_per_session: medianCost != null ? round(medianCost, 2) : null,
      duration_seconds: medianDuration != null ? Math.round(medianDuration) : null,
      price_per_kwh: medianPrice != null ? round(medianPrice, 3) : null,
      power_kw: medianPower != null ? round(medianPower, 1) : null,
    },
    best_session_kwh,
    most_expensive,
    longest,
  };
}

function buildMonthlyAnalyticsPayload(sessions, year) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0, energy_kwh: 0, cost: 0 }));

  for (const session of sessions) {
    const monthIndex = new Date(session.date).getUTCMonth();
    months[monthIndex].count += 1;
    months[monthIndex].energy_kwh += Number(session.energy_kwh || 0);
    months[monthIndex].cost += Number(session.total_cost || 0);
  }

  const base = months.map((month) => {
    const energy_kwh = round(month.energy_kwh, 3);
    const cost = round(month.cost, 2);
    const avg_price_per_charge = month.count ? round(cost / month.count, 2) : 0;
    const price_per_kwh = energy_kwh > 0 ? round(cost / energy_kwh, 3) : null;
    return { ...month, energy_kwh, cost, avg_price_per_charge, price_per_kwh };
  });

  function mkTrend(current, previous) {
    if (current == null || previous == null) return null;
    const currentValue = Number(current);
    const previousValue = Number(previous);
    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return null;
    const delta = currentValue - previousValue;
    return { delta: round(delta, 3), pct: round(delta / previousValue, 4) };
  }

  const monthsFinal = base.map((month, index) => {
    const previous = index > 0 ? base[index - 1] : null;
    return {
      ...month,
      trend: {
        energy: previous ? mkTrend(month.energy_kwh, previous.energy_kwh) : null,
        cost: previous ? mkTrend(month.cost, previous.cost) : null,
        price_per_kwh: previous ? mkTrend(month.price_per_kwh, previous.price_per_kwh) : null,
      },
    };
  });

  const activeMonths = monthsFinal.filter((month) => month.count > 0);
  const top_energy_month = activeMonths.reduce((best, month) => (!best || month.energy_kwh > best.energy_kwh ? month : best), null);
  const top_cost_month = activeMonths.reduce((best, month) => (!best || month.cost > best.cost ? month : best), null);
  const avg_sessions_per_month = activeMonths.length
    ? Number((activeMonths.reduce((sum, month) => sum + month.count, 0) / activeMonths.length).toFixed(2))
    : 0;

  return {
    ok: true,
    year: Number(year),
    months: monthsFinal,
    top_energy_month,
    top_cost_month,
    avg_sessions_per_month,
  };
}

function buildSeasonAnalyticsPayload(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const bySeason = { winter: [], spring: [], summer: [], autumn: [] };

  for (const session of framework.enriched) {
    const season = monthToSeason(getSessionMonthUTC(session));
    bySeason[season].push(session);
  }

  const seasons = Object.values(SEASON_META).map((meta) => {
    const rows = bySeason[meta.key] || [];
    const base = aggregateGroup(rows, meta.label, meta);
    const scored = rows.map((session) => framework.perSessionScore(session));
    const efficiency_score = scored.length
      ? round(scored.reduce((sum, session) => sum + Number(session.score || 0), 0) / scored.length, 1)
      : null;

    return {
      ...base,
      efficiency_score,
      best_session: scored.reduce((best, session) => (!best || session.score > best.score ? session : best), null),
      worst_session: scored.reduce((best, session) => (!best || session.score < best.score ? session : best), null),
    };
  });

  const activeSeasons = seasons.filter((season) => season.count > 0);
  const bestSeason = activeSeasons.reduce(
    (best, season) => (!best || (season.efficiency_score || -1) > (best.efficiency_score || -1) ? season : best),
    null
  );
  const cheapestSeason = activeSeasons.reduce((best, season) => {
    const current = Number(season.avg_price_per_kwh ?? Infinity);
    const previous = Number(best?.avg_price_per_kwh ?? Infinity);
    return current < previous ? season : best;
  }, null);

  return {
    ok: true,
    year: Number(year),
    seasons,
    highlights: {
      best_efficiency_season: bestSeason,
      cheapest_season: cheapestSeason,
    },
    baseline: framework.baseline,
  };
}

function buildEfficiencyAnalyticsPayload(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const scored = framework.enriched.map((session) => framework.perSessionScore(session));

  const overall_score = scored.length
    ? round(scored.reduce((sum, session) => sum + Number(session.score || 0), 0) / scored.length, 1)
    : null;

  const cheapest = scored.reduce((best, session) => {
    const current = Number(session.price_per_kwh ?? Infinity);
    const previous = Number(best?.price_per_kwh ?? Infinity);
    return current < previous ? session : best;
  }, null);

  const fastest = scored.reduce((best, session) => {
    const current = Number(session.avg_power_kw ?? -1);
    const previous = Number(best?.avg_power_kw ?? -1);
    return current > previous ? session : best;
  }, null);

  const best = scored.reduce((previous, current) => (!previous || current.score > previous.score ? current : previous), null);
  const worst = scored.reduce((previous, current) => (!previous || current.score < previous.score ? current : previous), null);

  const validPrices = scored.filter((session) => session.price_per_kwh != null);
  const validPowers = scored.filter((session) => session.avg_power_kw != null);

  const avgPrice = validPrices.length
    ? round(validPrices.reduce((sum, session) => sum + Number(session.price_per_kwh || 0), 0) / validPrices.length, 3)
    : null;
  const avgPower = validPowers.length
    ? round(validPowers.reduce((sum, session) => sum + Number(session.avg_power_kw || 0), 0) / validPowers.length, 1)
    : null;

  return {
    ok: true,
    year: Number(year),
    overall_score,
    score_label:
      overall_score == null
        ? 'Keine Daten'
        : overall_score >= 80
          ? 'Sehr effizient'
          : overall_score >= 65
            ? 'Effizient'
            : overall_score >= 50
              ? 'Solide'
              : 'Optimierungspotenzial',
    session_count: scored.length,
    averages: {
      price_per_kwh: avgPrice,
      power_kw: avgPower,
    },
    best_session: best,
    worst_session: worst,
    cheapest_session: cheapest,
    fastest_session: fastest,
    baseline: framework.baseline,
    weights: {
      price_score: 0.55,
      power_score: 0.25,
      speed_score: 0.20,
    },
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

function getSocWindowMeta(socStart, socEnd) {
  const start = Number(socStart);
  const end = Number(socEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
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

function getSocBandSlices(socStart, socEnd) {
  const start = Number(socStart);
  const end = Number(socEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

  const clampedStart = clamp(start, 0, 100);
  const clampedEnd = clamp(end, 0, 100);
  const totalDelta = clampedEnd - clampedStart;
  if (totalDelta <= 0) return [];

  const firstBandStart = clamp(Math.floor(clampedStart / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  const slices = [];

  for (let bandStart = firstBandStart; bandStart < clampedEnd; bandStart += SOC_BUCKET_SIZE) {
    const meta = getSocBucketMeta(bandStart);
    const overlapStart = Math.max(clampedStart, meta.start);
    const overlapEnd = Math.min(clampedEnd, meta.end);
    const overlap = overlapEnd - overlapStart;
    if (overlap <= 0) continue;

    slices.push({
      ...meta,
      overlap_pct: round(overlap, 1),
      weight: overlap / totalDelta,
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
  if (Number.isFinite(priceValue) && priceValue > 0) {
    target.total_price_per_kwh += priceValue * weight;
    target.price_weight += weight;
  }
  if (Number.isFinite(powerValue) && powerValue > 0) {
    target.total_power_kw += powerValue * weight;
    target.power_weight += weight;
  }
  if (Number.isFinite(durationValue) && durationValue > 0) {
    target.total_duration_seconds += durationValue * weight;
    target.duration_weight += weight;
  }
  if (Number.isFinite(energyValue) && energyValue > 0) {
    target.total_energy_kwh += energyValue * weight;
    target.energy_weight += weight;
  }
  if (Number.isFinite(socDelta) && socDelta > 0) {
    target.total_soc_delta += socDelta * countWeight;
    target.soc_delta_weight += countWeight;
  }

  const sessionSnapshot = { ...scored, soc_start: Number(session.soc_start), soc_end: Number(session.soc_end) };
  target.best_session =
    !target.best_session || Number(scored.score || 0) > Number(target.best_session.score || -1) ? sessionSnapshot : target.best_session;
  target.worst_session =
    !target.worst_session || Number(scored.score || 0) < Number(target.worst_session.score || Infinity) ? sessionSnapshot : target.worst_session;
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
      avg_score: entry.score_weight ? round(entry.total_score / entry.score_weight, 1) : null,
      avg_price_per_kwh: entry.price_weight ? round(entry.total_price_per_kwh / entry.price_weight, 3) : null,
      avg_power_kw: entry.power_weight ? round(entry.total_power_kw / entry.power_weight, 1) : null,
      avg_duration_seconds: entry.duration_weight ? Math.round(entry.total_duration_seconds / entry.duration_weight) : 0,
      avg_energy_kwh: entry.energy_weight ? round(entry.total_energy_kwh / entry.energy_weight, 1) : null,
      avg_soc_delta: entry.soc_delta_weight ? round(entry.total_soc_delta / entry.soc_delta_weight, 1) : null,
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

function buildSocWindowAnalyticsPayload(sessions, year) {
  const framework = calcEfficiencyFramework(sessions);
  const byWindow = new Map();
  const byBand = new Map();
  let analyzedSessionCount = 0;

  for (const session of framework.enriched) {
    const windowMeta = getSocWindowMeta(session?.soc_start, session?.soc_end);
    if (!windowMeta) continue;
    analyzedSessionCount += 1;

    const scored = framework.perSessionScore(session);
    const windowBucket = byWindow.get(windowMeta.key) || createSocAggregate(windowMeta);
    accumulateSocAggregate(windowBucket, scored, session, { weight: 1, countWeight: 1 });
    byWindow.set(windowMeta.key, windowBucket);

    const bandSlices = getSocBandSlices(session?.soc_start, session?.soc_end);
    for (const bandMeta of bandSlices) {
      const bandBucket = byBand.get(bandMeta.key) || createSocAggregate(bandMeta);
      accumulateSocAggregate(bandBucket, scored, session, { weight: bandMeta.weight, countWeight: 1 });
      byBand.set(bandMeta.key, bandBucket);
    }
  }

  const windows = finalizeSocAggregates(byWindow, analyzedSessionCount);
  const bands = finalizeSocAggregates(byBand, analyzedSessionCount);
  const highlightPool = bands.length ? bands : windows;

  return {
    ok: true,
    year: Number(year),
    analyzed_session_count: analyzedSessionCount,
    windows,
    bands,
    highlights: {
      best_efficiency_window: highlightPool.reduce((best, entry) => (!best || Number(entry.avg_score || -1) > Number(best.avg_score || -1) ? entry : best), null),
      cheapest_window: highlightPool.reduce((best, entry) => (!best || Number(entry.avg_price_per_kwh ?? Infinity) < Number(best.avg_price_per_kwh ?? Infinity) ? entry : best), null),
      fastest_window: highlightPool.reduce((best, entry) => (!best || Number(entry.avg_power_kw || -1) > Number(best.avg_power_kw || -1) ? entry : best), null),
      widest_window: highlightPool.reduce((best, entry) => (!best || Number(entry.avg_soc_delta || -1) > Number(best.avg_soc_delta || -1) ? entry : best), null),
    },
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

function buildIntelligenceAnalyticsPayload(sessions, year) {
  const providerGroups = groupSessionsByLabel(sessions, (session) => labelOrFallback(session.provider));
  const locationGroups = groupSessionsByLabel(sessions, (session) => labelOrFallback(session.location));
  const vehicleGroups = groupSessionsByLabel(sessions, (session) => labelOrFallback(session.vehicle, 'Standardfahrzeug'));
  const tagGroups = new Map();

  for (const session of sessions) {
    for (const tag of parseTags(session.tags)) {
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);
      tagGroups.get(tag).push(session);
    }
  }

  const providers = new Map(
    Array.from(providerGroups.entries()).map(([label, rows]) => [label, summarizeRows(rows, label, { key: label.toLowerCase() })])
  );
  const locations = new Map(
    Array.from(locationGroups.entries()).map(([label, rows]) => [label, summarizeRows(rows, label, { key: label.toLowerCase() })])
  );
  const vehicles = new Map(
    Array.from(vehicleGroups.entries()).map(([label, rows]) => [label, summarizeRows(rows, label, { key: label.toLowerCase() })])
  );
  const tags = new Map(
    Array.from(tagGroups.entries()).map(([label, rows]) => [label, summarizeRows(rows, label, { key: label.toLowerCase() })])
  );

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
    highlights: {
      cheapest_provider: providerRows.reduce((best, row) => (!best || Number(row.avg_price_per_kwh ?? Infinity) < Number(best.avg_price_per_kwh ?? Infinity) ? row : best), null),
      fastest_provider: providerRows.reduce((best, row) => (!best || Number(row.avg_power_kw || -1) > Number(best.avg_power_kw || -1) ? row : best), null),
      strongest_location: locationRows[0] || null,
      dominant_vehicle: vehicleRows[0] || null,
    },
    filters: {
      providers: providerRows.map((row) => row.label),
      locations: locationRows.map((row) => row.label),
      vehicles: vehicleRows.map((row) => row.label),
      tags: tagRows.map((row) => row.label),
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
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0, energy_kwh: 0, cost: 0 }));

  for (const session of sessions) {
    const monthIndex = new Date(session.date).getUTCMonth();
    months[monthIndex].count += 1;
    months[monthIndex].energy_kwh += Number(session.energy_kwh || 0);
    months[monthIndex].cost += Number(session.total_cost || 0);
  }

  return months.map((month) => {
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
  const buckets = { winter: [], spring: [], summer: [], autumn: [] };

  for (const session of framework.enriched) {
    buckets[monthToSeason(getSessionMonthUTC(session))].push(session);
  }

  return Object.values(SEASON_META).map((meta) => {
    const bucketRows = buckets[meta.key] || [];
    const base = aggregateGroup(bucketRows, meta.label, meta);
    const scored = bucketRows.map((session) => framework.perSessionScore(session));
    const efficiency_score = scored.length
      ? round(scored.reduce((sum, session) => sum + Number(session.score || 0), 0) / scored.length, 1)
      : '';

    return {
      season: base.label,
      months: meta.months.join(','),
      count: base.count,
      energy_kwh: base.energy_kwh,
      cost: base.cost,
      avg_price_per_kwh: base.avg_price_per_kwh ?? '',
      avg_duration_seconds: base.avg_duration_seconds,
      avg_kwh_per_session: base.avg_kwh_per_session,
      avg_cost_per_session: base.avg_cost_per_session,
      avg_power_kw: base.avg_power_kw ?? '',
      efficiency_score,
    };
  });
}

module.exports = {
  SEASON_META,
  buildDashboardPayload,
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
