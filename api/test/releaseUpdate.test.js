const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../createApp');
const {
  compareSemverTags,
  determineUpdateAvailable,
  normalizeTag,
  setInstallState,
} = require('../lib/releaseUpdate');

function mockReleaseFetch(payload, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

const latestRelease = {
  tag_name: 'v1.3.0',
  name: 'v1.3.0 - Dashboard aufgeräumt und stabiler gemacht',
  html_url: 'https://github.com/Mindfactory89/ev-charging-dashboard/releases/tag/v1.3.0',
  tarball_url: 'https://api.github.com/repos/Mindfactory89/ev-charging-dashboard/tarball/v1.3.0',
  zipball_url: 'https://api.github.com/repos/Mindfactory89/ev-charging-dashboard/zipball/v1.3.0',
  published_at: '2026-07-03T16:39:42Z',
  body: 'Release notes',
  prerelease: false,
  draft: false,
};

test('release helpers normalize and compare semver tags', () => {
  assert.equal(normalizeTag('release/v1.3.0'), 'v1.3.0');
  assert.equal(compareSemverTags('v1.3.1', 'v1.3.0'), 1);
  assert.equal(compareSemverTags('v1.3.0', 'v1.3.0'), 0);
  assert.equal(compareSemverTags('v1.2.9', 'v1.3.0'), -1);
  assert.equal(determineUpdateAvailable('v1.2.1', 'v1.3.0'), true);
  assert.equal(determineUpdateAvailable('v1.3.0', 'v1.3.0'), false);
});

test('release check returns latest GitHub release and install capability', async () => {
  const app = createApp({
    prisma: {},
    logger: false,
    releaseConfig: {
      repo: 'Mindfactory89/ev-charging-dashboard',
      currentVersion: 'v1.2.1',
      currentCommit: '77d7ec5',
      installCommand: '',
    },
    fetchImpl: mockReleaseFetch(latestRelease),
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/release/check',
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.current.version, 'v1.2.1');
  assert.equal(body.latest.tagName, 'v1.3.0');
  assert.equal(body.updateAvailable, true);
  assert.equal(body.installEnabled, false);

  await app.close();
});

test('release install is blocked unless server command is configured', async () => {
  const app = createApp({
    prisma: {},
    logger: false,
    releaseConfig: {
      repo: 'Mindfactory89/ev-charging-dashboard',
      currentVersion: 'v1.2.1',
      currentCommit: '77d7ec5',
      installCommand: '',
    },
    fetchImpl: mockReleaseFetch(latestRelease),
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/release/install',
    payload: { tagName: 'v1.3.0' },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.json().error, /nicht freigeschaltet/);

  await app.close();
});

test('release install rejects stale tags, extra body fields, missing tokens, and cross-site preflights', async () => {
  setInstallState({ status: 'idle', startedAt: null, finishedAt: null, targetVersion: null, error: null, pid: null });

  const app = createApp({
    prisma: {},
    logger: false,
    releaseConfig: {
      repo: 'Mindfactory89/ev-charging-dashboard',
      currentVersion: 'v1.2.1',
      currentCommit: '77d7ec5',
      installCommand: 'true',
    },
    fetchImpl: mockReleaseFetch(latestRelease),
  });

  const crossSitePreflight = await app.inject({
    method: 'OPTIONS',
    url: '/api/release/install',
    headers: {
      host: 'dashboard.local:18800',
      origin: 'https://evil.example',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-mobility-release-token',
    },
  });
  assert.equal(crossSitePreflight.statusCode, 403);

  const sameHostPreflight = await app.inject({
    method: 'OPTIONS',
    url: '/api/release/install',
    headers: {
      host: 'dashboard.local:18800',
      origin: 'https://dashboard.local',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-mobility-release-token',
    },
  });
  assert.equal(sameHostPreflight.statusCode, 204);
  assert.equal(sameHostPreflight.headers['access-control-allow-origin'], 'https://dashboard.local');

  const staleTag = await app.inject({
    method: 'POST',
    url: '/api/release/install',
    payload: { tagName: 'v1.2.2' },
  });
  assert.equal(staleTag.statusCode, 409);

  const extraBodyField = await app.inject({
    method: 'POST',
    url: '/api/release/install',
    payload: {
      tagName: 'v1.3.0',
      installCommand: 'rm -rf /',
    },
  });
  assert.notEqual(extraBodyField.statusCode, 202);

  const missingToken = await app.inject({
    method: 'POST',
    url: '/api/release/install',
    payload: { tagName: 'v1.3.0' },
  });
  assert.equal(missingToken.statusCode, 403);
  assert.match(missingToken.json().error, /freigabe/i);

  const check = await app.inject({
    method: 'GET',
    url: '/api/release/check',
  });
  const checkBody = check.json();
  assert.equal(check.statusCode, 200);
  assert.equal(typeof checkBody.installAuthorization?.token, 'string');

  const started = await app.inject({
    method: 'POST',
    url: '/api/release/install',
    headers: {
      'x-mobility-release-token': checkBody.installAuthorization.token,
    },
    payload: { tagName: 'v1.3.0' },
  });
  assert.equal(started.statusCode, 202);
  assert.equal(started.json().ok, true);

  const reusedToken = await app.inject({
    method: 'POST',
    url: '/api/release/install',
    headers: {
      'x-mobility-release-token': checkBody.installAuthorization.token,
    },
    payload: { tagName: 'v1.3.0' },
  });
  assert.equal(reusedToken.statusCode, 403);

  setInstallState({ status: 'idle', startedAt: null, finishedAt: null, targetVersion: null, error: null, pid: null });
  await app.close();
});
