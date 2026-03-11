'use strict';

const { createApp } = require('./createApp');

const PORT = Number(process.env.PORT || 3000);
const app = createApp();

app.listen({ port: PORT, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
