const { io } = require('socket.io-client');

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

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 3000);
    socket.emit(event, payload, (resp) => {
      clearTimeout(timer);
      resolve(resp || {});
    });
  });
}

function waitEvent(socket, event, predicate, timeout = 1500) {
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
  console.log('=== PHASE 6 INTEGRATION TESTS ===');

  const cryptoEngine = await import('../../client/src/crypto/cryptoEngine.js');
  const keyOf = async () => {
    const pair = await cryptoEngine.generateKeyPair();
    const [pub, priv] = await Promise.all([
      cryptoEngine.exportPublicKeyJwk(pair.publicKey),
      cryptoEngine.exportPrivateKeyJwk(pair.privateKey),
    ]);
    return { pub, priv };
  };

  // ---- SETUP ----
  console.log('--- setup ---');
  const stamp = Date.now();
  const register = async (name) =>
    req('/auth/register', { method: 'POST', body: { name, email: `${name}${stamp}@example.com`, password: 'Password123!' } });
  const a = await register('Alice');
  const b = await register('Bob');
  const c = await register('Cara');
  check('users registered', a.status === 201 && b.status === 201 && c.status === 201);

  const aKeys = await keyOf();
  const bKeys = await keyOf();
  await req('/crypto/public-key', { method: 'POST', token: a.data.token, body: { publicKey: aKeys.pub } });

  const conv = await req('/conversations', { method: 'POST', token: a.data.token, body: { participantId: b.data.user.id } });
  const convId = conv.data.conversation.id;

  // ---- HANDSHAKE AUTH ----
  console.log('--- handshake auth ---');
  const bad = await connect('invalid.token');
  check('unauthenticated socket rejected', bad && !!bad.error);
  if (bad && !bad.error) bad.disconnect();

  const noToken = await connect(undefined);
  check('missing token rejected', noToken && !!noToken.error);
  if (noToken && !noToken.error) noToken.disconnect();

  const sockA = await connect(a.data.token);
  const sockB = await connect(b.data.token);
  const sockC = await connect(c.data.token);
  check('authenticated sockets connect', sockA && sockA.id && sockB && sockB.id && sockC && sockC.id);

  // ---- ROOM AUTHORIZATION ----
  console.log('--- room authorization ---');
  const joinA = await emitAck(sockA, 'conversation:join', { conversationId: convId });
  check('participant A joins room', joinA.ok === true);

  const joinC = await emitAck(sockC, 'conversation:join', { conversationId: convId });
  check('non-participant C cannot join room', !joinC.ok && joinC.error === 'Forbidden');

  const joinGhost = await emitAck(sockC, 'conversation:join', { conversationId: '00000000-0000-0000-0000-000000000000' });
  check('nonexistent conversation join rejected', !joinGhost.ok);

  // ---- REAL-TIME MESSAGE FLOW ----
  console.log('--- message flow ---');
  const joinB = await emitAck(sockB, 'conversation:join', { conversationId: convId });
  check('participant B joins room', joinB.ok === true);

  const cGetsNew = waitEvent(sockC, 'message:new');
  const bGetsNew = waitEvent(sockB, 'message:new', (d) => d && d.message);

  const plaintext = 'Realtime: meet me in the library basement.';
  const bPayload = await cryptoEngine.encryptMessageFor(plaintext, [bKeys.pub, aKeys.pub]);
  const sentResp = await emitAck(sockA, 'message:send', {
    conversationId: convId,
    ciphertext: bPayload.ciphertext,
    iv: bPayload.iv,
    wrappedKey: bPayload.wrappedKeys[0],
    senderWrappedKey: bPayload.wrappedKeys[1],
  });
  check('message:send ack ok', sentResp.ok === true && Boolean(sentResp.message.id));

  const bMsg = await bGetsNew;
  check('recipient B receives message:new', Boolean(bMsg) && bMsg.message.id === sentResp.message.id);

  const c2 = await cGetsNew;
  check('C (not in room) receives NO message:new', c2 === null);

  const storedList = await req(`/conversations/${convId}/messages`, { token: b.data.token });
  const stored = storedList.data.messages.find((m) => m.id === sentResp.message.id);
  check('socket message persisted', Boolean(stored));
  const decrypted = await cryptoEngine.decryptMessage(
    { ciphertext: stored.ciphertext, iv: stored.nonce, wrappedKey: stored.encrypted_key_reference },
    bKeys.priv
  );
  check('B decrypts realtime message', decrypted === plaintext);

  const badSend = await emitAck(sockA, 'message:send', {
    conversationId: '00000000-0000-0000-0000-000000000000',
    ciphertext: 'x',
    iv: 'x',
    wrappedKey: 'x',
    senderWrappedKey: 'x',
  });
  check('send to nonexistent conversation rejected', !badSend.ok);

  // ---- READ RECEIPT ----
  console.log('--- read receipt ---');
  const aGetsRead = waitEvent(sockA, 'message:read', (d) => d && d.messageId === sentResp.message.id);
  const readAck = await emitAck(sockB, 'message:read', { messageId: sentResp.message.id });
  check('message:read ack ok', readAck.ok === true);
  const readEvt = await aGetsRead;
  check('sender A receives message:read', Boolean(readEvt) && Boolean(readEvt.readAt));

  // ---- TYPING INDICATORS ----
  console.log('--- typing indicators ---');
  const bTyping = waitEvent(sockB, 'typing:start', (d) => d && d.conversationId === convId);
  await emitAck(sockA, 'typing:start', { conversationId: convId });
  check('B receives typing:start', Boolean(await bTyping));

  const bStop = waitEvent(sockB, 'typing:stop', (d) => d && d.conversationId === convId);
  await emitAck(sockA, 'typing:stop', { conversationId: convId });
  check('B receives typing:stop', Boolean(await bStop));

  const cTyping = waitEvent(sockC, 'typing:start', undefined, 800);
  await emitAck(sockA, 'typing:start', { conversationId: convId });
  const cTypingEvt = await cTyping;
  check('C receives NO typing event (isolation)', cTypingEvt === null);

  sockA.disconnect();
  sockB.disconnect();
  sockC.disconnect();

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});