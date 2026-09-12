const express = require('express');

const {
  register,
  login,
  verifyTwoFactor,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getPublicUser,
  AuthError,
} = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../validators/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(authLimiter);

function handleAuthError(res, err) {
  if (err instanceof AuthError) {
    return res.status(err.code).json({ error: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Internal server error', detail: err.message });
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
    // If a pre-auth token was issued, the client must complete TOTP verification.
    if (result.requiresTwoFactor) {
      return res.status(200).json({
        requiresTwoFactor: true,
        pendingToken: result.pendingToken,
        user: result.user,
      });
    }
    return res.json(result);
  } catch (err) {
    return handleAuthError(res, err);
  }
});

router.post('/verify-2fa', async (req, res) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken) return res.status(400).json({ error: 'Missing pending token' });
  if (!code) return res.status(400).json({ error: 'Verification code is required' });
  try {
    const result = await verifyTwoFactor({ pendingToken, code });
    return res.json(result);
  } catch (err) {
    return handleAuthError(res, err);
  }
});

router.post('/setup-2fa', requireAuth, (req, res) => {
  try {
    const result = setupTwoFactor(req.user.id);
    return res.json(result);
  } catch (err) {
    return handleAuthError(res, err);
  }
});

router.post('/enable-2fa', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Verification code is required' });
  try {
    const result = enableTwoFactor(req.user.id, { code });
    return res.json(result);
  } catch (err) {
    return handleAuthError(res, err);
  }
});

router.post('/disable-2fa', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Verification code is required' });
  try {
    const result = disableTwoFactor(req.user.id, { code });
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