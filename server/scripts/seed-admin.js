#!/usr/bin/env node

// Dev/demo helper: create (or promote) an admin account.
require('dotenv').config();
const { register } = require('../src/services/authService');
const { findByEmail, updateUser } = require('../src/services/userStore');

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@securechat.local';
  const password = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const name = process.env.ADMIN_NAME || 'Administrator';

  const existing = findByEmail(email);
  if (existing) {
    updateUser(existing.id, { role: 'admin', status: 'active' });
    // eslint-disable-next-line no-console
    console.log(`Admin "${email}" already exists — role/status set to admin/active.`);
    return;
  }

  await register({ name, email, password, role: 'admin' });
  // eslint-disable-next-line no-console
  console.log(`Admin created: ${email}`);
}

createAdmin().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});