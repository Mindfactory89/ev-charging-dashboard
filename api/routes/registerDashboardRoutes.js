'use strict';

const { buildDashboardPayload } = require('../lib/analytics');
const { DASHBOARD_QUERY_SCHEMA } = require('../lib/httpSchemas');
const { yearRange } = require('../lib/year');

function registerDashboardRoutes(fastify) {
  fastify.get('/api/dashboard', {
    schema: {
      querystring: DASHBOARD_QUERY_SCHEMA,
    },
  }, async (req, reply) => {
    const year = Number(req.query?.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send({ ok: false, error: 'Bitte year=YYYY angeben (z.B. 2026).' });
    }

    const range = yearRange(year);
    const vehicleProfileId = String(req.query?.vehicleProfileId || '').trim();
    const vehicle = String(req.query?.vehicle || '').trim();
    const vehicleWhere = vehicleProfileId
      ? {
          OR: [
            { vehicle_profile_id: vehicleProfileId },
            ...(vehicle ? [{ vehicle_profile_id: null, vehicle }] : []),
          ],
        }
      : vehicle
        ? { vehicle }
        : {};
    const [sessions, allSessionDates] = await Promise.all([
      fastify.prisma.chargingSession.findMany({
        where: { date: { gte: range.from, lt: range.to }, ...vehicleWhere },
        orderBy: { date: 'asc' },
      }),
      fastify.prisma.chargingSession.findMany({
        where: vehicleWhere,
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
