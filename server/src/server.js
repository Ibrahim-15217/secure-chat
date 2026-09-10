require('dotenv').config();

const http = require('http');
const app = require('./app');
const config = require('./config');
const { attachRealtime } = require('./realtime/socket');

const httpServer = http.createServer(app);
attachRealtime(httpServer);

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`SecureChat server listening on http://localhost:${config.port}`);
});