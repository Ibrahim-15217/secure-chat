const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf8');
}

function readUsers() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return raw ? JSON.parse(raw) : [];
}

function writeUsers(users) {
  ensureFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createUser({ name, email, passwordHash, role = 'user' }) {
  const users = readUsers();
  const user = {
    id: uuidv4(),
    name,
    email,
    password_hash: passwordHash,
    role,
    two_factor_enabled: false,
    totp_secret: null,
    public_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function findByEmail(email) {
  return readUsers().find((u) => u.email === email);
}

function findById(id) {
  return readUsers().find((u) => u.id === id);
}

function updateUser(id, patch) {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...patch, updated_at: new Date().toISOString() };
  writeUsers(users);
  return users[index];
}

function sanitize(user) {
  if (!user) return null;
  const { password_hash, totp_secret, ...safe } = user;
  return safe;
}

module.exports = { createUser, findByEmail, findById, updateUser, readUsers, sanitize, hashToken };