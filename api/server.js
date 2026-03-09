'use strict';

const fastify = require('fastify')({ logger: true });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3000);

fastify.addHook('onClose', async () => {
  await prisma.$disconnect();
});

/**
 * CORS (minimal + stabil)
 */
fastify.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    reply.code(204).send();
    return;
  }
});

fastify.get('/health', async (req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, db: 'up' };
  } catch (err) {
    req.log.error(err);
    return reply.code(503).send({ ok: false, db: 'down' });
  }
});

function yearRange(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return {
    from: new Date(`${y}-01-01T00:00:00.000Z`),
    to: new Date(`${y + 1}-01-01T00:00:00.000Z`),
  };
}

function hhmmToSeconds(hhmm) {
  const s = String(hhmm ?? '').trim();
  const [hh, mm] = s.split(':').map((v) => Number(v));
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || mm < 0 || mm > 59) return null;
  return hh * 3600 + mm * 60;
}

function round(n, d = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function median(values) {
  const clean = (values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 1) return clean[mid];
  return (clean[mid - 1] + clean[mid]) / 2;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
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

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows, headers) {
  const sep = ';';
  const head = headers.join(sep);
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(sep)).join('\n');
  return head + '\n' + body + '\n';
}

function getSessionMonthUTC(s) {
  return new Date(s.date).getUTCMonth() + 1;
}

function buildSessionDerived(s) {
  const energy = Number(s.energy_kwh || 0);
  const cost = Number(s.total_cost || 0);
  const duration = Number(s.duration_seconds || 0);
  const avgPowerKw = duration > 0 ? energy / (duration / 3600) : 0;
  const pricePerKwh = energy > 0 ? cost / energy : Number(s.price_per_kwh || 0);
  const socDelta = Math.max(0, Number(s.soc_end || 0) - Number(s.soc_start || 0));
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
  const enriched = sessions.map((s) => ({ ...s, _derived: buildSessionDerived(s) }));

  const priceValues = enriched
    .map((s) => s._derived.price_per_kwh_effective)
    .filter((n) => Number.isFinite(n) && n > 0);

  const powerValues = enriched
    .map((s) => s._derived.avg_power_kw)
    .filter((n) => Number.isFinite(n) && n > 0);

  const minsPerKwhValues = enriched
    .map((s) => s._derived.minutes_per_kwh)
    .filter((n) => Number.isFinite(n) && n > 0);

  const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
  const priceMax = priceValues.length ? Math.max(...priceValues) : 0;
  const powerMin = powerValues.length ? Math.min(...powerValues) : 0;
  const powerMax = powerValues.length ? Math.max(...powerValues) : 0;
  const mpkMin = minsPerKwhValues.length ? Math.min(...minsPerKwhValues) : 0;
  const mpkMax = minsPerKwhValues.length ? Math.max(...minsPerKwhValues) : 0;

  function normLowGood(value, min, max) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 50;
    if (max <= min) return 50;
    return clamp(((max - v) / (max - min)) * 100, 0, 100);
  }

  function normHighGood(value, min, max) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 50;
    if (max <= min) return 50;
    return clamp(((v - min) / (max - min)) * 100, 0, 100);
  }

  function perSessionScore(s) {
    const d = s._derived;
    const priceScore = normLowGood(d.price_per_kwh_effective, priceMin, priceMax);
    const powerScore = d.avg_power_kw > 0 ? normHighGood(d.avg_power_kw, powerMin, powerMax) : 35;
    const speedScore = d.minutes_per_kwh > 0 ? normLowGood(d.minutes_per_kwh, mpkMin, mpkMax) : 35;

    const score =
      priceScore * 0.55 +
      powerScore * 0.25 +
      speedScore * 0.20;

    return {
      session_id: s.id,
      date: new Date(s.date).toISOString().slice(0, 10),
      connector: s.connector,
      energy_kwh: round(d.energy_kwh, 1),
      total_cost: round(d.total_cost, 2),
      duration_seconds: d.duration_seconds || null,
      avg_power_kw: d.avg_power_kw > 0 ? round(d.avg_power_kw, 1) : null,
      price_per_kwh: d.price_per_kwh_effective > 0 ? round(d.price_per_kwh_effective, 3) : null,
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
  const totalEnergy = rows.reduce((a, s) => a + Number(s.energy_kwh || 0), 0);
  const totalCost = rows.reduce((a, s) => a + Number(s.total_cost || 0), 0);
  const timedRows = rows.filter((row) => Number.isFinite(Number(row.duration_seconds)) && Number(row.duration_seconds) > 0);
  const durations = timedRows.map((s) => Number(s.duration_seconds || 0)).filter((n) => Number.isFinite(n) && n > 0);
  const totalDuration = durations.reduce((a, n) => a + n, 0);
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
    .filter((n) => n != null && n !== '')
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

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

  const median = quantileSorted(clean, 0.5);
  const q1 = quantileSorted(clean, 0.25);
  const q3 = quantileSorted(clean, 0.75);
  const iqr = q1 != null && q3 != null ? q3 - q1 : 0;
  const canUseIqr = clean.length >= 5 && Number.isFinite(iqr) && iqr > 0;

  let threshold = null;
  let method = 'median';

  if (direction === 'high') {
    threshold = canUseIqr ? q3 + iqr * 1.5 : median > 0 ? median * fallbackMultiplier : null;
    method = canUseIqr ? 'iqr' : 'median';
  } else {
    threshold = canUseIqr ? q1 - iqr * 1.5 : median > 0 ? median * fallbackMultiplier : null;
    method = canUseIqr ? 'iqr' : 'median';
  }

  return {
    sample_count: clean.length,
    median: median != null ? round(median, digits) : null,
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
  const scored = framework.enriched.map((s) => {
    const scoredRow = framework.perSessionScore(s);
    return {
      ...scoredRow,
      minutes_per_kwh: s._derived.minutes_per_kwh > 0 ? round(s._derived.minutes_per_kwh, 2) : null,
      soc_delta: s._derived.soc_delta > 0 ? round(s._derived.soc_delta, 1) : null,
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

      const median = Number(baseline.median);
      const deviationPct =
        Number.isFinite(median) && median !== 0
          ? round((Math.abs(value - median) / Math.abs(median)) * 100, 1)
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

      const current =
        bySession.get(session.session_id) ||
        {
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
      reasons: [...session.reasons].sort((a, b) => {
        const dev = Number(b.deviation_pct || 0) - Number(a.deviation_pct || 0);
        if (dev !== 0) return dev;
        return String(a.label).localeCompare(String(b.label), 'de');
      }),
    }))
    .sort((a, b) => {
      if (b.flag_count !== a.flag_count) return b.flag_count - a.flag_count;
      if (b.severity_score !== a.severity_score) return b.severity_score - a.severity_score;
      return String(b.date).localeCompare(String(a.date), 'de');
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
    const cur = Number(session.price_per_kwh ?? -1);
    const old = Number(best?.price_per_kwh ?? -1);
    return cur > old ? session : best;
  }, null);

  const lowest_power_outlier = powerOutliers.reduce((best, session) => {
    const cur = Number(session.avg_power_kw ?? Infinity);
    const old = Number(best?.avg_power_kw ?? Infinity);
    return cur < old ? session : best;
  }, null);

  const longest_outlier = durationOutliers.reduce((best, session) => {
    const cur = Number(session.duration_seconds ?? -1);
    const old = Number(best?.duration_seconds ?? -1);
    return cur > old ? session : best;
  }, null);

  const weakest_score_outlier = scoreOutliers.reduce((best, session) => {
    const cur = Number(session.score ?? Infinity);
    const old = Number(best?.score ?? Infinity);
    return cur < old ? session : best;
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

function optionalYearFilter(year) {
  if (year == null || year === '') return { year: null, range: null, error: null };

  const range = yearRange(year);
  if (!range) {
    return { year: null, range: null, error: 'Bitte year=YYYY angeben (z.B. 2026).' };
  }

  return { year: Number(year), range, error: null };
}

function parseFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseBoundedInteger(value, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) return null;
  return num;
}

function parseOptionalNonNegativeInteger(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) return NaN;
  return num;
}

function parseSessionMutation(body) {
  const b = body || {};

  const required = ['date', 'connector', 'soc_start', 'soc_end', 'energy_kwh', 'price_per_kwh'];
  for (const key of required) {
    if (b[key] === undefined || b[key] === null || b[key] === '') {
      return { error: `Fehlendes Feld: ${key}` };
    }
  }

  const date = new Date(b.date);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Ungültiges Datum.' };
  }

  const connector = String(b.connector).replace(/\s+/g, ' ').trim();
  if (!connector) {
    return { error: 'Anschluss darf nicht leer sein.' };
  }

  const soc_start = parseBoundedInteger(b.soc_start, 0, 100);
  const soc_end = parseBoundedInteger(b.soc_end, 0, 100);
  if (soc_start == null || soc_end == null) {
    return { error: 'SoC Start/Ende muss zwischen 0 und 100 liegen.' };
  }
  if (soc_end < soc_start) {
    return { error: 'SoC Ende darf nicht kleiner als SoC Start sein.' };
  }

  const energy = parseFiniteNumber(b.energy_kwh);
  if (energy == null || energy <= 0) {
    return { error: 'Energie (kWh) muss größer als 0 sein.' };
  }

  const price = parseFiniteNumber(b.price_per_kwh);
  if (price == null || price <= 0) {
    return { error: 'Preis pro kWh muss größer als 0 sein.' };
  }

  let duration_seconds = null;
  if (b.duration_hhmm != null && b.duration_hhmm !== '') {
    duration_seconds = hhmmToSeconds(b.duration_hhmm);
    if (duration_seconds == null || duration_seconds <= 0) {
      return { error: 'Dauer muss als HH:MM angegeben werden.' };
    }
  } else if (b.duration_seconds != null && b.duration_seconds !== '') {
    duration_seconds = parseFiniteNumber(b.duration_seconds);
    if (duration_seconds == null || duration_seconds <= 0) {
      return { error: 'Dauer in Sekunden muss größer als 0 sein.' };
    }
  }

  if (duration_seconds != null) {
    duration_seconds = Math.round(duration_seconds);
  }

  const odo_start_km = parseOptionalNonNegativeInteger(b.odo_start_km);
  const odo_end_km = parseOptionalNonNegativeInteger(b.odo_end_km ?? b.odometer_km);
  if (Number.isNaN(odo_start_km) || Number.isNaN(odo_end_km)) {
    return { error: 'Kilometerstände müssen positive Ganzzahlen sein.' };
  }
  if (odo_start_km != null && odo_end_km != null && odo_end_km < odo_start_km) {
    return { error: 'Kilometer Ende darf nicht kleiner als Kilometer Start sein.' };
  }

  return {
    data: {
      date,
      connector,
      soc_start,
      soc_end,
      energy_kwh: energy,
      price_per_kwh: price,
      total_cost: Number((energy * price).toFixed(2)),
      duration_seconds,
      note: b.note ? String(b.note) : null,
      odo_start_km,
      odo_end_km,
    },
  };
}

fastify.get('/api/sessions', async (req, reply) => {
  const { range, error } = optionalYearFilter(req.query?.year);
  if (error) return reply.code(400).send({ ok: false, error });
  const where = range ? { date: { gte: range.from, lt: range.to } } : {};

  const rows = await prisma.chargingSession.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 500,
  });

  return { ok: true, rows };
});

fastify.post('/api/sessions', async (req, reply) => {
  const parsed = parseSessionMutation(req.body);
  if (parsed.error) {
    return reply.code(400).send({ ok: false, error: parsed.error });
  }

  const created = await prisma.chargingSession.create({
    data: parsed.data,
  });

  return { ok: true, created };
});

fastify.patch('/api/sessions/:id', async (req, reply) => {
  const id = String(req.params.id);

  try {
    const existing = await prisma.chargingSession.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ ok: false, error: 'not found' });
    }

    const parsed = parseSessionMutation({
      date: existing.date ? new Date(existing.date).toISOString().slice(0, 10) : null,
      connector: existing.connector,
      soc_start: existing.soc_start,
      soc_end: existing.soc_end,
      energy_kwh: existing.energy_kwh,
      price_per_kwh: existing.price_per_kwh,
      duration_seconds: existing.duration_seconds,
      note: existing.note,
      odo_start_km: existing.odo_start_km,
      odo_end_km: existing.odo_end_km,
      ...req.body,
    });
    if (parsed.error) {
      return reply.code(400).send({ ok: false, error: parsed.error });
    }

    const updated = await prisma.chargingSession.update({
      where: { id },
      data: parsed.data,
    });
    return { ok: true, updated };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ ok: false, error: 'update failed' });
  }
});

fastify.delete('/api/sessions/:id', async (req, reply) => {
  const id = String(req.params.id);

  try {
    const deleted = await prisma.chargingSession.delete({ where: { id } });
    return reply.send({ ok: true, deleted });
  } catch (err) {
    if (err?.code === 'P2025') {
      return reply.code(404).send({ ok: false, error: 'not found' });
    }
    req.log.error(err);
    return reply.code(500).send({ ok: false, error: 'delete failed' });
  }
});

fastify.get('/api/stats', async (req, reply) => {
  const { year, range, error } = optionalYearFilter(req.query?.year);
  if (error) return reply.code(400).send({ ok: false, error });
  const where = range ? { date: { gte: range.from, lt: range.to } } : {};

  const sessions = await prisma.chargingSession.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  const count = sessions.length;
  const total_energy_kwh = sessions.reduce((a, s) => a + Number(s.energy_kwh || 0), 0);
  const total_cost = sessions.reduce((a, s) => a + Number(s.total_cost || 0), 0);
  const avg_kwh_per_session = count ? total_energy_kwh / count : 0;

  const timedSessions = sessions.filter((s) => Number.isFinite(Number(s.duration_seconds)) && Number(s.duration_seconds) > 0);
  const durations = timedSessions.map((s) => Number(s.duration_seconds || 0));
  const total_timed_energy_kwh = timedSessions.reduce((sum, session) => sum + Number(session.energy_kwh || 0), 0);
  const avg_duration_seconds = durations.length ? durations.reduce((a, n) => a + n, 0) / durations.length : 0;
  const avg_price_per_kwh = total_energy_kwh > 0 ? total_cost / total_energy_kwh : 0;
  const avg_price_per_charge = count ? total_cost / count : 0;
  const avg_power_kw = durations.length ? total_timed_energy_kwh / (durations.reduce((a, n) => a + n, 0) / 3600) : 0;
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

  const best_session_kwh = sessions.reduce((best, s) => (best == null || s.energy_kwh > best.energy_kwh ? s : best), null);
  const most_expensive = sessions.reduce((best, s) => (best == null || s.total_cost > best.total_cost ? s : best), null);
  const longest = sessions.reduce(
    (best, s) => (best == null || (s.duration_seconds || 0) > (best.duration_seconds || 0) ? s : best),
    null
  );

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
      energy_kwh: median(energyValues) != null ? round(median(energyValues), 1) : null,
      cost_per_session: median(costValues) != null ? round(median(costValues), 2) : null,
      duration_seconds: median(durations) != null ? Math.round(median(durations)) : null,
      price_per_kwh: median(perSessionPrices) != null ? round(median(perSessionPrices), 3) : null,
      power_kw: median(perSessionPowers) != null ? round(median(perSessionPowers), 1) : null,
    },
    best_session_kwh,
    most_expensive,
    longest,
  };
});

fastify.get('/api/analytics/monthly', async (req, reply) => {
  const year = req.query?.year;
  const range = yearRange(year);
  if (!range) return reply.code(400).send({ ok: false, error: 'Bitte year=YYYY angeben (z.B. 2026).' });

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
  });

  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, energy_kwh: 0, cost: 0 }));

  for (const s of sessions) {
    const d = new Date(s.date);
    const m = d.getUTCMonth();
    months[m].count += 1;
    months[m].energy_kwh += Number(s.energy_kwh || 0);
    months[m].cost += Number(s.total_cost || 0);
  }

  const base = months.map((m) => {
    const energy_kwh = round(m.energy_kwh, 3);
    const cost = round(m.cost, 2);
    const avg_price_per_charge = m.count ? round(cost / m.count, 2) : 0;
    const price_per_kwh = energy_kwh > 0 ? round(cost / energy_kwh, 3) : null;
    return { ...m, energy_kwh, cost, avg_price_per_charge, price_per_kwh };
  });

  function mkTrend(cur, prev) {
    if (cur == null || prev == null) return null;
    const c = Number(cur);
    const p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
    const delta = c - p;
    return { delta: round(delta, 3), pct: round(delta / p, 4) };
  }

  const monthsFinal = base.map((m, idx) => {
    const prev = idx > 0 ? base[idx - 1] : null;
    return {
      ...m,
      trend: {
        energy: prev ? mkTrend(m.energy_kwh, prev.energy_kwh) : null,
        cost: prev ? mkTrend(m.cost, prev.cost) : null,
        price_per_kwh: prev ? mkTrend(m.price_per_kwh, prev.price_per_kwh) : null,
      },
    };
  });

  const activeMonths = monthsFinal.filter((m) => m.count > 0);
  const top_energy_month = activeMonths.reduce((best, m) => (!best || m.energy_kwh > best.energy_kwh ? m : best), null);
  const top_cost_month = activeMonths.reduce((best, m) => (!best || m.cost > best.cost ? m : best), null);
  const avg_sessions_per_month = activeMonths.length
    ? Number((activeMonths.reduce((a, m) => a + m.count, 0) / activeMonths.length).toFixed(2))
    : 0;

  return {
    ok: true,
    year: Number(year),
    months: monthsFinal,
    top_energy_month,
    top_cost_month,
    avg_sessions_per_month,
  };
});

fastify.get('/api/analytics/seasons', async (req, reply) => {
  const year = req.query?.year;
  const range = yearRange(year);
  if (!range) return reply.code(400).send({ ok: false, error: 'Bitte year=YYYY angeben (z.B. 2026).' });

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
  });

  const framework = calcEfficiencyFramework(sessions);
  const bySeason = { winter: [], spring: [], summer: [], autumn: [] };

  for (const s of framework.enriched) {
    const season = monthToSeason(getSessionMonthUTC(s));
    bySeason[season].push(s);
  }

  const seasons = Object.values(SEASON_META).map((meta) => {
    const rows = bySeason[meta.key] || [];
    const base = aggregateGroup(rows, meta.label, meta);
    const scored = rows.map((s) => framework.perSessionScore(s));
    const efficiency_score = scored.length
      ? round(scored.reduce((a, s) => a + Number(s.score || 0), 0) / scored.length, 1)
      : null;

    return {
      ...base,
      efficiency_score,
      best_session: scored.reduce((best, s) => (!best || s.score > best.score ? s : best), null),
      worst_session: scored.reduce((best, s) => (!best || s.score < best.score ? s : best), null),
    };
  });

  const activeSeasons = seasons.filter((s) => s.count > 0);
  const bestSeason = activeSeasons.reduce((best, s) => (!best || (s.efficiency_score || -1) > (best.efficiency_score || -1) ? s : best), null);
  const cheapestSeason = activeSeasons.reduce((best, s) => {
    const cur = Number(s.avg_price_per_kwh ?? Infinity);
    const old = Number(best?.avg_price_per_kwh ?? Infinity);
    return cur < old ? s : best;
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
});

fastify.get('/api/analytics/efficiency', async (req, reply) => {
  const year = req.query?.year;
  const range = yearRange(year);
  if (!range) return reply.code(400).send({ ok: false, error: 'Bitte year=YYYY angeben (z.B. 2026).' });

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
  });

  const framework = calcEfficiencyFramework(sessions);
  const scored = framework.enriched.map((s) => framework.perSessionScore(s));

  const overall_score = scored.length
    ? round(scored.reduce((a, s) => a + Number(s.score || 0), 0) / scored.length, 1)
    : null;

  const cheapest = scored.reduce((best, s) => {
    const cur = Number(s.price_per_kwh ?? Infinity);
    const old = Number(best?.price_per_kwh ?? Infinity);
    return cur < old ? s : best;
  }, null);

  const fastest = scored.reduce((best, s) => {
    const cur = Number(s.avg_power_kw ?? -1);
    const old = Number(best?.avg_power_kw ?? -1);
    return cur > old ? s : best;
  }, null);

  const best = scored.reduce((prev, cur) => (!prev || cur.score > prev.score ? cur : prev), null);
  const worst = scored.reduce((prev, cur) => (!prev || cur.score < prev.score ? cur : prev), null);

  const validPrices = scored.filter((s) => s.price_per_kwh != null);
  const validPowers = scored.filter((s) => s.avg_power_kw != null);

  const avgPrice = validPrices.length
    ? round(validPrices.reduce((a, s) => a + Number(s.price_per_kwh || 0), 0) / validPrices.length, 3)
    : null;
  const avgPower = validPowers.length
    ? round(validPowers.reduce((a, s) => a + Number(s.avg_power_kw || 0), 0) / validPowers.length, 1)
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
});

fastify.get('/api/analytics/outliers', async (req, reply) => {
  const year = req.query?.year;
  const range = yearRange(year);
  if (!range) return reply.code(400).send({ ok: false, error: 'Bitte year=YYYY angeben (z.B. 2026).' });

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
  });

  return calcOutlierAnalytics(sessions, year);
});

fastify.get('/api/export/sessions.csv', async (req, reply) => {
  const { year, range, error } = optionalYearFilter(req.query?.year);
  if (error) return reply.code(400).send({ ok: false, error });
  const where = range ? { date: { gte: range.from, lt: range.to } } : {};

  const rowsDb = await prisma.chargingSession.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 5000,
  });

  const rows = rowsDb.map((s) => {
    const energy = Number(s.energy_kwh || 0);
    const cost = Number(s.total_cost || 0);
    return {
      date: new Date(s.date).toISOString().slice(0, 10),
      connector: s.connector,
      soc_start: s.soc_start,
      soc_end: s.soc_end,
      energy_kwh: s.energy_kwh,
      price_per_kwh: s.price_per_kwh,
      total_cost: s.total_cost,
      duration_seconds: s.duration_seconds ?? '',
      note: s.note ?? '',
      odo_start_km: s.odo_start_km ?? '',
      odo_end_km: s.odo_end_km ?? '',
      calc_price_per_kwh: energy > 0 ? round(cost / energy, 3) : '',
    };
  });

  const csv = toCSV(rows, [
    'date',
    'connector',
    'soc_start',
    'soc_end',
    'energy_kwh',
    'price_per_kwh',
    'total_cost',
    'duration_seconds',
    'odo_start_km',
    'odo_end_km',
    'note',
    'calc_price_per_kwh',
  ]);

  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="charging-sessions-${year || 'all'}.csv"`)
    .send(csv);
});

fastify.get('/api/export/monthly.csv', async (req, reply) => {
  const year = req.query?.year;
  const range = year ? yearRange(year) : null;
  if (!range) return reply.code(400).send('Bitte year=YYYY angeben (z.B. 2026).');

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
    select: { date: true, energy_kwh: true, total_cost: true },
  });

  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, energy_kwh: 0, cost: 0 }));

  for (const s of sessions) {
    const m = new Date(s.date).getUTCMonth();
    months[m].count += 1;
    months[m].energy_kwh += Number(s.energy_kwh || 0);
    months[m].cost += Number(s.total_cost || 0);
  }

  const rows = months.map((m) => {
    const energy = round(m.energy_kwh, 1);
    const cost = round(m.cost, 2);
    const price_per_kwh = energy > 0 ? round(cost / energy, 3) : '';
    return {
      month: m.month,
      count: m.count,
      energy_kwh: energy,
      cost,
      avg_price_per_charge: m.count ? round(cost / m.count, 2) : 0,
      price_per_kwh,
    };
  });

  const csv = toCSV(rows, ['month', 'count', 'energy_kwh', 'cost', 'avg_price_per_charge', 'price_per_kwh']);

  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="charging-months-${year}.csv"`)
    .send(csv);
});

fastify.get('/api/export/seasons.csv', async (req, reply) => {
  const year = req.query?.year;
  const range = yearRange(year);
  if (!range) return reply.code(400).send('Bitte year=YYYY angeben (z.B. 2026).');

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
  });

  const framework = calcEfficiencyFramework(sessions);
  const buckets = { winter: [], spring: [], summer: [], autumn: [] };

  for (const s of framework.enriched) {
    buckets[monthToSeason(getSessionMonthUTC(s))].push(s);
  }

  const rows = Object.values(SEASON_META).map((meta) => {
    const bucketRows = buckets[meta.key] || [];
    const base = aggregateGroup(bucketRows, meta.label, meta);
    const scored = bucketRows.map((s) => framework.perSessionScore(s));
    const efficiency_score = scored.length
      ? round(scored.reduce((a, s) => a + Number(s.score || 0), 0) / scored.length, 1)
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

  const csv = toCSV(rows, [
    'season',
    'months',
    'count',
    'energy_kwh',
    'cost',
    'avg_price_per_kwh',
    'avg_duration_seconds',
    'avg_kwh_per_session',
    'avg_cost_per_session',
    'avg_power_kw',
    'efficiency_score',
  ]);

  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="charging-seasons-${year}.csv"`)
    .send(csv);
});

fastify.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
