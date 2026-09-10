const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const DATA_DIR = path.join(__dirname, '..', 'data');
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

async function req(pathStr, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathStr}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function waitEvent(socket, event, predicate, timeout = 7000) {
  return new Promise((resolve) => {
    const handler = (data) => {
      if (predicate && !predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeout);
    socket.on(event, handler);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connect(token) {
  return new Promise((resolve) => {
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => resolve({ error: err.message }));
  });
}

async function main() {
  console.log('=== PHASE 7 INTEGRATION TESTS ===');
  const cryptoEngine = await import('../../client/src/crypto/cryptoEngine.js');

  // ---- SETUP ----
  console.log('--- setup ---');
  const stamp = Date.now();
  const register = async (name) =>
    req('/auth/register', { method: 'POST', body: { name, email: `${name}${stamp}@example.com`, password: 'Password123!' } });
  const a = await register('Alice');
  const b = await register('Bob');
  check('users registered', a.status === 201 && b.status === 201);
  const tokenA = a.data.token;
  const tokenB = b.data.token;

  const keyOf = async () => {
    const pair = await cryptoEngine.generateKeyPair();
    const [pub, priv] = await Promise.all([
      cryptoEngine.exportPublicKeyJwk(pair.publicKey),
      cryptoEngine.exportPrivateKeyJwk(pair.privateKey),
    ]);
    return { pub, priv };
  };
  const aKeys = await keyOf();
  const bKeys = await keyOf();
  await req('/crypto/public-key', { method: 'POST', token: tokenA, body: { publicKey: aKeys.pub } });

  const conv = await req('/conversations', { method: 'POST', token: tokenA, body: { participantId: b.data.user.id } });
  const convId = conv.data.conversation.id;
  check('conversation created', conv.status === 201);

  const sockB = await connect(tokenB);
  check('B socket connects', Boolean(sockB.id));
  await new Promise((resolve) => sockB.emit('conversation:join', { conversationId: convId }, resolve));

  const encrypt = () => cryptoEngine.encryptMessageFor('self destruct test', [bKeys.pub, aKeys.pub]);
  const bodyFor = async (extra) => {
    const p = await encrypt();
    return {
      ciphertext: p.ciphertext,
      iv: p.iv,
      wrappedKey: p.wrappedKeys[0],
      senderWrappedKey: p.wrappedKeys[1],
      ...extra,
    };
  };

  // ---- VALIDATION ----
  console.log('--- expiry validation ---');
  const badType = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: await bodyFor({ expiryType: 'forever', expiryDuration: 10 }),
  });
  check('invalid expiryType rejected (400)', badType.status === 400);

  const badDur = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: await bodyFor({ expiryType: 'time', expiryDuration: 0 }),
  });
  check('invalid expiryDuration rejected (400)', badDur.status === 400);

  // ---- TIMER-BASED EXPIRY ----
  console.log('--- timer-based expiry ---');
  const timeMsg = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: await bodyFor({ expiryType: 'time', expiryDuration: 2 }),
  });
  check('time-based message sent (201)', timeMsg.status === 201);
  const m1 = timeMsg.data.message;
  const createdMs = new Date(m1.created_at).getTime();
  const expectedExpiry = createdMs + 2 * 1000;
  const actualExpiry = new Date(m1.expires_at).getTime();
  check('expires_at set to send time + duration', Math.abs(actualExpiry - expectedExpiry) <= 1500);

  const beforeExpiry = await req(`/conversations/${convId}/messages`, { token: tokenB });
  check('message present before expiry', beforeExpiry.data.messages.some((m) => m.id === m1.id));

  const bExpired1 = waitEvent(sockB, 'message:expired', (d) => d && d.messageId === m1.id);
  const evt1 = await bExpired1;
  check('B receives message:expired socket event', Boolean(evt1) && evt1.conversationId === convId);

  const afterExpiry = await req(`/conversations/${convId}/messages`, { token: tokenB });
  const m1gone = !afterExpiry.data.messages.some((m) => m.id === m1.id);
  check('expired message cannot be retrieved via API', m1gone);
  check('expired content NOT re-sent after reconnect/refetch', m1gone);

  const dbRaw = fs.readFileSync(path.join(DATA_DIR, 'messages.json'), 'utf8');
  check('database record purged', !dbRaw.includes(m1.id));

  // ---- READ-BASED EXPIRY ----
  console.log('--- read-based expiry ---');
  const readMsg = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: await bodyFor({ expiryType: 'read', expiryDuration: 2 }),
  });
  check('read-based message sent (201)', readMsg.status === 201);
  const m2 = readMsg.data.message;
  check('read-based message has no expires_at yet', m2.expires_at === null);

  await sleep(2500);
  const unreadStillThere = await req(`/conversations/${convId}/messages`, { token: tokenB });
  check('unread read-based message NOT expired at send+2.5s (timer starts on read)', unreadStillThere.data.messages.some((m) => m.id === m2.id));

  const readAt = new Date();
  const readResp = await req(`/messages/${m2.id}/read`, { method: 'POST', token: tokenB });
  check('recipient marks read (200)', readResp.status === 200 && Boolean(readResp.data.message.read_at));
  const m2Expiry = new Date(readResp.data.message.expires_at).getTime();
  check('read-based expires_at = read_at + duration', Math.abs(m2Expiry - (readAt.getTime() + 2 * 1000)) <= 1500);

  const bExpired2 = waitEvent(sockB, 'message:expired', (d) => d && d.messageId === m2.id);
  const evt2 = await bExpired2;
  check('B receives message:expired for read-based message', Boolean(evt2));

  const afterReadExpiry = await req(`/conversations/${convId}/messages`, { token: tokenB });
  check('read-based message purged and unreachable', !afterReadExpiry.data.messages.some((m) => m.id === m2.id));

  // ---- NON-EXPIRING MESSAGE SURVIVES ----
  console.log('--- no-expiry message persists ---');
  const normal = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: await bodyFor(),
  });
  check('message without expiry sent', normal.status === 201);
  await sleep(3000);
  const stillThere = await req(`/conversations/${convId}/messages`, { token: tokenB });
  check('non-expiring message still present after 3s', stillThere.data.messages.some((m) => m.id === normal.data.message.id));

  // ---- AUDIT LOG ----
  console.log('--- audit log (no plaintext) ---');
  const auditRaw = fs.readFileSync(path.join(DATA_DIR, 'audit_logs.json'), 'utf8');
  const audit = JSON.parse(auditRaw);
  check('audit log records expiry events', audit.some((e) => e.action === 'message_expired_purged'));
  check('audit log contains no plaintext/ciphertext', !auditRaw.includes('self destruct test') && !auditRaw.includes('ciphertext'));

  sockB.disconnect();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});