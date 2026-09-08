const express = require('express');

const { register, login, getPublicUser, AuthError } = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../validators/auth');

const router = express.Router();

function handleAuthError(res, err) {
  if (err instanceof AuthError) {
    return res.status(err.code).json({ error: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

router.post('/register', async (req, res) => {
  const { errors, value } = validateRegister(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  try {
    const result = await register(value);
    return res.status(201).json(result);
  } catch (err) {
    return handleAuthError(res, err);
  }
});

router.post('/login', async (req, res) => {
  const { errors, value } = validateLogin(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  try {
    const result = await login(value);
    return res.json(result);
  } catch (err) {
    return handleAuthError(res, err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = getPublicUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

module.exports = router;