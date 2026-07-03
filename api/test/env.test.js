const test = require('node:test');
const assert = require('node:assert/strict');

const { readRuntimeConfig } = require('../lib/env');

test('readRuntimeConfig accepts postgres database urls and valid ports', () => {
  const config = readRuntimeConfig({
    DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/mobility?schema=public',
    PORT: '18800',
    NODE_ENV: 'production',
    TELEGRAM_BOT_TOKEN: '123:abc',
    TELEGRAM_ALLOWED_CHAT_IDS: '12345,67890',
    MOBILITY_ALLOWED_ORIGINS: 'https://dashboard.example.com',
  });

  assert.equal(config.port, 18800);
  assert.equal(config.nodeEnv, 'production');
  assert.equal(config.telegram.enabled, true);
  assert.deepEqual(config.telegram.allowedChatIds, ['12345', '67890']);
  assert.equal(config.release.repo, 'Mindfactory89/ev-charging-dashboard');
  assert.equal(config.release.currentVersion, '');
  assert.equal(config.cors.allowedOrigins, 'https://dashboard.example.com');
});

test('readRuntimeConfig reads release update settings without enabling install by default', () => {
  const config = readRuntimeConfig({
    DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/mobility?schema=public',
    PORT: '3000',
    MOBILITY_RELEASE_REPO: 'Mindfactory89/ev-charging-dashboard',
    MOBILITY_CURRENT_VERSION: 'v1.3.0',
    MOBILITY_CURRENT_COMMIT: 'bafb6ee',
  });

  assert.equal(config.release.repo, 'Mindfactory89/ev-charging-dashboard');
  assert.equal(config.release.currentVersion, 'v1.3.0');
  assert.equal(config.release.currentCommit, 'bafb6ee');
  assert.equal(config.release.installCommand, '');
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

test('readRuntimeConfig rejects partial telegram configuration', () => {
  assert.throws(
    () =>
      readRuntimeConfig({
        DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/mobility?schema=public',
        PORT: '3000',
        TELEGRAM_BOT_TOKEN: '123:abc',
      }),
    /TELEGRAM_ALLOWED_CHAT_IDS/
  );
});

test('readRuntimeConfig rejects invalid telegram chat id lists', () => {
  assert.throws(
    () =>
      readRuntimeConfig({
        DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/mobility?schema=public',
        PORT: '3000',
        TELEGRAM_BOT_TOKEN: '123:abc',
        TELEGRAM_ALLOWED_CHAT_IDS: '12345,abc',
      }),
    /komma-separierte Liste ganzer Zahlen/
  );
});
