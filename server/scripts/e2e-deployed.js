const { performance } = require('perf_hooks');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000/api';
let pass = 0;
let fail = 0;

function check(label, cond) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
  }
}

async function req(p, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const started = performance.now();
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms: performance.now() - started };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`=== DEPLOYED E2E against ${BASE} ===`);
  const stamp = Date.now();
  const reg = (n) => req('/auth/register', { method: 'POST', body: { name: n, email: `${n}${stamp}@e.com`, password: 'Password123!' } });
  const a = await reg('DeployA');
  const b = await reg('DeployB');
  check('registration via HTTPS production origin', a.status === 201 && b.status === 201);

  const cryptoEngine = await import('../../client/src/crypto/cryptoEngine.js');
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
  await req('/crypto/public-key', { method: 'POST', token: a.data.token, body: { publicKey: aKeys.pub } });
  await req('/crypto/public-key', { method: 'POST', token: b.data.token, body: { publicKey: bKeys.pub } });

  const conv = await req('/conversations', { method: 'POST', token: a.data.token, body: { participantId: b.data.user.id } });
  check('conversation created on deployed backend', conv.status === 201);
  const convId = conv.data.conversation.id;

  const crypt = await cryptoEngine.encryptMessageFor('deployed end-to-end', [bKeys.pub, aKeys.pub]);
  const send = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: a.data.token,
    body: {
      ciphertext: crypt.ciphertext,
      iv: crypt.iv,
      wrappedKey: crypt.wrappedKeys[0],
      senderWrappedKey: crypt.wrappedKeys[1],
    },
  });
  check('encrypted message accepted on deployed backend', send.status === 201);

  await req(`/messages/${send.data.message.id}/read`, { method: 'POST', token: b.data.token });
  const list = await req(`/conversations/${convId}/messages`, { token: b.data.token });
  const recv = list.data.messages.find((m) => m.id === send.data.message.id);
  const plain = await cryptoEngine.decryptMessage(
    { ciphertext: recv.ciphertext, iv: recv.nonce, wrappedKey: recv.encrypted_key_reference },
    bKeys.priv
  );
  check('recipient decrypts E2E across deployments', plain === 'deployed end-to-end');

  const self = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: a.data.token,
    body: {
      ciphertext: crypt.ciphertext,
      iv: crypt.iv,
      wrappedKey: crypt.wrappedKeys[0],
      senderWrappedKey: crypt.wrappedKeys[1],
      expiryType: 'time',
      expiryDuration: 1,
    },
  });
  await sleep(4200);
  const after = await req(`/conversations/${convId}/messages`, { token: b.data.token });
  check('self-destruct expiry works on deployed backend', !after.data.messages.some((m) => m.id === self.data.message.id));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});