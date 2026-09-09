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
  console.log('=== PHASE 4 INTEGRATION TESTS ===');

  // ---- CLIENT-SIDE CRYPTO ENGINE (WebCrypto in Node) ----
  console.log('--- crypto engine (AES-256-GCM + RSA-OAEP hybrid) ---');
  const cryptoEngine = await import('../../client/src/crypto/cryptoEngine.js');

  const alice = await cryptoEngine.generateKeyPair();
  const [alicePub, alicePriv] = await Promise.all([
    cryptoEngine.exportPublicKeyJwk(alice.publicKey),
    cryptoEngine.exportPrivateKeyJwk(alice.privateKey),
  ]);
  check('generateKeyPair produces RSA keys', alicePub.kty === 'RSA' && Boolean(alicePriv.d));
  check('public key has no private material', !('d' in alicePub) && !('p' in alicePub) && !('q' in alicePub));

  const secret = 'Hello secure chat! The quick brown fox jumps over the lazy dog.';
  const payload = await cryptoEngine.encryptMessage(secret, alicePub);
  check('encryptMessage returns ciphertext+iv+wrappedKey', Boolean(payload.ciphertext) && Boolean(payload.iv) && Boolean(payload.wrappedKey));
  check('ciphertext is base64 (no plaintext visible)', !payload.ciphertext.includes(secret.slice(0, 10)));

  const decrypted = await cryptoEngine.decryptMessage(payload, alicePriv);
  check('decryptMessage round-trips original text', decrypted === secret);

  const secondPayload = await cryptoEngine.encryptMessage(secret, alicePub);
  check('session key is random (wrapped key differs per message)', payload.wrappedKey !== secondPayload.wrappedKey);

  const tampered = { ...payload, ciphertext: payload.ciphertext.slice(0, -1) + (payload.ciphertext.endsWith('A') ? 'B' : 'A') };
  await cryptoEngine.decryptMessage(tampered, alicePriv).then(
    () => check('tampered ciphertext rejected', false),
    () => check('tampered ciphertext rejected', true)
  );

  // wrong recipient key
  const bob = await cryptoEngine.generateKeyPair();
  const [bobPub, bobPriv] = await Promise.all([
    cryptoEngine.exportPublicKeyJwk(bob.publicKey),
    cryptoEngine.exportPrivateKeyJwk(bob.privateKey),
  ]);
  const forBob = await cryptoEngine.encryptMessage(secret, bobPub);
  await cryptoEngine.decryptMessage(forBob, alicePriv).then(
    () => check('wrong private key rejected', false),
    () => check('wrong private key rejected', true)
  );

  // ---- PUBLIC KEY ENDPOINTS ----
  console.log('--- public key registration/retrieval ---');
  const email = `crypto${Date.now()}@example.com`;
  const reg = await req('/auth/register', {
    method: 'POST',
    body: { name: 'Crypto Subject', email, password: 'Password123!' },
  });
  check('register succeeds', reg.status === 201 && Boolean(reg.data.token));
  const token = reg.data.token;

  const regB = await req('/auth/register', {
    method: 'POST',
    body: { name: 'Recipient', email: `rec${Date.now()}@example.com`, password: 'Password123!' },
  });
  const bobServer = regB.data.user;

  const noAuth = await req('/crypto/public-key', { method: 'POST', body: { publicKey: alicePub } });
  check('register public key requires auth (401)', noAuth.status === 401);

  const badJwk = await req('/crypto/public-key', { method: 'POST', token, body: { publicKey: { kty: 'RSA', n: 'abc' } } });
  check('invalid JWK rejected (400)', badJwk.status === 400);

  const missKey = await req('/crypto/public-key', { method: 'POST', token, body: {} });
  check('missing publicKey rejected (400)', missKey.status === 400);

  const regKey = await req('/crypto/public-key', { method: 'POST', token, body: { publicKey: alicePub } });
  check('register public key succeeds', regKey.status === 200 && regKey.data.user.public_key.includes('RSA'));
  check('server does not store private material', !regKey.data.user.public_key.includes('"d"'));

  const retrieveMine = await req('/crypto/my-public-key', { token });
  check('retrieve own public key', retrieveMine.status === 200 && retrieveMine.data.publicKey.kty === 'RSA');

  const registerBob = await req('/crypto/public-key', { method: 'POST', token: regB.data.token, body: { publicKey: bobPub } });
  check('second user registers key', registerBob.status === 200);

  const getBob = await req(`/crypto/public-key/${bobServer.id}`, { token });
  check('retrieve other user public key', getBob.status === 200 && getBob.data.publicKey.n === bobPub.n);
  check('retrieved key has no private material', !('d' in getBob.data.publicKey));

  const getMissing = await req('/crypto/public-key/00000000-0000-0000-0000-000000000000', { token });
  check('unknown user returns 404', getMissing.status === 404);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});