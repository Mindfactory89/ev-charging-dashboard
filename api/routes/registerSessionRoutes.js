'use strict';

const {
  CREATE_SESSION_BODY_SCHEMA,
  PATCH_SESSION_BODY_SCHEMA,
  SESSION_ID_PARAMS_SCHEMA,
  SESSION_QUERY_SCHEMA,
} = require('../lib/httpSchemas');
const { parseSessionMutation } = require('../lib/sessionMutation');
const { optionalYearFilter } = require('../lib/year');

function parseIntegerQuery(value, { field, min = 0, max = Number.MAX_SAFE_INTEGER, allowEmpty = true }) {
  if (value == null || value === '') {
    return allowEmpty ? { value: null } : { error: `${field} ist erforderlich.` };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { error: `${field} muss eine ganze Zahl zwischen ${min} und ${max} sein.` };
  }

  return { value: parsed };
}

function registerSessionRoutes(fastify) {
  fastify.get('/api/sessions', {
    schema: {
      querystring: SESSION_QUERY_SCHEMA,
    },
  }, async (req, reply) => {
    const { year, range, error } = optionalYearFilter(req.query?.year);
    const limit = parseIntegerQuery(req.query?.limit, { field: 'limit', min: 1, max: 5000 });
    const offset = parseIntegerQuery(req.query?.offset, { field: 'offset', min: 0, max: 1000000 });

    if (error) return reply.code(400).send({ ok: false, error });
    if (limit.error) return reply.code(400).send({ ok: false, error: limit.error });
    if (offset.error) return reply.code(400).send({ ok: false, error: offset.error });

    const where = range ? { date: { gte: range.from, lt: range.to } } : {};
    const query = {
      where,
      orderBy: { date: 'desc' },
    };

    if (offset.value) {
      query.skip = offset.value;
    }

    if (limit.value != null) {
      query.take = limit.value;
    } else if (!range) {
      query.take = 500;
    }

    const [rows, total] = await Promise.all([
      fastify.prisma.chargingSession.findMany(query),
      fastify.prisma.chargingSession.count({ where }),
    ]);

    const appliedOffset = offset.value ?? 0;
    const appliedLimit = query.take ?? null;

    return {
      ok: true,
      rows,
      meta: {
        year,
        total,
        offset: appliedOffset,
        limit: appliedLimit,
        has_more: appliedLimit != null ? appliedOffset + rows.length < total : false,
        truncated: appliedLimit != null && appliedOffset + rows.length < total,
      },
    };
  });

  fastify.post('/api/sessions', {
    schema: {
      body: CREATE_SESSION_BODY_SCHEMA,
    },
  }, async (req, reply) => {
    const parsed = parseSessionMutation(req.body);
    if (parsed.error) {
      return reply.code(400).send({ ok: false, error: parsed.error });
    }

    const created = await fastify.prisma.chargingSession.create({
      data: parsed.data,
    });

    return { ok: true, created };
  });

  fastify.patch('/api/sessions/:id', {
    schema: {
      params: SESSION_ID_PARAMS_SCHEMA,
      body: PATCH_SESSION_BODY_SCHEMA,
    },
  }, async (req, reply) => {
    const id = String(req.params.id);

    try {
      const existing = await fastify.prisma.chargingSession.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'not found' });
      }

      const parsed = parseSessionMutation({
        date: existing.date ? new Date(existing.date).toISOString().slice(0, 10) : null,
        provider: existing.provider,
        location: existing.location,
        vehicle: existing.vehicle,
        tags: existing.tags,
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

      const updated = await fastify.prisma.chargingSession.update({
        where: { id },
        data: parsed.data,
      });

      return { ok: true, updated };
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ ok: false, error: 'update failed' });
    }
  });

  fastify.delete('/api/sessions/:id', {
    schema: {
      params: SESSION_ID_PARAMS_SCHEMA,
    },
  }, async (req, reply) => {
    const id = String(req.params.id);

    try {
      const deleted = await fastify.prisma.chargingSession.delete({ where: { id } });
      return reply.send({ ok: true, deleted });
    } catch (error) {
      if (error?.code === 'P2025') {
        return reply.code(404).send({ ok: false, error: 'not found' });
      }
      req.log.error(error);
      return reply.code(500).send({ ok: false, error: 'delete failed' });
    }
  });
}

module.exports = {
  registerSessionRoutes,
};
