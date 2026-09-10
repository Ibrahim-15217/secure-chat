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

function createMessage(conversation, senderId, { ciphertext, iv, wrappedKey, senderWrappedKey }) {
  const recipientId =
    conversation.user_one_id === senderId ? conversation.user_two_id : conversation.user_one_id;
  const authTag = Buffer.from(String(ciphertext), 'base64').slice(-16).toString('base64');
  return messages.insert({
    conversation_id: conversation.id,
    sender_id: senderId,
    recipient_id: recipientId,
    ciphertext: String(ciphertext),
    nonce: String(iv),
    auth_tag: authTag,
    encrypted_key_reference: String(wrappedKey),
    sender_key_reference: String(senderWrappedKey),
    expiry_type: null,
    expires_at: null,
    read_at: null,
    status: 'sent',
  });
}

module.exports = {
  conversations,
  messages,
  findOrCreateConversation,
  listConversationsFor,
  listMessagesFor,
  createMessage,
  isParticipant,
};