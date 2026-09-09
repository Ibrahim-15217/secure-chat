const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userStore = require('../services/userStore');
const conversationStore = require('../services/conversationStore');

const router = express.Router();

router.use(requireAuth);

function isParticipant(conversation, userId) {
  return conversation && (conversation.user_one_id === userId || conversation.user_two_id === userId);
}

router.post('/', (req, res) => {
  const { participantId } = req.body || {};
  if (!participantId) return res.status(400).json({ error: 'participantId is required' });
  if (participantId === req.user.id) return res.status(400).json({ error: 'Cannot start a conversation with yourself' });

  const other = userStore.findById(participantId);
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (other.status !== 'active') return res.status(403).json({ error: 'User is not active' });

  const { conversation, created } = conversationStore.findOrCreateConversation(req.user.id, other.id);
  return res.status(created ? 201 : 200).json({ conversation });
});

router.get('/', (req, res) => {
  const list = conversationStore.listConversationsFor(req.user.id);
  return res.json({
    conversations: list.map((c) => {
      const otherId = c.other_participant_id;
      const other = userStore.findById(otherId);
      return {
        ...c,
        other_participant: other ? userStore.sanitize(other) : null,
      };
    }),
  });
});

router.get('/:id', (req, res) => {
  const conversation = conversationStore.conversations.findById(req.params.id);
  if (!conversation || !isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  return res.json({ conversation });
});

router.post('/:id/messages', (req, res) => {
  const conversation = conversationStore.conversations.findById(req.params.id);
  if (!conversation || !isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const { ciphertext, iv, wrappedKey, senderWrappedKey } = req.body || {};
  if (!ciphertext || !iv || !wrappedKey || !senderWrappedKey) {
    return res.status(400).json({ error: 'ciphertext, iv, wrappedKey and senderWrappedKey are required' });
  }

  const recipientId =
    conversation.user_one_id === req.user.id ? conversation.user_two_id : conversation.user_one_id;

  const authTag = Buffer.from(String(ciphertext), 'base64').slice(-16).toString('base64');

  const message = conversationStore.messages.insert({
    conversation_id: conversation.id,
    sender_id: req.user.id,
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

  conversationStore.conversations.update(conversation.id, {});
  return res.status(201).json({ message });
});

router.get('/:id/messages', (req, res) => {
  const conversation = conversationStore.conversations.findById(req.params.id);
  if (!conversation || !isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  return res.json({ messages: conversationStore.listMessagesFor(conversation.id) });
});

module.exports = router;