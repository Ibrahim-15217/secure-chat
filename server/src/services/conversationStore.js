const { makeStore } = require('./jsonFileStore');

const conversations = makeStore('conversations.json');
const messages = makeStore('messages.json');

function sanitizeMessage(message) {
  if (!message) return null;
  const { ...safe } = message;
  return safe;
}

function findOrCreateConversation(userOneId, userTwoId) {
  const [a, b] = [userOneId, userTwoId].sort();
  const existing = conversations.findOne(
    (c) => (c.user_one_id === a && c.user_two_id === b) || (c.user_one_id === b && c.user_two_id === a)
  );
  if (existing) return { conversation: existing, created: false };
  const conversation = conversations.insert({ user_one_id: a, user_two_id: b });
  return { conversation, created: true };
}

function listConversationsFor(userId) {
  return conversations
    .where((c) => c.user_one_id === userId || c.user_two_id === userId)
    .map((c) => {
      const otherId = c.user_one_id === userId ? c.user_two_id : c.user_one_id;
      const lastMessage = messages
        .where((m) => m.conversation_id === c.id)
        .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
      return { ...c, other_participant_id: otherId, last_message: lastMessage || null };
    })
    .sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1));
}

function listMessagesFor(conversationId) {
  return messages
    .where((m) => m.conversation_id === conversationId)
    .sort((x, y) => (x.created_at < y.created_at ? -1 : 1))
    .map(sanitizeMessage);
}

function isParticipant(conversation, userId) {
  return conversation && (conversation.user_one_id === userId || conversation.user_two_id === userId);
}

const MAX_EXPIRY_SECONDS = 604800;

function validateExpiry(expiryType, expiryDuration) {
  if (expiryType === undefined && expiryDuration === undefined) return { ok: true };
  if (expiryType !== 'time' && expiryType !== 'read') {
    return { error: 'expiryType must be "time" or "read"' };
  }
  const duration = Number(expiryDuration);
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_EXPIRY_SECONDS) {
    return { error: `expiryDuration must be an integer between 1 and ${MAX_EXPIRY_SECONDS} seconds` };
  }
  return { ok: true, type: expiryType, duration };
}

function createMessage(
  conversation,
  senderId,
  { ciphertext, iv, wrappedKey, senderWrappedKey, expiryType, expiryDuration }
) {
  const recipientId =
    conversation.user_one_id === senderId ? conversation.user_two_id : conversation.user_one_id;
  const authTag = Buffer.from(String(ciphertext), 'base64').slice(-16).toString('base64');
  const exp = validateExpiry(expiryType, expiryDuration);
  const type = exp.ok ? exp.type : null;
  const duration = exp.ok ? exp.duration : null;
  const sentAt = new Date();
  const expiresAt =
    type === 'time' ? new Date(sentAt.getTime() + duration * 1000).toISOString() : null;
  return messages.insert({
    conversation_id: conversation.id,
    sender_id: senderId,
    recipient_id: recipientId,
    ciphertext: String(ciphertext),
    nonce: String(iv),
    auth_tag: authTag,
    encrypted_key_reference: String(wrappedKey),
    sender_key_reference: String(senderWrappedKey),
    expiry_type: type,
    expiry_duration: duration,
    expires_at: expiresAt,
    read_at: null,
    created_at: sentAt.toISOString(),
    updated_at: sentAt.toISOString(),
    status: 'sent',
  });
}

function markRead(messageId, readerId) {
  const message = messages.findById(messageId);
  if (!message) return { status: 'not_found' };
  const conversation = conversations.findById(message.conversation_id);
  if (!isParticipant(conversation, readerId)) return { status: 'not_found' };
  if (message.recipient_id !== readerId) return { status: 'forbidden' };
  if (message.read_at) return { status: 'already', message };
  const readAt = new Date();
  const patch = { read_at: readAt.toISOString() };
  if (message.expiry_type === 'read' && message.expiry_duration) {
    patch.expires_at = new Date(readAt.getTime() + message.expiry_duration * 1000).toISOString();
  }
  const updated = messages.update(message.id, patch);
  return { status: 'ok', message: updated };
}

module.exports = {
  conversations,
  messages,
  findOrCreateConversation,
  listConversationsFor,
  listMessagesFor,
  createMessage,
  isParticipant,
  validateExpiry,
  markRead,
};