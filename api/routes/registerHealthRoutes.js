'use strict';

function registerHealthRoutes(fastify) {
  fastify.get('/health', async (req, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: 'up' };
    } catch (error) {
      req.log.error(error);
      return reply.code(503).send({ ok: false, db: 'down' });
    }
  });
}

module.exports = {
  registerHealthRoutes,
};
