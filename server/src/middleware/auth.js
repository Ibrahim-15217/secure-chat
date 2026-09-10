const { verifyToken } = require('../services/authService');
const { findById } = require('../services/userStore');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = findById(payload.sub);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Account is suspended or banned' });
  }
  req.user = { id: payload.sub, role: user.role, email: user.email };
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };