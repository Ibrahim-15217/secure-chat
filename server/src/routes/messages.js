const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userStore = require('../services/userStore');
const conversationStore = require('../services/conversationStore');

const router = express.Router();

router.use(requireAuth);

function isParticipant(conversation, userId) {
  return conversation && (conversation.user_one_id === userId || conversation.user_two_id === userId);
}

function canAccessMessage(message, userId) {
  return message && (message.sender_id === userId || message.recipient_id === userId);
}

router.post('/:id/read', (req, res) => {
  const result = conversationStore.markRead(req.params.id, req.user.id);
  if (result.status === 'not_found') return res.status(404).json({ error: 'Message not found' });
  if (result.status === 'forbidden') {
    return res.status(403).json({ error: 'Only the recipient can mark a message as read' });
  }
  return res.json({ message: result.message });
});

router.delete('/:id', (req, res) => {
  const message = conversationStore.messages.findById(req.params.id);
  if (!message || !canAccessMessage(message, req.user.id)) {
    return res.status(404).json({ error: 'Message not found' });
  }
  conversationStore.messages.remove(message.id);
  return res.json({ ok: true });
});

module.exports = router;