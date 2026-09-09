const BASE = 'http://localhost:5000/api';
const fs = require('fs');
const path = require('path');
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

async function register(name, email) {
  return req('/auth/register', {
    method: 'POST',
    body: { name, email, password: 'Password123!' },
  });
}

async function registerPublicKey(token, publicJwk) {
  return req('/crypto/public-key', { method: 'POST', token, body: { publicKey: publicJwk } });
}

async function main() {
  console.log('=== PHASE 5 INTEGRATION TESTS ===');

  const cryptoEngine = await import('../../client/src/crypto/cryptoEngine.js');
  const keyOf = async () => {
    const pair = await cryptoEngine.generateKeyPair();
    const [pub, priv] = await Promise.all([
      cryptoEngine.exportPublicKeyJwk(pair.publicKey),
      cryptoEngine.exportPrivateKeyJwk(pair.privateKey),
    ]);
    return { pub, priv };
  };

  // ---- SETUP: three users with keys ----
  console.log('--- setup (users + public keys) ---');
  const stamp = Date.now();
  const aKeys = await keyOf();
  const bKeys = await keyOf();
  const cKeys = await keyOf();

  const regA = await register('Alice', `alice${stamp}@example.com`);
  const regB = await register('Bob', `bob${stamp}@example.com`);
  const regC = await register('Cara', `cara${stamp}@example.com`);
  check('three users registered', regA.status === 201 && regB.status === 201 && regC.status === 201);

  const tokenA = regA.data.token;
  const tokenB = regB.data.token;
  const tokenC = regC.data.token;
  const idB = regB.data.user.id;

  await registerPublicKey(tokenA, aKeys.pub);
  await registerPublicKey(tokenB, bKeys.pub);
  await registerPublicKey(tokenC, cKeys.pub);

  // ---- USER SEARCH ----
  console.log('--- user search ---');
  const search = await req('/users/search?q=bob', { token: tokenA });
  check('search finds Bob by name', search.status === 200 && search.data.users.some((u) => u.id === idB));
  const searchSelf = await req('/users/search?q=alice', { token: tokenA });
  check('search excludes self', searchSelf.status === 200 && !searchSelf.data.users.some((u) => u.email === regA.data.user.email));
  const searchNone = await req('/users/search?q=', { token: tokenA });
  check('empty search rejected (400)', searchNone.status === 400);

  // ---- CONVERSATION ----
  console.log('--- conversation creation ---');
  const selfConv = await req('/conversations', { method: 'POST', token: tokenA, body: { participantId: regA.data.user.id } });
  check('self-conversation rejected (400)', selfConv.status === 400);

  const noAuth = await req('/conversations', { method: 'POST', body: { participantId: idB } });
  check('conversation creation requires auth (401)', noAuth.status === 401);

  const conv = await req('/conversations', { method: 'POST', token: tokenA, body: { participantId: idB } });
  check('conversation created (201)', conv.status === 201 && Boolean(conv.data.conversation.id));
  const convId = conv.data.conversation.id;

  const convAgain = await req('/conversations', { method: 'POST', token: tokenA, body: { participantId: idB } });
  check('duplicate conversation returns existing (200)', convAgain.status === 200 && convAgain.data.conversation.id === convId);

  const getAsC = await req(`/conversations/${convId}`, { token: tokenC });
  check('non-participant cannot view conversation (404)', getAsC.status === 404);

  // ---- SEND ENCRYPTED MESSAGE ----
  console.log('--- encrypted message send/retrieve/decrypt ---');
  const plaintext = 'MISSION: Launch passes locked. Meet at the library at 3pm.';
  const payload = await cryptoEngine.encryptMessageFor(plaintext, [bKeys.pub, aKeys.pub]);
  const sendBody = {
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    wrappedKey: payload.wrappedKeys[0],
    senderWrappedKey: payload.wrappedKeys[1],
  };
  const missingField = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: { ciphertext: payload.ciphertext },
  });
  check('message missing fields rejected (400)', missingField.status === 400);

  const outsideConv = await req('/conversations/00000000-0000-0000-0000-000000000000/messages', {
    method: 'POST',
    token: tokenA,
    body: sendBody,
  });
  check('cannot message unknown conversation (404)', outsideConv.status === 404);

  const send = await req(`/conversations/${convId}/messages`, { method: 'POST', token: tokenA, body: sendBody });
  check('encrypted message sent (201)', send.status === 201);
  check('recipient resolved to Bob', send.data.message.recipient_id === idB);

  const msgCipher = send.data.message.ciphertext;
  check('stored ciphertext is not plaintext', !msgCipher.includes(plaintext.slice(0, 10)));

  const storedMessagesJson = fs.readFileSync(
    path.join(__dirname, '..', 'data', 'messages.json'),
    'utf8'
  );
  check('DB file contains no plaintext', !storedMessagesJson.includes(plaintext.slice(0, 10)));

  const msgsAsC = await req(`/conversations/${convId}/messages`, { token: tokenC });
  check('non-participant cannot list messages (404)', msgsAsC.status === 404);

  const msgsAsB = await req(`/conversations/${convId}/messages`, { token: tokenB });
  check('recipient lists messages (200)', msgsAsB.status === 200 && msgsAsB.data.messages.length === 1);
  const stored = msgsAsB.data.messages[0];
  const decryptBack = await cryptoEngine.decryptMessage(
    { ciphertext: stored.ciphertext, iv: stored.nonce, wrappedKey: stored.encrypted_key_reference },
    bKeys.priv
  );
  check('recipient decrypts to original plaintext', decryptBack === plaintext);

  const asSender = await cryptoEngine.decryptMessage(
    { ciphertext: stored.ciphertext, iv: stored.nonce, wrappedKey: stored.sender_key_reference },
    aKeys.priv
  );
  check('sender decrypts own copy via sender_key_reference', asSender === plaintext);

  const convsAsA = await req('/conversations', { token: tokenA });
  check('sender sees conversation in list', convsAsA.status === 200 && convsAsA.data.conversations.length === 1);

  // ---- READ + DELETE ----
  console.log('--- read/delete ---');
  const readBySender = await req(`/messages/${stored.id}/read`, { method: 'POST', token: tokenA });
  check('sender cannot mark as read (403)', readBySender.status === 403);

  const readByRecipient = await req(`/messages/${stored.id}/read`, { method: 'POST', token: tokenB });
  check('recipient marks as read (200)', readByRecipient.status === 200 && Boolean(readByRecipient.data.message.read_at));

  const deleteByC = await req(`/messages/${stored.id}`, { method: 'DELETE', token: tokenC });
  check('non-participant cannot delete (404)', deleteByC.status === 404);

  const deleteByB = await req(`/messages/${stored.id}`, { method: 'DELETE', token: tokenB });
  check('participant can delete (200)', deleteByB.status === 200 && deleteByB.data.ok === true);

  const afterDelete = await req(`/conversations/${convId}/messages`, { token: tokenB });
  check('deleted message no longer listed', afterDelete.status === 200 && afterDelete.data.messages.length === 0);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});