const setInterval = global.setInterval;

const fileStore = require('./fileStore');

const PURGE_INTERVAL_MS = 1000;

function startFileExpiryWorker() {
  return setInterval(() => {
    try {
      const purged = fileStore.purgeExpiredFiles();
      if (purged > 0) console.log(`File expiry worker purged ${purged} expired file(s)`);
    } catch (err) {
      console.error('File expiry worker error:', err.message);
    }
  }, PURGE_INTERVAL_MS);
}

module.exports = { startFileExpiryWorker };