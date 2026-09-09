const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userStore = require('../services/userStore');

const router = express.Router();

router.use(requireAuth);

router.get('/me', (req, res) => {
  const user = userStore.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: userStore.sanitize(user) });
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: 'query parameter q is required' });

  const users = userStore
    .readUsers()
    .filter((u) => u.id !== req.user.id && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
    .map(userStore.sanitize)
    .slice(0, 20);

  return res.json({ users });
});

router.get('/:id', (req, res) => {
  const user = userStore.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: userStore.sanitize(user) });
});

module.exports = router;