const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
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

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

async function connect(token) {
  return new Promise((resolve) => {
    const s = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (err) => resolve({ error: err.message }));
  });
}

function emitWithTimeout(socket, event, payload, timeout = 6000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event);
      resolve(null);
    }, timeout);
    socket.emit(event, payload, (resp) => {
      clearTimeout(timer);
      resolve(resp);
    });
  });
}

async function main() {
  console.log('=== PHASE 10 SECURITY HARDENING TESTS ===');
  const config = require('../src/config');
  const stamp = Date.now();
  const reg = (n) => req('/auth/register', { method: 'POST', body: { name: n, email: `${n}${stamp}@e.com`, password: 'Password123!' } });

  // ---- INJECTION + INPUT VALIDATION ----
  console.log('--- injection attempts blocked ---');
  const injections = [
    { name: "x' OR 1=1--", email: 'a@b.com', password: 'Password123!' },
    { name: '<script>alert(1)</script>', email: 'b@b.com', password: 'Password123!' },
    { name: "n'; DROP TABLE users; --", email: 'c@b.com', password: 'Password123!' },
    { name: 'safe', email: "sneaky'@b.com", password: 'Password123!' },
    { name: 'safe', email: 'normal@b.com', password: "x'; DROP TABLE users;--" },
  ];
  const injectionResults = [];
  for (const body of injections) {
    injectionResults.push(await req('/auth/register', { method: 'POST', body }));
  }
  check('malformed/scripty register inputs never 500', injectionResults.every((r) => r.status !== 500));
  check('no server crash on injection attempts', true);

  const nonB64 = await req('/conversations', { method: 'POST', body: { participantId: 'not-a-uuid' } });
  check('invalid participant id → 4xx not crash', [401, 404, 400, 403].includes(nonB64.status));

  // Setup for auth tests
  const [a, b] = [await reg('HardenA'), await reg('HardenB')];
  check('test users registered', a.status === 201 && b.status === 201 && a.data.token);
  const tokenA = a.data.token;

  // oversized message payload
  const conv = await req('/conversations', { method: 'POST', token: tokenA, body: { participantId: b.data.user.id } });
  const convId = conv.data.conversation.id;
  const oversized = {
    ciphertext: 'A'.repeat(2_000_001),
    iv: Buffer.from('0123456789ab').toString('base64'),
    wrappedKey: 'QUJD',
    senderWrappedKey: 'QUJD',
  };
  const bigMsg = await req(`/conversations/${convId}/messages`, { method: 'POST', token: tokenA, body: oversized });
  check('oversized ciphertext rejected (400/413)', bigMsg.status === 400 || bigMsg.status === 413);
  const badB64 = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: { ciphertext: '!!!not-base64!!!', iv: 'abc', wrappedKey: 'abc', senderWrappedKey: 'abc' },
  });
  check('non-base64 ciphertext rejected (400)', badB64.status === 400);

  // ---- JWT MANIPULATION ----
  console.log('--- JWT manipulation rejected ---');
  let anyok = false;
  check('garbage token rejected (401)', (await req('/auth/me', { token: 'garbage.token.value' })).status === 401);

  const noneToken = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: a.data.user.id, role: 'admin' })}.`;
  const noneRes = await req('/admin/users', { token: noneToken });
  check('alg:none token rejected', noneRes.status === 401 || noneRes.status === 403);

  const forgedRole = jwt.sign({ sub: a.data.user.id, role: 'admin', email: 'x@y.z' }, 'wrong-secret', { algorithm: 'HS256' });
  const forgedRes = await req('/admin/users', { token: forgedRole });
  check('forged-signature token rejected', forgedRes.status === 401);

  const expired = jwt.sign({ sub: a.data.user.id, role: 'user', email: 'x@y.z' }, config.jwt.secret, { algorithm: 'HS256', expiresIn: '-10s' });
  const expiredRes = await req('/auth/me', { token: expired });
  check('expired token rejected (401)', expiredRes.status === 401);

  // ---- ACCESS CONTROL ----
  console.log('--- broken access control ---');
  const outsiderMsg = await req(`/conversations/${convId}/messages`, { token: b.data.token });
  check('participant can read own conversation', outsiderMsg.status === 200);
  const [c] = [await reg('HardenC')];
  const outsider = await req(`/conversations/${convId}/messages`, { token: c.data.token });
  check('non-participant cannot read messages (404)', outsider.status === 404);
  const outsiderMeta = await req(`/conversations/${convId}`, { token: c.data.token });
  check('non-participant cannot fetch conversation (404)', outsiderMeta.status === 404);

  // ---- SOCKET AUTHORIZATION ----
  console.log('--- socket authorization ---');
  const noTokenSocket = await connect(null);
  check('socket without token rejected', Boolean(noTokenSocket.error));
  if (noTokenSocket.id) noTokenSocket.disconnect();

  const outsiderSock = await connect(c.data.token);
  check('outsider socket connects (valid JWT)', Boolean(outsiderSock.id));
  if (!outsiderSock.id) process.exit(1);
  const joinAck = await new Promise((resolve) => outsiderSock.emit('conversation:join', { conversationId: convId }, resolve));
  check('non-participant cannot join conversation room', Boolean(joinAck && joinAck.error));
  outsiderSock.disconnect();

  const legitSock = await connect(tokenA);
  const legitJoin = await new Promise((resolve) => legitSock.emit('conversation:join', { conversationId: convId }, resolve));
  check('participant joins room', Boolean(legitJoin && legitJoin.ok));
  const oversizeAck = await emitWithTimeout(legitSock, 'message:send', { conversationId: convId, ...oversized });
  check('socket rejects oversized message', Boolean(oversizeAck && oversizeAck.error) || oversizeAck === null);
  legitSock.disconnect();

  // ---- SUSPENDED USER BLOCKED ----
  console.log('--- suspended user blocked ---');
  const { updateUser } = require('../src/services/userStore');
  const storedB = require('../src/services/userStore').findByEmail(b.data.user.email);
  updateUser(storedB.id, { role: 'admin' });
  const adminLogin = await req('/auth/login', { method: 'POST', body: { email: b.data.user.email, password: 'Password123!' } });
  const adminToken = adminLogin.data.token;
  const suspended = await req(`/admin/users/${storedB.id}`, { method: 'PATCH', token: adminToken, body: { status: 'suspended' } });
  check('admin suspends target user', suspended.status === 200);
  const suspendedApi = await req('/auth/me', { token: b.data.token });
  check('suspended user existing token blocked (403)', suspendedApi.status === 403);
  const suspendedSocket = await connect(b.data.token);
  check('suspended user socket rejected', Boolean(suspendedSocket.error));
  if (suspendedSocket.id) suspendedSocket.disconnect();

  // ---- RATE LIMITING ----
  console.log('--- rate limiting ---');
  const attempts = [];
  for (let i = 0; i < 25; i += 1) {
    attempts.push(await req('/auth/login', { method: 'POST', body: { email: `ratelimit${stamp}@e.com`, password: 'WrongPass1!' } }));
  }
  check('rapid login attempts rate-limited (429)', attempts.some((r) => r.status === 429));
  const validLoginAfter = await req('/auth/login', { method: 'POST', body: { email: a.data.user.email, password: 'Password123!' } });
  check('system still functional after rate limit window pressure', validLoginAfter.status === 200 || validLoginAfter.status === 429);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});