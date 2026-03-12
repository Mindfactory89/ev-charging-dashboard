'use strict';

const { createApp } = require('./createApp');
const { readRuntimeConfig } = require('./lib/env');

const runtimeConfig = readRuntimeConfig(process.env);
const app = createApp();

app.listen({ port: runtimeConfig.port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
