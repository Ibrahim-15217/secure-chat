require('dotenv').config();

const http = require('http');
const app = require('./app');
const config = require('./config');
const { attachRealtime } = require('./realtime/socket');
const { startExpiryWorker } = require('./services/expiryWorker');
const { startFileExpiryWorker } = require('./services/fileExpiryWorker');

const httpServer = http.createServer(app);
const io = attachRealtime(httpServer);
startExpiryWorker(io);
startFileExpiryWorker();

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`SecureChat server listening on http://localhost:${config.port}`);
});