const { generateSync } = require('otplib');

const BASE = 'http://localhost:5000/api';
let pass = 0;
let fail = 0;

function check(label, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}${extra ? ` (${extra})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${extra ? ` (${extra})` : ''}`);
  }
}

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('=== PHASE 3 INTEGRATION TESTS ===');

  const email = `2fa${Date.now()}@example.com`;
  const name = 'TwoFA Subject';
  const password = 'Password123!';

  // --- 2FA SETUP ---
  console.log('--- 2FA setup/enable ---');
  const reg = await req('/auth/register', { method: 'POST', body: { name, email, password } });
  check('register returns token', reg.status === 201 && Boolean(reg.data.token));
  const token = reg.data.token;

  const setup = await req('/auth/setup-2fa', { method: 'POST', token });
  check('setup-2fa returns secret + otpUrl', setup.status === 200 && setup.data.secret && setup.data.otpUrl.includes('otpauth://'));

  const code = generateSync({ secret: setup.data.secret, digits: 6, period: 30 });

  const enableWrong = await req('/auth/enable-2fa', { method: 'POST', token, body: { code: '000000' } });
  check('enable-2fa with wrong code rejected (401)', enableWrong.status === 401);

  const enable = await req('/auth/enable-2fa', { method: 'POST', token, body: { code } });
  check('enable-2fa with correct code', enable.status === 200 && enable.data.user.two_factor_enabled === true);

  const me = await req('/auth/me', { token });
  check('me reflects two_factor_enabled', me.status === 200 && me.data.user.two_factor_enabled === true);
  check('totp_secret not exposed via API', !('totp_secret' in me.data.user));

  const enableAgain = await req('/auth/enable-2fa', { method: 'POST', token, body: { code } });
  check('enable twice rejected (409)', enableAgain.status === 409);

  // --- LOGIN WITH 2FA ---
  console.log('--- login with 2FA ---');
  const login = await req('/auth/login', { method: 'POST', body: { email, password } });
  check('login returns requiresTwoFactor=true', login.status === 200 && login.data.requiresTwoFactor === true);
  check('login returns pendingToken (no final token)', Boolean(login.data.pendingToken) && !login.data.token);
  const pendingToken = login.data.pendingToken;

  const verifyWrong = await req('/auth/verify-2fa', { method: 'POST', body: { pendingToken, code: '000000' } });
  check('verify-2fa wrong code rejected (401)', verifyWrong.status === 401);

  const code2 = generateSync({ secret: setup.data.secret, digits: 6, period: 30 });
  const verify = await req('/auth/verify-2fa', { method: 'POST', body: { pendingToken, code: code2 } });
  check('verify-2fa correct code issues token', verify.status === 200 && Boolean(verify.data.token));
  check('pending token not usable as auth token', (await req('/auth/me', { token: pendingToken })).status === 401);

  // --- DISABLE 2FA ---
  console.log('--- disable 2FA ---');
  const finalToken = verify.data.token;
  const disableWrong = await req('/auth/disable-2fa', { method: 'POST', token: finalToken, body: { code: '000000' } });
  check('disable-2fa wrong code rejected (401)', disableWrong.status === 401);

  const code3 = generateSync({ secret: setup.data.secret, digits: 6, period: 30 });
  const disable = await req('/auth/disable-2fa', { method: 'POST', token: finalToken, body: { code: code3 } });
  check('disable-2fa correct code', disable.status === 200 && disable.data.user.two_factor_enabled === false);

  const loginNo2fa = await req('/auth/login', { method: 'POST', body: { email, password } });
  check('login after disable returns token directly', loginNo2fa.status === 200 && Boolean(loginNo2fa.data.token) && !loginNo2fa.data.requiresTwoFactor);

  // --- RBAC ---
  console.log('--- RBAC (admin routes) ---');
  const rbUserToken = loginNo2fa.data.token;

  const adminNoToken = await req('/admin/users');
  check('admin/users without token blocked (401)', adminNoToken.status === 401);

  const adminAsUser = await req('/admin/users', { token: rbUserToken });
  check('ordinary user blocked from admin endpoints (403)', adminAsUser.status === 403);

  // Create an admin via seed, then sign in
  // (role set directly here for test control)
  const { execSync } = require('child_process');
  const adminEmail = `admin${Date.now()}@example.com`;
  const adminPass = 'AdminPass123!';
  const regAdmin = await req('/auth/register', {
    method: 'POST',
    body: { name: 'Admin', email: adminEmail, password: adminPass },
  });
  check('admin account registered', regAdmin.status === 201);
  const adminToken = regAdmin.data.token;

  const adminAsAdmin = await req('/admin/users', { token: adminToken });
  check('newly registered user still user role', adminAsAdmin.status === 403);

  // Promote to admin via JSON store is not possible through API (by design).
  // Use seed script path: update the user's role in the store directly.
  const { updateUser, findByEmail } = require('../src/services/userStore');
  const stored = findByEmail(adminEmail);
  updateUser(stored.id, { role: 'admin' });

  const loginAdmin = await req('/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPass } });
  check('admin login succeeds', loginAdmin.status === 200 && Boolean(loginAdmin.data.token));
  const adminFinal = loginAdmin.data.token;

  const adminList = await req('/admin/users', { token: adminFinal });
  check('admin can list users (200)', adminList.status === 200 && Array.isArray(adminList.data.users));
  check('user list does not expose password_hash', adminList.status === 200 && !adminList.data.users.some((u) => 'password_hash' in u));

  const patchTarget = adminList.data.users.find((u) => u.email === email);
  const patch = await req(`/admin/users/${patchTarget.id}`, { method: 'PATCH', token: adminFinal, body: { status: 'suspended' } });
  check('admin can patch user status', patch.status === 200 && patch.data.user.status === 'suspended');

  const patchBadRole = await req(`/admin/users/${patchTarget.id}`, { method: 'PATCH', token: adminFinal, body: { role: 'superuser' } });
  check('invalid role rejected (400)', patchBadRole.status === 400);

  const userPatchAdmin = await req(`/admin/users/${patchTarget.id}`, { method: 'PATCH', token: rbUserToken, body: { status: 'active' } });
  check('ordinary user cannot patch admin routes (403)', userPatchAdmin.status === 403);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});