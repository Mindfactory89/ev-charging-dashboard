const test = require('node:test');
const assert = require('node:assert/strict');

const { readRuntimeConfig } = require('../lib/env');

test('readRuntimeConfig accepts postgres database urls and valid ports', () => {
  const config = readRuntimeConfig({
    DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/mobility?schema=public',
    PORT: '18800',
    NODE_ENV: 'production',
  });

  assert.equal(config.port, 18800);
  assert.equal(config.nodeEnv, 'production');
});

test('readRuntimeConfig rejects missing database url', () => {
  assert.throws(
    () => readRuntimeConfig({ PORT: '3000' }),
    /DATABASE_URL ist erforderlich/
  );
});

test('readRuntimeConfig rejects invalid port ranges', () => {
  assert.throws(
    () =>
      readRuntimeConfig({
        DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/mobility?schema=public',
        PORT: '70000',
      }),
    /PORT muss eine ganze Zahl/
  );
});
