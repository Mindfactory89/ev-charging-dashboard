'use strict';

const {
  buildReleaseStatus,
  consumeInstallToken,
  createInstallToken,
  getInstallState,
  startInstallCommand,
} = require('../lib/releaseUpdate');

const INSTALL_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tagName'],
  properties: {
    tagName: { type: 'string', minLength: 1, maxLength: 80 },
  },
};

function isTrustedInstallRequest(req) {
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none';
}

function registerReleaseRoutes(fastify, options = {}) {
  const releaseConfig = options.releaseConfig || {};
  const fetchImpl = options.fetchImpl;

  fastify.get('/api/release/check', async (req, reply) => {
    try {
      const status = await buildReleaseStatus(releaseConfig, { fetchImpl });
      if (status.installEnabled && status.updateAvailable === true && status.latest?.tagName) {
        status.installAuthorization = createInstallToken(status.latest.tagName);
      }
      return status;
    } catch (error) {
      req.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error.message || 'Release-Check fehlgeschlagen.',
      });
    }
  });

  fastify.get('/api/release/install/status', async () => ({
    ok: true,
    install: getInstallState(),
  }));

  fastify.post('/api/release/install', {
    schema: {
      body: INSTALL_BODY_SCHEMA,
    },
  }, async (req, reply) => {
    let status;

    if (!isTrustedInstallRequest(req)) {
      return reply.code(403).send({
        ok: false,
        error: 'Installation darf nur aus dem Dashboard gestartet werden.',
      });
    }

    try {
      status = await buildReleaseStatus(releaseConfig, { fetchImpl });
    } catch (error) {
      req.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error.message || 'Release-Check fehlgeschlagen.',
      });
    }

    if (!status.latest?.tagName || status.latest.tagName !== req.body.tagName) {
      return reply.code(409).send({
        ok: false,
        error: 'Das angefragte Release ist nicht mehr das aktuellste Release.',
        latest: status.latest || null,
      });
    }

    if (!status.installEnabled) {
      return reply.code(403).send({
        ok: false,
        error: 'Direktinstallation ist auf diesem Server nicht freigeschaltet.',
      });
    }

    if (status.updateAvailable !== true) {
      return reply.code(409).send({
        ok: false,
        error: status.updateAvailable === false
          ? 'Diese Version ist bereits installiert.'
          : 'Die aktuell installierte Version ist unbekannt. Installation wurde nicht gestartet.',
        latest: status.latest,
      });
    }

    if (!consumeInstallToken(req.body.tagName, req.headers['x-mobility-release-token'])) {
      return reply.code(403).send({
        ok: false,
        error: 'Installationsfreigabe ist abgelaufen oder ungültig. Bitte Release erneut prüfen.',
      });
    }

    try {
      const install = startInstallCommand(releaseConfig, status.latest);
      return reply.code(202).send({
        ok: true,
        install,
        latest: status.latest,
      });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({
        ok: false,
        error: error.message || 'Installation konnte nicht gestartet werden.',
      });
    }
  });
}

module.exports = {
  registerReleaseRoutes,
};
