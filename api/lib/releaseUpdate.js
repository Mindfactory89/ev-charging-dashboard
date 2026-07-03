'use strict';

const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const DEFAULT_RELEASE_REPO = 'Mindfactory89/ev-charging-dashboard';
const INSTALL_STATE_LIMIT = 4000;
const INSTALL_TOKEN_TTL_MS = 5 * 60 * 1000;

let installState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  targetVersion: null,
  error: null,
  pid: null,
};
let installTokens = new Map();

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeTag(value) {
  const raw = normalizeString(value);
  return raw ? raw.replace(/^release\//i, '') : '';
}

function parseSemverTag(value) {
  const tag = normalizeTag(value);
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    tag,
  };
}

function compareSemverTags(a, b) {
  const left = parseSemverTag(a);
  const right = parseSemverTag(b);
  if (!left || !right) return null;

  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] > right[key]) return 1;
    if (left[key] < right[key]) return -1;
  }

  return 0;
}

function buildLatestReleaseUrl(repo) {
  return `https://api.github.com/repos/${repo}/releases/latest`;
}

function mapLatestRelease(data) {
  const tagName = normalizeTag(data?.tag_name);
  return {
    tagName,
    name: normalizeString(data?.name, tagName),
    htmlUrl: normalizeString(data?.html_url),
    tarballUrl: normalizeString(data?.tarball_url),
    zipballUrl: normalizeString(data?.zipball_url),
    publishedAt: normalizeString(data?.published_at),
    body: normalizeString(data?.body),
    prerelease: Boolean(data?.prerelease),
    draft: Boolean(data?.draft),
  };
}

function determineUpdateAvailable(currentVersion, latestVersion) {
  if (!currentVersion || !latestVersion) return null;

  const comparison = compareSemverTags(latestVersion, currentVersion);
  if (comparison == null) {
    return normalizeTag(currentVersion) !== normalizeTag(latestVersion);
  }

  return comparison > 0;
}

function pruneInstallTokens(now = Date.now()) {
  installTokens = new Map([...installTokens].filter(([, entry]) => entry.expiresAtEpoch > now));
}

function createInstallToken(tagName, now = Date.now()) {
  const token = randomBytes(24).toString('hex');
  const normalizedTag = normalizeTag(tagName);
  const expiresAtEpoch = now + INSTALL_TOKEN_TTL_MS;

  pruneInstallTokens(now);
  installTokens.set(token, {
    tagName: normalizedTag,
    expiresAtEpoch,
  });

  return {
    token,
    expiresAt: new Date(expiresAtEpoch).toISOString(),
  };
}

function consumeInstallToken(tagName, token, now = Date.now()) {
  const normalizedTag = normalizeTag(tagName);
  const rawToken = normalizeString(token);
  if (!normalizedTag || !rawToken) return false;

  pruneInstallTokens(now);

  const entry = installTokens.get(rawToken);
  if (!entry || entry.tagName !== normalizedTag || entry.expiresAtEpoch <= now) {
    return false;
  }

  installTokens.delete(rawToken);
  return true;
}

function createReleaseConfig(env = process.env) {
  const repo = normalizeString(env.MOBILITY_RELEASE_REPO, DEFAULT_RELEASE_REPO);
  return {
    repo,
    currentVersion: normalizeTag(env.MOBILITY_CURRENT_VERSION),
    currentCommit: normalizeString(env.MOBILITY_CURRENT_COMMIT),
    installCommand: normalizeString(env.MOBILITY_UPDATE_INSTALL_COMMAND),
  };
}

function normalizeReleaseConfig(config = {}) {
  return {
    repo: normalizeString(config.repo, DEFAULT_RELEASE_REPO) || DEFAULT_RELEASE_REPO,
    currentVersion: normalizeTag(config.currentVersion),
    currentCommit: normalizeString(config.currentCommit),
    installCommand: normalizeString(config.installCommand),
  };
}

async function fetchLatestRelease(config, options = {}) {
  const releaseConfig = normalizeReleaseConfig(config);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch ist in dieser Node.js-Umgebung nicht verfügbar.');
  }

  const response = await fetchImpl(buildLatestReleaseUrl(releaseConfig.repo), {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mobility-dashboard-release-check',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Release Check fehlgeschlagen (${response.status}).`);
  }

  const data = await response.json();
  return mapLatestRelease(data);
}

async function buildReleaseStatus(config = createReleaseConfig(), options = {}) {
  const releaseConfig = normalizeReleaseConfig(config);
  const latest = await fetchLatestRelease(releaseConfig, options);
  const currentVersion = normalizeTag(releaseConfig.currentVersion);

  return {
    ok: true,
    repo: releaseConfig.repo,
    current: {
      version: currentVersion || null,
      commit: releaseConfig.currentCommit || null,
    },
    latest,
    updateAvailable: determineUpdateAvailable(currentVersion, latest.tagName),
    installEnabled: Boolean(releaseConfig.installCommand),
  };
}

function getInstallState() {
  return { ...installState };
}

function setInstallState(nextState) {
  installState = {
    ...installState,
    ...nextState,
  };
  return getInstallState();
}

function startInstallCommand(config, release) {
  const releaseConfig = normalizeReleaseConfig(config);

  if (!releaseConfig.installCommand) {
    const error = new Error('Direktinstallation ist auf diesem Server nicht freigeschaltet.');
    error.statusCode = 403;
    throw error;
  }

  if (installState.status === 'running') {
    const error = new Error('Eine Installation läuft bereits.');
    error.statusCode = 409;
    throw error;
  }

  const targetVersion = normalizeTag(release?.tagName);
  const child = spawn('/bin/sh', ['-lc', releaseConfig.installCommand], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      MOBILITY_RELEASE_REPO: releaseConfig.repo,
      MOBILITY_TARGET_VERSION: targetVersion,
      MOBILITY_TARGET_RELEASE_URL: release?.htmlUrl || '',
      MOBILITY_TARGET_TARBALL_URL: release?.tarballUrl || '',
      MOBILITY_TARGET_ZIPBALL_URL: release?.zipballUrl || '',
    },
  });

  child.once('error', (error) => {
    setInstallState({
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: truncateForLog(error?.message || 'Installationsprozess konnte nicht gestartet werden.'),
    });
  });

  child.once('exit', (code, signal) => {
    setInstallState({
      status: code === 0 ? 'finished' : 'failed',
      finishedAt: new Date().toISOString(),
      error: code === 0
        ? null
        : truncateForLog(`Installationsprozess beendet mit Code ${code ?? 'unbekannt'}${signal ? ` (${signal})` : ''}.`),
    });
  });

  child.unref();

  return setInstallState({
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    targetVersion,
    error: null,
    pid: child.pid || null,
  });
}

function truncateForLog(value) {
  const raw = normalizeString(value);
  return raw.length > INSTALL_STATE_LIMIT ? `${raw.slice(0, INSTALL_STATE_LIMIT)}...` : raw;
}

module.exports = {
  DEFAULT_RELEASE_REPO,
  buildReleaseStatus,
  consumeInstallToken,
  compareSemverTags,
  createInstallToken,
  createReleaseConfig,
  determineUpdateAvailable,
  fetchLatestRelease,
  getInstallState,
  normalizeReleaseConfig,
  normalizeTag,
  setInstallState,
  startInstallCommand,
  truncateForLog,
};
