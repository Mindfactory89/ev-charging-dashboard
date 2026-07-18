'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCorsConfig,
  isSameRuntimeHost,
  normalizeOrigin,
  resolveCorsOrigin,
} = require('../lib/cors');

test('normalizeOrigin handles paths and repeated trailing slashes without a backtracking expression', () => {
  assert.equal(normalizeOrigin(' https://dashboard.example.com/path//// '), 'https://dashboard.example.com');
  assert.equal(normalizeOrigin('http://localhost:18801/'), 'http://localhost:18801');
  assert.equal(normalizeOrigin('not a URL'), '');
});

test('normalizeOrigin rejects oversized untrusted origin values', () => {
  assert.equal(normalizeOrigin(`https://dashboard.example.com/${'/'.repeat(4096)}`), '');
});

test('CORS resolution accepts configured and same-host origins only', () => {
  const config = createCorsConfig({ allowedOrigins: 'https://dashboard.example.com' });

  assert.equal(
    resolveCorsOrigin({ headers: { origin: 'https://dashboard.example.com/', host: 'api.example.com' } }, config),
    'https://dashboard.example.com',
  );
  assert.equal(
    resolveCorsOrigin({ headers: { origin: 'https://private.example.com', host: 'private.example.com:18800' } }, config),
    'https://private.example.com',
  );
  assert.equal(
    resolveCorsOrigin({ headers: { origin: 'https://evil.example', host: 'private.example.com:18800' } }, config),
    '',
  );
  assert.equal(isSameRuntimeHost('http://localhost:8080', '127.0.0.1:18800'), true);
});
