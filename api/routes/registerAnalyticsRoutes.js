'use strict';

const {
  buildIntelligenceAnalyticsPayload,
  buildSocWindowAnalyticsPayload,
  buildEfficiencyAnalyticsPayload,
  buildMonthlyAnalyticsPayload,
  buildSeasonAnalyticsPayload,
  buildStatsPayload,
  calcOutlierAnalytics,
} = require('../lib/analytics');
const { optionalYearFilter, yearRange } = require('../lib/year');

async function loadYearSessions(prisma, year) {
  const range = yearRange(year);
  if (!range) return { error: 'Bitte year=YYYY angeben (z.B. 2026).' };

  const sessions = await prisma.chargingSession.findMany({
    where: { date: { gte: range.from, lt: range.to } },
    orderBy: { date: 'asc' },
  });

  return { sessions };
}

function registerAnalyticsRoutes(fastify) {
  fastify.get('/api/stats', async (req, reply) => {
    const { year, range, error } = optionalYearFilter(req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });

    const where = range ? { date: { gte: range.from, lt: range.to } } : {};
    const sessions = await fastify.prisma.chargingSession.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return buildStatsPayload(sessions, year);
  });

  fastify.get('/api/analytics/monthly', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });
    return buildMonthlyAnalyticsPayload(sessions, req.query?.year);
  });

  fastify.get('/api/analytics/seasons', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });
    return buildSeasonAnalyticsPayload(sessions, req.query?.year);
  });

  fastify.get('/api/analytics/efficiency', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });
    return buildEfficiencyAnalyticsPayload(sessions, req.query?.year);
  });

  fastify.get('/api/analytics/outliers', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });
    return calcOutlierAnalytics(sessions, req.query?.year);
  });

  fastify.get('/api/analytics/soc-windows', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });
    return buildSocWindowAnalyticsPayload(sessions, req.query?.year);
  });

  fastify.get('/api/analytics/intelligence', async (req, reply) => {
    const { sessions, error } = await loadYearSessions(fastify.prisma, req.query?.year);
    if (error) return reply.code(400).send({ ok: false, error });
    return buildIntelligenceAnalyticsPayload(sessions, req.query?.year);
  });
}

module.exports = {
  registerAnalyticsRoutes,
};
