'use strict';

const { buildDashboardPayload } = require('../lib/analytics');
const { YEAR_QUERY_REQUIRED_SCHEMA } = require('../lib/httpSchemas');
const { yearRange } = require('../lib/year');

function registerDashboardRoutes(fastify) {
  fastify.get('/api/dashboard', {
    schema: {
      querystring: YEAR_QUERY_REQUIRED_SCHEMA,
    },
  }, async (req, reply) => {
    const year = Number(req.query?.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send({ ok: false, error: 'Bitte year=YYYY angeben (z.B. 2026).' });
    }

    const range = yearRange(year);
    const [sessions, allSessionDates] = await Promise.all([
      fastify.prisma.chargingSession.findMany({
        where: { date: { gte: range.from, lt: range.to } },
        orderBy: { date: 'asc' },
      }),
      fastify.prisma.chargingSession.findMany({
        select: { date: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    return buildDashboardPayload({ sessions, allSessions: allSessionDates, year });
  });
}

module.exports = {
  registerDashboardRoutes,
};
