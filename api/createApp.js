'use strict';

const fastifyFactory = require('fastify');
const { PrismaClient } = require('@prisma/client');
const { registerAnalyticsRoutes } = require('./routes/registerAnalyticsRoutes');
const { registerDashboardRoutes } = require('./routes/registerDashboardRoutes');
const { registerExportRoutes } = require('./routes/registerExportRoutes');
const { registerHealthRoutes } = require('./routes/registerHealthRoutes');
const { registerReleaseRoutes } = require('./routes/registerReleaseRoutes');
const { registerSessionRoutes } = require('./routes/registerSessionRoutes');
const { createCorsConfig, resolveCorsOrigin } = require('./lib/cors');

function createApp(options = {}) {
  const {
    prisma: providedPrisma,
    releaseConfig,
    fetchImpl,
    corsConfig: providedCorsConfig,
    ...fastifyOptions
  } = options;
  const fastify = fastifyFactory({ logger: true, ...fastifyOptions });
  const prisma = providedPrisma || new PrismaClient();
  const ownsPrisma = !providedPrisma;
  const corsConfig = createCorsConfig(providedCorsConfig);

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    if (ownsPrisma && typeof prisma?.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });

  fastify.addHook('onRequest', async (req, reply) => {
    const corsOrigin = resolveCorsOrigin(req, corsConfig);
    if (corsOrigin) {
      reply.header('Access-Control-Allow-Origin', corsOrigin);
      reply.header('Vary', 'Origin');
    }
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Mobility-Release-Token');
    if (req.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }
    if (req.method === 'OPTIONS') {
      reply.code(req.headers.origin && !corsOrigin ? 403 : 204).send();
      return;
    }
  });

  fastify.setErrorHandler((error, req, reply) => {
    if (error?.validation) {
      return reply.code(400).send({
        ok: false,
        error: error.message,
      });
    }

    req.log.error(error);
    return reply.code(error?.statusCode || 500).send({
      ok: false,
      error: 'Interner Serverfehler.',
    });
  });

  registerHealthRoutes(fastify);
  registerSessionRoutes(fastify);
  registerDashboardRoutes(fastify);
  registerAnalyticsRoutes(fastify);
  registerExportRoutes(fastify);
  registerReleaseRoutes(fastify, { releaseConfig, fetchImpl });

  return fastify;
}

module.exports = {
  createApp,
};
