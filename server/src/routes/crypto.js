const express = require('express');

const { requireAuth } = require('../middleware/auth');
const userStore = require('../services/userStore');

const router = express.Router();

router.use(requireAuth);

function isValidJwk(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    payload.kty === 'RSA' &&
    typeof payload.n === 'string' &&
    typeof payload.e === 'string'
  );
}

router.post('/public-key', (req, res) => {
  const { publicKey } = req.body || {};
  if (!publicKey) return res.status(400).json({ error: 'publicKey is required' });

  let parsed = publicKey;
  if (typeof publicKey === 'string') {
    try {
      parsed = JSON.parse(publicKey);
    } catch (err) {
      return res.status(400).json({ error: 'publicKey must be a valid JSON JWK' });
    }
  }
  if (!isValidJwk(parsed)) {
    return res.status(400).json({ error: 'publicKey must be an RSA JWK' });
  }

  const updated = userStore.updateUser(req.user.id, { public_key: JSON.stringify(parsed) });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  return res.json({ ok: true, user: userStore.sanitize(updated) });
});

router.get('/public-key/:userId', (req, res) => {
  const target = userStore.findById(req.params.userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (!target.public_key) {
    return res.status(404).json({ error: 'User has not registered a public key' });
  }
  return res.json({ publicKey: JSON.parse(target.public_key) });
});

router.get('/my-public-key', (req, res) => {
  const me = userStore.findById(req.user.id);
  if (!me) return res.status(404).json({ error: 'User not found' });
  if (!me.public_key) return res.status(404).json({ error: 'No public key registered' });
  return res.json({ publicKey: JSON.parse(me.public_key) });
});

module.exports = router;