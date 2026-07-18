'use strict';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const MAX_ORIGIN_LENGTH = 2048;

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function parseCsv(value) {
  return normalizeString(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOrigin(value) {
  const raw = normalizeString(value);
  if (!raw || raw.length > MAX_ORIGIN_LENGTH) return '';

  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function parseHostnameFromOrigin(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function parseHostnameFromHost(value) {
  const raw = normalizeString(value);
  if (!raw) return '';

  try {
    return new URL(`http://${raw}`).hostname.toLowerCase();
  } catch {
    return raw.split(':')[0].toLowerCase();
  }
}

function isSameRuntimeHost(origin, requestHost) {
  const originHost = parseHostnameFromOrigin(origin);
  const host = parseHostnameFromHost(requestHost);
  if (!originHost || !host) return false;
  if (originHost === host) return true;
  return LOCAL_HOSTS.has(originHost) && LOCAL_HOSTS.has(host);
}

function createCorsConfig(config = {}) {
  const explicitOrigins = new Set([
    ...parseCsv(config.allowedOrigins),
    ...parseCsv(process.env.MOBILITY_ALLOWED_ORIGINS),
  ].map(normalizeOrigin).filter(Boolean));

  return {
    allowedOrigins: explicitOrigins,
  };
}

function resolveCorsOrigin(req, config = createCorsConfig()) {
  const origin = normalizeOrigin(req.headers.origin);
  if (!origin) return '';
  if (config.allowedOrigins.has(origin)) return origin;
  if (isSameRuntimeHost(origin, req.headers.host)) return origin;
  return '';
}

module.exports = {
  createCorsConfig,
  isSameRuntimeHost,
  normalizeOrigin,
  resolveCorsOrigin,
};
