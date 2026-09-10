const express = require('express');
const { requireAuth } = require('../middleware/auth');
const conversationStore = require('../services/conversationStore');
const fileStore = require('../services/fileStore');
const { fileLimiter } = require('../middleware/rateLimit');

const router = express.Router();

function isParticipant(conversation, userId) {
  return conversation && (conversation.user_one_id === userId || conversation.user_two_id === userId);
}

router.get('/:id/download', (req, res) => {
  const check = fileStore.verifyDownloadToken(req.query.token);
  if (check.error) return res.status(401).json({ error: check.error });
  if (check.fileId !== req.params.id) return res.status(403).json({ error: 'Token does not match file' });
  const file = fileStore.files.findById(req.params.id);
  if (!file || !fileStore.bodyExists(file)) return res.status(410).json({ error: 'File no longer available' });
  fileStore.files.update(file.id, { download_count: file.download_count + 1 });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', file.size);
  return res.sendFile(fileStore.bodyPath(file.id));
});

router.use(requireAuth);
router.use(fileLimiter);

router.get('/conversation/:conversationId', (req, res) => {
  const conversation = conversationStore.conversations.findById(req.params.conversationId);
  if (!isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  return res.json({ files: fileStore.listFilesFor(conversation.id) });
});

router.post('/', (req, res) => {
  const { conversationId, name, mime, size, iv, authTag, wrappedKey, senderWrappedKey, accessWindowSeconds } =
    req.body || {};
  if (!conversationId || !name || !mime || !size || !iv || !authTag || !wrappedKey || !senderWrappedKey) {
    return res.status(400).json({ error: 'Missing required file metadata' });
  }
  const conversation = conversationStore.conversations.findById(conversationId);
  if (!isParticipant(conversation, req.user.id)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const file = fileStore.createFileMeta({
    conversationId: conversation.id,
    senderId: req.user.id,
    name: String(name).slice(0, 255),
    mime,
    size: Number(size),
    iv,
    authTag,
    wrappedKey,
    senderWrappedKey,
    accessWindowSeconds,
  });
  return res.status(201).json({ file: fileStore.sanitize(file) });
});

router.put(
  '/:id/body',
  express.raw({ type: () => true, limit: '50mb' }),
  (req, res) => {
    const file = fileStore.files.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const conversation = conversationStore.conversations.findById(file.conversation_id);
    if (!isParticipant(conversation, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (file.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the uploader can write the ciphertext body' });
    }
    const stored = fileStore.storeBody(file.id, req.body);
    if (!stored) return res.status(409).json({ error: 'File body already stored or meta not found' });
    return res.json({ file: fileStore.sanitize(stored) });
  }
);

router.get('/:id/meta', (req, res) => {
  const file = fileStore.files.findById(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const conversation = conversationStore.conversations.findById(file.conversation_id);
  if (!isParticipant(conversation, req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fileStore.bodyExists(file)) return res.status(410).json({ error: 'File no longer available' });
  return res.json({ file: fileStore.sanitize(file) });
});

router.get('/:id/token', (req, res) => {
  const file = fileStore.files.findById(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const conversation = conversationStore.conversations.findById(file.conversation_id);
  if (!isParticipant(conversation, req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fileStore.bodyExists(file)) return res.status(410).json({ error: 'File no longer available' });
  const { token, expiresAt } = fileStore.createDownloadToken(file.id);
  return res.json({ url: `/api/files/${file.id}/download`, token, expiresAt });
});

router.delete('/:id', (req, res) => {
  const file = fileStore.files.findById(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const conversation = conversationStore.conversations.findById(file.conversation_id);
  if (!isParticipant(conversation, req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fileStore.deleteFile(file.id, req.user.id)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.json({ ok: true });
});

module.exports = router;