'use strict';

const {
  CREATE_SESSION_BODY_SCHEMA,
  PATCH_SESSION_BODY_SCHEMA,
  SESSION_ID_PARAMS_SCHEMA,
  SESSION_QUERY_SCHEMA,
} = require('../lib/httpSchemas');
const { parseSessionMutation } = require('../lib/sessionMutation');
const { optionalYearFilter } = require('../lib/year');

const SESSION_LIST_MAX_LIMIT = 5000;
const SESSION_LIST_MAX_OFFSET = 1000000;
const DEFAULT_UNFILTERED_SESSION_LIMIT = 500;

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

function createErrorResponse(reply, error, statusCode = 400) {
  return reply.code(statusCode).send({ ok: false, error });
}

function parseSessionListParams(query = {}) {
  const { year, range, error } = optionalYearFilter(query.year);
  if (error) return { error };

  const limit = parseIntegerQuery(query.limit, {
    field: 'limit',
    min: 1,
    max: SESSION_LIST_MAX_LIMIT,
  });
  if (limit.error) return { error: limit.error };

  const offset = parseIntegerQuery(query.offset, {
    field: 'offset',
    min: 0,
    max: SESSION_LIST_MAX_OFFSET,
  });
  if (offset.error) return { error: offset.error };

  return {
    year,
    range,
    limit: limit.value,
    offset: offset.value ?? 0,
  };
}

function buildSessionListWhere(range) {
  return range ? { date: { gte: range.from, lt: range.to } } : {};
}

function buildSessionListQuery({ range, limit, offset }) {
  const query = {
    where: buildSessionListWhere(range),
    orderBy: { date: 'desc' },
  };

  if (offset > 0) {
    query.skip = offset;
  }

  if (limit != null) {
    query.take = limit;
  } else if (!range) {
    query.take = DEFAULT_UNFILTERED_SESSION_LIMIT;
  }

  return query;
}

function buildSessionListMeta({ year, total, offset, limit, returnedRows }) {
  const hasMore = limit != null ? offset + returnedRows < total : false;

  return {
    year,
    total,
    offset,
    limit,
    has_more: hasMore,
    truncated: hasMore,
  };
}

function buildPatchSessionPayload(existing, patch = {}) {
  return {
    date: existing.date ? new Date(existing.date).toISOString().slice(0, 10) : null,
    provider: existing.provider,
    location: existing.location,
    vehicle: existing.vehicle,
    vehicle_profile_id: existing.vehicle_profile_id,
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
    ...patch,
  };
}

function registerSessionRoutes(fastify) {
  fastify.get('/api/sessions', {
    schema: {
      querystring: SESSION_QUERY_SCHEMA,
    },
  }, async (req, reply) => {
    const params = parseSessionListParams(req.query);
    if (params.error) {
      return createErrorResponse(reply, params.error);
    }

    const query = buildSessionListQuery(params);
    const where = buildSessionListWhere(params.range);

    const [rows, total] = await Promise.all([
      fastify.prisma.chargingSession.findMany(query),
      fastify.prisma.chargingSession.count({ where }),
    ]);

    return {
      ok: true,
      rows,
      meta: buildSessionListMeta({
        year: params.year,
        total,
        offset: params.offset,
        limit: query.take ?? null,
        returnedRows: rows.length,
      }),
    };
  });

  fastify.post('/api/sessions', {
    schema: {
      body: CREATE_SESSION_BODY_SCHEMA,
    },
  }, async (req, reply) => {
    const parsed = parseSessionMutation(req.body);
    if (parsed.error) {
      return createErrorResponse(reply, parsed.error);
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
        return createErrorResponse(reply, 'not found', 404);
      }

      const parsed = parseSessionMutation(buildPatchSessionPayload(existing, req.body));

      if (parsed.error) {
        return createErrorResponse(reply, parsed.error);
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
        return createErrorResponse(reply, 'not found', 404);
      }
      req.log.error(error);
      return reply.code(500).send({ ok: false, error: 'delete failed' });
    }
  });
}

module.exports = {
  buildPatchSessionPayload,
  buildSessionListMeta,
  buildSessionListQuery,
  buildSessionListWhere,
  parseSessionListParams,
  registerSessionRoutes,
};
