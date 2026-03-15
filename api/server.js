'use strict';

const { createApp } = require('./createApp');
const { readRuntimeConfig } = require('./lib/env');
const { createTelegramBot } = require('./lib/telegramBot');

const runtimeConfig = readRuntimeConfig(process.env);
const app = createApp();
const telegramBot = createTelegramBot({
  telegramConfig: runtimeConfig.telegram,
  prisma: app.prisma,
  logger: app.log,
});

app.addHook('onClose', async () => {
  await telegramBot.stop();
});

app.listen({ port: runtimeConfig.port, host: '0.0.0.0' })
  .then(() => {
    telegramBot.start();
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
