const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const userStore = require('../services/userStore');
const { sanitize } = userStore;

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/users', (req, res) => {
  const clean = userStore.readUsers().map((u) => sanitize(u));
  return res.json({ users: clean });
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