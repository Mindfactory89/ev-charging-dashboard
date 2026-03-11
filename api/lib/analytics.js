'use strict';

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

function buildSessionsCsvRows(rows) {
  return rows.map((session) => {
    const energy = Number(session.energy_kwh || 0);
    const cost = Number(session.total_cost || 0);

    return {
      date: new Date(session.date).toISOString().slice(0, 10),
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
  buildEfficiencyAnalyticsPayload,
  buildMonthlyAnalyticsPayload,
  buildMonthlyCsvRows,
  buildSeasonAnalyticsPayload,
  buildSeasonsCsvRows,
  buildSessionDerived,
  buildSessionsCsvRows,
  buildStatsPayload,
  calcOutlierAnalytics,
};
