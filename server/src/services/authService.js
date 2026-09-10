const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { createUser, findByEmail, findById, updateUser, sanitize } = require('./userStore');
const { encrypt, decrypt } = require('../utils/secretCrypto');
const { logAudit } = require('./auditLogStore');
const totp = require('./totpService');

class AuthError extends Error {
  constructor(message, code = 401) {
    super(message);
    this.code = code;
  }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function signPreAuthToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, preauth: true },
    config.jwt.secret,
    { expiresIn: '5m' }
  );
}

async function register({ name, email, password, role = 'user' }) {
  if (await findByEmail(email)) {
    throw new AuthError('An account with this email already exists', 409);
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = createUser({ name, email, passwordHash, role });
  const token = signToken(user);
  return { user: sanitize(user), token };
}

async function login({ email, password }) {
  const user = findByEmail(email);
  if (!user) {
    logAudit({ event_type: 'auth', action: 'login_failed', success: false, detail: { email, reason: 'unknown_email' } });
    // Generic message: do not reveal whether the email exists.
    throw new AuthError('Invalid credentials');
  }

  let valid = false;
  try {
    valid = await argon2.verify(user.password_hash, password);
  } catch (err) {
    valid = false;
  }
  if (!valid) {
    logAudit({ user_id: user.id, event_type: 'auth', action: 'login_failed', success: false, detail: { email, reason: 'bad_password' } });
    throw new AuthError('Invalid credentials');
  }

  logAudit({ user_id: user.id, event_type: 'auth', action: 'login_success', success: true, detail: { email } });

  if (user.two_factor_enabled) {
    return {
      requiresTwoFactor: true,
      pendingToken: signPreAuthToken(user),
      user: sanitize(user),
    };
  }

  const token = signToken(user);
  return { user: sanitize(user), token };
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.preauth) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function verifyPreAuthToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    return payload && payload.preauth === true ? payload : null;
  } catch (err) {
    return null;
  }
}

async function verifyTwoFactor({ pendingToken, code }) {
  const payload = verifyPreAuthToken(pendingToken);
  const user = payload ? findById(payload.sub) : null;
  if (!user) throw new AuthError('2FA verification session expired; sign in again');

  const secret = decrypt(user.totp_secret);
  if (!totp.verifyCode(secret, String(code).trim())) {
    logAudit({ user_id: user.id, event_type: 'auth', action: 'two_factor_failed', success: false, detail: { email: user.email } });
    throw new AuthError('Invalid verification code');
  }

  logAudit({ user_id: user.id, event_type: 'auth', action: 'two_factor_success', success: true, detail: { email: user.email } });
  const token = signToken(user);
  return { user: sanitize(user), token };
}

function setupTwoFactor(userId) {
  const user = findById(userId);
  if (!user) throw new AuthError('User not found', 404);
  if (user.two_factor_enabled) throw new AuthError('2FA is already enabled', 409);

  const { secret, otpUrl } = totp.generateSetupSecret(user.email);
  updateUser(userId, { totp_secret: encrypt(secret) });
  return { secret, otpUrl };
}

function enableTwoFactor(userId, { code }) {
  const user = findById(userId);
  if (!user) throw new AuthError('User not found', 404);
  if (user.two_factor_enabled) throw new AuthError('2FA is already enabled', 409);

  // Recover the pending secret; if none stored, require setup first.
  const pending = decrypt(user.totp_secret);
  if (!pending) throw new AuthError('Please generate a setup secret first', 400);

  if (!totp.verifyCode(pending, String(code).trim())) {
    throw new AuthError('Invalid verification code');
  }

  const updated = updateUser(userId, {
    two_factor_enabled: true,
    totp_secret: encrypt(pending),
    two_factor_backup_codes: null,
  });
  return { user: sanitize(updated) };
}

function disableTwoFactor(userId, { code }) {
  const user = findById(userId);
  if (!user) throw new AuthError('User not found', 404);
  if (!user.two_factor_enabled) throw new AuthError('2FA is not enabled', 400);

  const secret = decrypt(user.totp_secret);
  if (!totp.verifyCode(secret, String(code).trim())) {
    throw new AuthError('Invalid verification code');
  }

  const updated = updateUser(userId, {
    two_factor_enabled: false,
    totp_secret: null,
  });
  return { user: sanitize(updated) };
}

function getPublicUser(id) {
  const user = findById(id);
  return sanitize(user);
}

module.exports = {
  register,
  login,
  verifyToken,
  verifyPreAuthToken,
  verifyTwoFactor,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getPublicUser,
  AuthError,
};