const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../createApp');

test('dashboard route rejects missing year before touching prisma', async () => {
  const app = createApp({
    prisma: {},
    logger: false,
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/dashboard',
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /year/i);

  await app.close();
});

test('dashboard route filters by stable vehicle profile id with a legacy name fallback', async () => {
  const calls = [];
  const app = createApp({
    prisma: {
      chargingSession: {
        findMany: async (query) => {
          calls.push(query);
          return [];
        },
      },
    },
    logger: false,
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/dashboard?year=2026&vehicleProfileId=city-ev&vehicle=City%20EV',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0].where.OR, [
    { vehicle_profile_id: 'city-ev' },
    { vehicle_profile_id: null, vehicle: 'City EV' },
  ]);
  assert.deepEqual(calls[1].where.OR, calls[0].where.OR);

  await app.close();
});

test('session list rejects invalid limit values', async () => {
  const app = createApp({
    prisma: {},
    logger: false,
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/sessions?limit=9000',
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /limit/i);

  await app.close();
});

test('create session rejects incomplete payloads at schema level', async () => {
  const app = createApp({
    prisma: {},
    logger: false,
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      connector: 'CCS - DC',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /body/i);

  await app.close();
});
