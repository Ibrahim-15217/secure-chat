const conversationStore = require('./conversationStore');
const { logAudit } = require('./auditLogStore');

const PURGE_INTERVAL_MS = 1000;

function findExpired() {
  const now = Date.now();
  return conversationStore.messages.findAll().filter((m) => {
    if (m.status === 'deleted' || m.status === 'expired') return false;
    if (m.expiry_type === 'time' && m.expires_at) {
      return now >= new Date(m.expires_at).getTime();
    }
    if (m.expiry_type === 'read' && m.read_at && m.expiry_duration) {
      return now >= new Date(m.read_at).getTime() + m.expiry_duration * 1000;
    }
    return false;
  });
}

function purgeExpired(io) {
  const expired = findExpired();
  let purged = 0;
  for (const msg of expired) {
    // remove() returns false if the record is already gone (race/duplicate-deletion guard)
    const removed = conversationStore.messages.remove(msg.id);
    if (!removed) continue;
    conversationStore.conversations.update(msg.conversation_id, {});
    if (io) {
      io.to(`conversation:${msg.conversation_id}`).emit('message:expired', {
        messageId: msg.id,
        conversationId: msg.conversation_id,
      });
    }
    logAudit({
      user_id: msg.recipient_id,
      event_type: 'message',
      action: 'message_expired_purged',
      success: true,
      detail: { messageId: msg.id, conversationId: msg.conversation_id },
    });
    purged += 1;
  }
  return purged;
}

function startExpiryWorker(io) {
  const timer = setInterval(() => {
    try {
      purgeExpired(io);
    } catch (err) {
      console.error('Expiry worker error:', err.message);
    }
  }, PURGE_INTERVAL_MS);
  timer.unref && timer.unref();
  return timer;
}

module.exports = { startExpiryWorker, purgeExpired, findExpired };