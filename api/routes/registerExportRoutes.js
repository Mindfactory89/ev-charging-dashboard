'use strict';

const {
  buildMonthlyCsvRows,
  buildSeasonsCsvRows,
  buildSessionsCsvRows,
} = require('../lib/analytics');
const { toCSV } = require('../lib/csv');
const { optionalYearFilter, yearRange } = require('../lib/year');

async function loadYearSessions(prisma, year, select) {
  const range = yearRange(year);
  if (!range) return { error: 'Bitte year=YYYY angeben (z.B. 2026).' };

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
    ...(select ? { select } : {}),
  });

  return { sessions };
}

function registerExportRoutes(fastify) {
  fastify.get('/api/export/sessions.csv', async (req, reply) => {
    const { year, range, error } = optionalYearFilter(req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });

    const where = range ? { date: { gte: range.from, lt: range.to } } : {};
    const rowsDb = await fastify.prisma.chargingSession.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 5000,
    });

    const csv = toCSV(buildSessionsCsvRows(rowsDb), [
      'date',
      'provider',
      'location',
      'vehicle',
      'tags',
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
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year, {
      date: true,
      energy_kwh: true,
      total_cost: true,
    });
    if (error) return reply.code(400).send('Bitte year=YYYY angeben (z.B. 2026).');

    const csv = toCSV(buildMonthlyCsvRows(sessions), [
      'month',
      'count',
      'energy_kwh',
      'cost',
      'avg_price_per_charge',
      'price_per_kwh',
    ]);

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="charging-months-${req.query?.year}.csv"`)
      .send(csv);
  });

  fastify.get('/api/export/seasons.csv', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send('Bitte year=YYYY angeben (z.B. 2026).');

    const csv = toCSV(buildSeasonsCsvRows(sessions), [
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
      .header('Content-Disposition', `attachment; filename="charging-seasons-${req.query?.year}.csv"`)
      .send(csv);
  });
}

module.exports = {
  registerExportRoutes,
};
