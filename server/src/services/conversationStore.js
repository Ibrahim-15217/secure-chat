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

module.exports = {
  conversations,
  messages,
  findOrCreateConversation,
  listConversationsFor,
  listMessagesFor,
};