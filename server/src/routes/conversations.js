const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userStore = require('../services/userStore');
const conversationStore = require('../services/conversationStore');

const router = express.Router();

router.use(requireAuth);

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
  if (!conversation || !conversationStore.isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  return res.json({ conversation });
});

router.post('/:id/messages', (req, res) => {
  const conversation = conversationStore.conversations.findById(req.params.id);
  if (!conversation || !conversationStore.isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const { ciphertext, iv, wrappedKey, senderWrappedKey, expiryType, expiryDuration } = req.body || {};
  if (!ciphertext || !iv || !wrappedKey || !senderWrappedKey) {
    return res.status(400).json({ error: 'ciphertext, iv, wrappedKey and senderWrappedKey are required' });
  }
  const expiry = conversationStore.validateExpiry(expiryType, expiryDuration);
  if (!expiry.ok) return res.status(400).json({ error: expiry.error });

  const message = conversationStore.createMessage(conversation, req.user.id, {
    ciphertext,
    iv,
    wrappedKey,
    senderWrappedKey,
    expiryType,
    expiryDuration,
  });

  conversationStore.conversations.update(conversation.id, {});
  return res.status(201).json({ message });
});

router.get('/:id/messages', (req, res) => {
  const conversation = conversationStore.conversations.findById(req.params.id);
  if (!conversation || !conversationStore.isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  return res.json({ messages: conversationStore.listMessagesFor(conversation.id) });
});

module.exports = router;