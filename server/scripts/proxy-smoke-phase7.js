const { io } = require('socket.io-client');
const path = require('path');

const BASE = 'http://localhost:5000/api';
const PROXY = 'http://localhost:3000';

async function probe(p, o = {}) {
  const r = await fetch(BASE + p, {
    method: o.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: 'Bearer ' + o.token } : {}) },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  return r.json();
}

function connect(url, token) {
  return new Promise((resolve) => {
    const s = io(url, { auth: { token } });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => resolve({ error: e.message }));
  });
}

(async () => {
  const crypto = await import('../../client/src/crypto/cryptoEngine.js');
  const uniq = Date.now();
  const ra = await probe('/auth/register', { method: 'POST', body: { name: 'Ea', email: `ea${uniq}@e.com`, password: 'Password123!' } });
  const rb = await probe('/auth/register', { method: 'POST', body: { name: 'Eb', email: `eb${uniq}@e.com`, password: 'Password123!' } });
  const conv = await probe('/conversations', { method: 'POST', token: ra.token, body: { participantId: rb.user.id } });
  const cid = conv.conversation.id;
  console.log('reg+conv', Boolean(ra.token && rb.token && cid));

  const sock = await connect(PROXY, ra.token);
  console.log('client-proxy socket connects', Boolean(sock.id), sock.error || '');
  if (!sock.id) process.exit(1);

  const kp = await crypto.generateKeyPair();
  const [pubJwk] = await Promise.all([crypto.exportPublicKeyJwk(kp.publicKey)]);
  const payload = await crypto.encryptMessageFor('proxy smoke', [pubJwk, pubJwk]);
  const sent = await new Promise((resolve) => {
    sock.emit('message:send', {
      conversationId: cid,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      wrappedKey: 'x',
      senderWrappedKey: 'y',
      expiryType: 'time',
      expiryDuration: 300,
    }, (resp) => resolve(resp));
  });
  console.log('socket send via proxy ack', Boolean(sent && sent.ok), (sent && sent.error) || '');
  sock.disconnect();
  process.exit(sent && sent.ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });