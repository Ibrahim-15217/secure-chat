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

async function req(p, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('=== PHASE 9 INTEGRATION TESTS ===');
  const { updateUser } = require('../src/services/userStore');
  const { auditLogs } = require('../src/services/auditLogStore');

  const stamp = Date.now();
  const reg = (n) => req('/auth/register', { method: 'POST', body: { name: n, email: `${n}${stamp}@e.com`, password: 'Password123!' } });

  // ---- RBAC BLOCKING ----
  console.log('--- non-admin blocked ---');
  const [a, b, c] = [await reg('AdmA'), await reg('AdmB'), await reg('AdmC')];
  check('users registered', a.status === 201 && b.status === 201 && c.status === 201);
  const noToken = await req('/admin/users');
  check('admin endpoint without token (401)', noToken.status === 401);
  const asUser = await req('/admin/users', { token: a.data.token });
  check('ordinary user blocked (403)', asUser.status === 403);

  // ---- FAILED LOGIN MONITORING ----
  console.log('--- security events / failed logins ---');
  const badLogin = await req('/auth/login', { method: 'POST', body: { email: a.data.user.email, password: 'WrongPass1!' } });
  check('wrong password rejected', badLogin.status === 401);
  const ghostLogin = await req('/auth/login', { method: 'POST', body: { email: `ghost${stamp}@e.com`, password: 'Password123!' } });
  check('unknown email rejected (generic)', ghostLogin.status === 401);

  const storedA = require('../src/services/userStore').findByEmail(a.data.user.email);
  updateUser(storedA.id, { role: 'admin' });

  const loginAdmin = await req('/auth/login', { method: 'POST', body: { email: a.data.user.email, password: 'Password123!' } });
  check('admin login succeeds', loginAdmin.status === 200 && Boolean(loginAdmin.data.token));
  const adminToken = loginAdmin.data.token;

  // ---- ADMIN CAPABILITIES ----
  console.log('--- admin capabilities ---');
  const userList = await req('/admin/users', { token: adminToken });
  check('admin lists users', userList.status === 200 && Array.isArray(userList.data.users));
  check('user list has no password hashes', !userList.data.users.some((u) => u.password_hash));

  const target = userList.data.users.find((u) => u.id === b.data.user.id);
  const suspend = await req(`/admin/users/${target.id}`, { method: 'PATCH', token: adminToken, body: { status: 'suspended' } });
  check('admin suspends user', suspend.status === 200 && suspend.data.user.status === 'suspended');
  const promote = await req(`/admin/users/${target.id}`, { method: 'PATCH', token: adminToken, body: { role: 'admin' } });
  check('admin promotes user role', promote.status === 200 && promote.data.user.role === 'admin');
  const badPatch = await req(`/admin/users/${target.id}`, { method: 'PATCH', token: adminToken, body: { status: 'superuser' } });
  check('invalid status rejected', badPatch.status === 400);

  const security = await req('/admin/security-events', { token: adminToken });
  check('security events list available', security.status === 200 && Array.isArray(security.data.events));
  check('failed login event recorded', security.data.events.some((e) => e.action === 'login_failed' && e.success === false));
  check('security events contain no password material', !JSON.stringify(security.data.events).includes('WrongPass1!'));

  // ---- AUDIT LOG (no plaintext) ----
  console.log('--- audit log integrity ---');
  const logsReq = await req('/admin/audit-logs', { token: adminToken });
  check('audit logs list available', logsReq.status === 200 && Array.isArray(logsReq.data.logs));
  const rawLogs = JSON.stringify(logsReq.data.logs);
  check('audit logs have no ciphertext field', !rawLogs.includes('ciphertext'));
  check('audit logs have no message text', !rawLogs.includes('secret-message-content'));
  check('audit logs contain no password hashes', !rawLogs.includes('$argon2'));

  const stats = await req('/admin/stats', { token: adminToken });
  check('stats available', stats.status === 200 && Boolean(stats.data.stats));
  const s = stats.data.stats;
  check('stats: users counted', s.users >= 3);
  check('stats: failed logins in 24h recorded', s.failedLoginsLast24h >= 2);
  check('stats: audit events counted', s.auditEvents >= 1);

  const ghost = await req('/admin/users', { token: c.data.token });
  check('promoted/other non-admin still blocked', ghost.status === 403);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});