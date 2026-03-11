'use strict';

const fastifyFactory = require('fastify');
const { PrismaClient } = require('@prisma/client');
const { registerAnalyticsRoutes } = require('./routes/registerAnalyticsRoutes');
const { registerDashboardRoutes } = require('./routes/registerDashboardRoutes');
const { registerExportRoutes } = require('./routes/registerExportRoutes');
const { registerHealthRoutes } = require('./routes/registerHealthRoutes');
const { registerSessionRoutes } = require('./routes/registerSessionRoutes');

function createApp(options = {}) {
  const fastify = fastifyFactory({ logger: true, ...options });
  const prisma = new PrismaClient();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  fastify.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (req.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }
    if (req.method === 'OPTIONS') {
      reply.code(204).send();
      return;
    }
  });

  registerHealthRoutes(fastify);
  registerSessionRoutes(fastify);
  registerDashboardRoutes(fastify);
  registerAnalyticsRoutes(fastify);
  registerExportRoutes(fastify);

  return fastify;
}

module.exports = {
  createApp,
};
