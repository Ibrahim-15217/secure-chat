const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { createUser, findByEmail, findById } = require('./userStore');

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

async function register({ name, email, password }) {
  if (await findByEmail(email)) {
    throw new AuthError('An account with this email already exists', 409);
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = createUser({ name, email, passwordHash });
  const token = signToken(user);
  return { user, token };
}

async function login({ email, password }) {
  const user = findByEmail(email);
  if (!user) {
    // Generic message: do not reveal whether the email exists.
    throw new AuthError('Invalid credentials');
  }

  let valid = false;
  try {
    valid = await argon2.verify(user.password_hash, password);
  } catch (err) {
    valid = false;
  }
  if (!valid) throw new AuthError('Invalid credentials');

  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return null;
  }
}

function getPublicUser(id) {
  const user = findById(id);
  return sanitizeUser(user);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = { register, login, verifyToken, getPublicUser, AuthError };