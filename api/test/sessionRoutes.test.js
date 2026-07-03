const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../createApp');
const {
  buildSessionListQuery,
  parseSessionListParams,
} = require('../routes/registerSessionRoutes');

test('parseSessionListParams returns normalized defaults for unfiltered lists', () => {
  const result = parseSessionListParams({});

  assert.equal(result.error, undefined);
  assert.equal(result.year, null);
  assert.equal(result.range, null);
  assert.equal(result.limit, null);
  assert.equal(result.offset, 0);
});

test('buildSessionListQuery applies the fallback limit only without a year filter', () => {
  const unfilteredQuery = buildSessionListQuery({
    range: null,
    limit: null,
    offset: 0,
  });
  const filteredQuery = buildSessionListQuery({
    range: {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2027-01-01T00:00:00.000Z'),
    },
    limit: null,
    offset: 0,
  });

  assert.equal(unfilteredQuery.take, 500);
  assert.equal(filteredQuery.take, undefined);
});

test('patch session merges stored values before validating and updating', async () => {
  const existing = {
    id: 'session-1',
    date: new Date('2026-03-12T00:00:00.000Z'),
    provider: 'Ionity',
    location: 'Brohltal Ost',
    vehicle: 'CUPRA Born',
    tags: 'hpc',
    connector: 'CCS - DC',
    soc_start: 12,
    soc_end: 78,
    energy_kwh: 44.5,
    price_per_kwh: 0.59,
    duration_seconds: 1800,
    note: 'Autobahn-Stopp',
    odo_start_km: 1000,
    odo_end_km: 1120,
  };

  let updateCall = null;

  const app = createApp({
    prisma: {
      chargingSession: {
        findUnique: async ({ where }) => (where.id === existing.id ? existing : null),
        update: async (payload) => {
          updateCall = payload;
          return { id: payload.where.id, ...payload.data };
        },
      },
    },
    logger: false,
  });

  const response = await app.inject({
    method: 'PATCH',
    url: `/api/sessions/${existing.id}`,
    payload: {
      price_per_kwh: 0.5,
    },
  });

  assert.equal(response.statusCode, 200);

  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.updated.connector, 'CCS - DC');
  assert.equal(body.updated.provider, 'Ionity');
  assert.equal(body.updated.price_per_kwh, 0.5);
  assert.equal(body.updated.total_cost, 22.25);

  assert.deepEqual(updateCall.where, { id: existing.id });
  assert.equal(updateCall.data.energy_kwh, 44.5);
  assert.equal(updateCall.data.soc_start, 12);
  assert.equal(updateCall.data.soc_end, 78);
  assert.equal(updateCall.data.price_per_kwh, 0.5);
  assert.equal(updateCall.data.total_cost, 22.25);

  await app.close();
});
