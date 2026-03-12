'use strict';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

function parsePort(value, fallback = 3000) {
  const raw = value == null || value === '' ? fallback : Number(value);
  return Number.isInteger(raw) && raw >= 1 && raw <= 65535 ? raw : null;
}

function validateDatabaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'DATABASE_URL ist erforderlich.';

  try {
    const parsed = new URL(raw);
    if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
      return 'DATABASE_URL muss mit postgres:// oder postgresql:// beginnen.';
    }
  } catch {
    return 'DATABASE_URL ist keine gültige URL.';
  }

  return null;
}

function readRuntimeConfig(env = process.env) {
  const errors = [];
  const databaseUrlError = validateDatabaseUrl(env.DATABASE_URL);
  if (databaseUrlError) errors.push(databaseUrlError);

  const port = parsePort(env.PORT, 3000);
  if (port == null) {
    errors.push('PORT muss eine ganze Zahl zwischen 1 und 65535 sein.');
  }

  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.name = 'RuntimeConfigError';
    error.errors = errors;
    throw error;
  }

  return {
    port,
    databaseUrl: String(env.DATABASE_URL).trim(),
    nodeEnv: String(env.NODE_ENV || 'development').trim() || 'development',
  };
}

module.exports = {
  readRuntimeConfig,
};
