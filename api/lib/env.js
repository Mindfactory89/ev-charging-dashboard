'use strict';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

function parsePort(value, fallback = 3000) {
  const raw = value == null || value === '' ? fallback : Number(value);
  return Number.isInteger(raw) && raw >= 1 && raw <= 65535 ? raw : null;
}

function parseCsvIntegers(value) {
  const raw = String(value || '').trim();
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

  const telegramBotToken = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const telegramChatIds = parseCsvIntegers(env.TELEGRAM_ALLOWED_CHAT_IDS);
  if (telegramChatIds.error) {
    errors.push(telegramChatIds.error);
  }

  const telegramRequested = Boolean(telegramBotToken || telegramChatIds.value?.length);
  if (telegramRequested && !telegramBotToken) {
    errors.push('TELEGRAM_BOT_TOKEN ist erforderlich, sobald Telegram aktiviert ist.');
  }
  if (telegramRequested && !telegramChatIds.value?.length) {
    errors.push('TELEGRAM_ALLOWED_CHAT_IDS muss mindestens eine Chat-ID enthalten, sobald Telegram aktiviert ist.');
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
    telegram: {
      enabled: Boolean(telegramBotToken && telegramChatIds.value?.length),
      botToken: telegramBotToken || null,
      allowedChatIds: telegramChatIds.value || [],
    },
  };
}

module.exports = {
  readRuntimeConfig,
};
