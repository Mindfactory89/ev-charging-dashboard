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
