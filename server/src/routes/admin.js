const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const userStore = require('../services/userStore');
const { sanitize } = userStore;
const { auditLogs } = require('../services/auditLogStore');
const conversationStore = require('../services/conversationStore');
const fileStore = require('../services/fileStore');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/users', (req, res) => {
  const clean = userStore.readUsers().map((u) => sanitize(u));
  return res.json({ users: clean });
});

router.get('/audit-logs', (req, res) => {
  const { event_type: eventType, action, limit } = req.query;
  const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
  let entries = auditLogs.findAll();
  if (eventType) entries = entries.filter((e) => e.event_type === eventType);
  if (action) entries = entries.filter((e) => e.action === action);
  entries = entries.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, max);
  return res.json({ logs: entries });
});

router.get('/security-events', (req, res) => {
  const max = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const events = auditLogs
    .findAll()
    .filter((e) => e.event_type === 'auth' && new Date(e.created_at).getTime() >= since)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, max);
  return res.json({ events });
});

router.get('/stats', (req, res) => {
  const users = userStore.readUsers();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const failedLogins = auditLogs
    .findAll()
    .filter((e) => e.action === 'login_failed' && new Date(e.created_at).getTime() >= dayAgo).length;
  const twoFaEnabled = users.filter((u) => u.two_factor_enabled).length;
  const withPublicKey = users.filter((u) => u.public_key).length;
  return res.json({
    stats: {
      users: users.length,
      activeUsers: users.filter((u) => u.status === 'active').length,
      twoFaEnabled,
      withPublicKey,
      conversations: conversationStore.conversations.findAll().length,
      messages: conversationStore.messages.findAll().length,
      files: fileStore.files.findAll().length,
      auditEvents: auditLogs.findAll().length,
      failedLoginsLast24h: failedLogins,
    },
  });
});

router.patch('/users/:id', (req, res) => {
  const { status, role } = req.body || {};
  const target = userStore.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const patch = {};
  if (status !== undefined) {
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    patch.status = status;
  }
  if (role !== undefined) {
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    patch.role = role;
  }

  const updated = userStore.updateUser(req.params.id, patch);
  return res.json({ user: sanitize(updated) });
});

module.exports = router;