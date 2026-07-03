'use strict';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const DEFAULT_PORT = 3000;

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function parsePort(value, fallback = DEFAULT_PORT) {
  const raw = value == null || value === '' ? fallback : Number(value);
  return Number.isInteger(raw) && raw >= 1 && raw <= 65535 ? raw : null;
}

function parseCsvIntegers(value) {
  const raw = normalizeString(value);
  if (!raw) return { value: [] };

  const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  const invalid = entries.find((entry) => !/^-?\d+$/.test(entry));
  if (invalid) {
    return {
      error: 'TELEGRAM_ALLOWED_CHAT_IDS muss eine komma-separierte Liste ganzer Zahlen sein.',
    };
  }

  return { value: entries };
}

function validateDatabaseUrl(value) {
  const raw = normalizeString(value);
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

function addError(errors, error) {
  if (error) errors.push(error);
}

function createRuntimeConfigError(errors) {
  const error = new Error(errors.join(' '));
  error.name = 'RuntimeConfigError';
  error.errors = errors;
  return error;
}

function readDatabaseUrl(env, errors) {
  const databaseUrl = normalizeString(env.DATABASE_URL);
  addError(errors, validateDatabaseUrl(databaseUrl));
  return databaseUrl;
}

function readPort(env, errors) {
  const port = parsePort(env.PORT, DEFAULT_PORT);
  if (port == null) {
    addError(errors, 'PORT muss eine ganze Zahl zwischen 1 und 65535 sein.');
  }

  return port;
}

function readTelegramConfig(env, errors) {
  const botToken = normalizeString(env.TELEGRAM_BOT_TOKEN);
  const allowedChatIds = parseCsvIntegers(env.TELEGRAM_ALLOWED_CHAT_IDS);
  addError(errors, allowedChatIds.error);

  const telegramRequested = Boolean(botToken || allowedChatIds.value?.length);
  if (telegramRequested && !botToken) {
    addError(errors, 'TELEGRAM_BOT_TOKEN ist erforderlich, sobald Telegram aktiviert ist.');
  }
  if (telegramRequested && !allowedChatIds.value?.length) {
    addError(errors, 'TELEGRAM_ALLOWED_CHAT_IDS muss mindestens eine Chat-ID enthalten, sobald Telegram aktiviert ist.');
  }

  return {
    enabled: Boolean(botToken && allowedChatIds.value?.length),
    botToken: botToken || null,
    allowedChatIds: allowedChatIds.value || [],
  };
}

function readReleaseConfig(env) {
  return {
    repo: normalizeString(env.MOBILITY_RELEASE_REPO, 'Mindfactory89/ev-charging-dashboard') || 'Mindfactory89/ev-charging-dashboard',
    currentVersion: normalizeString(env.MOBILITY_CURRENT_VERSION),
    currentCommit: normalizeString(env.MOBILITY_CURRENT_COMMIT),
    installCommand: normalizeString(env.MOBILITY_UPDATE_INSTALL_COMMAND),
  };
}

function readCorsConfig(env) {
  return {
    allowedOrigins: normalizeString(env.MOBILITY_ALLOWED_ORIGINS),
  };
}

function readRuntimeConfig(env = process.env) {
  const errors = [];
  const databaseUrl = readDatabaseUrl(env, errors);
  const port = readPort(env, errors);
  const telegram = readTelegramConfig(env, errors);
  const release = readReleaseConfig(env);
  const cors = readCorsConfig(env);

  if (errors.length) {
    throw createRuntimeConfigError(errors);
  }

  return {
    port,
    databaseUrl,
    nodeEnv: normalizeString(env.NODE_ENV, 'development') || 'development',
    telegram,
    release,
    cors,
  };
}

module.exports = {
  readRuntimeConfig,
};
