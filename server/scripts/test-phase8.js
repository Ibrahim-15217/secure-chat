const fs = require('fs');
const path = require('path');

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

async function req(p, { method = 'GET', token, body, raw } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : raw,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== PHASE 8 INTEGRATION TESTS ===');
  const crypto = await import('../../client/src/crypto/cryptoEngine.js');

  const stamp = Date.now();
  const reg = (n) => req('/auth/register', { method: 'POST', body: { name: n, email: `${n}${stamp}@e.com`, password: 'Password123!' } });
  const [a, b, c] = [await reg('FileA'), await reg('FileB'), await reg('FileC')];
  check('users registered', a.status === 201 && b.status === 201 && c.status === 201);
  const tokenA = a.data.token;
  const tokenB = b.data.token;
  const tokenC = c.data.token;

  const keyOf = async () => {
    const pair = await crypto.generateKeyPair();
    const [pub, priv] = await Promise.all([crypto.exportPublicKeyJwk(pair.publicKey), crypto.exportPrivateKeyJwk(pair.privateKey)]);
    return { pub, priv };
  };
  const aKeys = await keyOf();
  const bKeys = await keyOf();
  await req('/crypto/public-key', { method: 'POST', token: tokenA, body: { publicKey: aKeys.pub } });
  await req('/crypto/public-key', { method: 'POST', token: tokenB, body: { publicKey: bKeys.pub } });

  const conv = await req('/conversations', { method: 'POST', token: tokenA, body: { participantId: b.data.user.id } });
  const convId = conv.data.conversation.id;
  check('conversation created', conv.status === 201);

  // ---- UPLOAD + CIPHERTEXT-ONLY STORAGE ----
  console.log('--- encrypted upload ---');
  const plainSecret = 'TOP SECRET PAYLOAD 3X5-A160';
  const enc = await crypto.encryptFile(new TextEncoder().encode(plainSecret), [bKeys.pub, aKeys.pub]);
  const meta = await req('/files', {
    method: 'POST',
    token: tokenA,
    body: {
      conversationId: convId,
      name: 'report.txt',
      mime: 'text/plain',
      size: enc.cipherBytes.length,
      iv: enc.iv,
      authTag: enc.authTag,
      wrappedKey: enc.wrappedKey,
      senderWrappedKey: enc.senderWrappedKey,
      accessWindowSeconds: 900,
    },
  });
  check('file meta created (201)', meta.status === 201);
  const fileId = meta.data.file.id;

  const up = await req(`/files/${fileId}/body`, {
    method: 'PUT',
    token: tokenA,
    raw: enc.cipherBytes,
  });
  check('ciphertext body uploaded', up.status === 200 && up.data.file.status === 'ready');

  const disk = fs.readFileSync(path.join(__dirname, '..', 'data', 'uploads', `${fileId}.bin`));
  check('storage contains only ciphertext (no plaintext)', !Buffer.from(disk).toString('latin1').includes(plainSecret) && !Buffer.from(disk).toString('utf8').includes(plainSecret));
  check('stored bytes equal ciphertext length', disk.length === enc.cipherBytes.length);

  // ---- UNAUTHORIZED ACCESS BLOCKED ----
  console.log('--- authorization ---');
  const noToken = await req(`/files/${fileId}/download`);
  check('download without token rejected', noToken.status === 401);
  const badToken = await req(`/files/${fileId}/download?token=forged.stuff`);
  check('forged token rejected', badToken.status === 401);
  const outsider = await req(`/files/${fileId}/token`, { token: tokenC });
  check('non-participant cannot get download token', outsider.status === 403 || outsider.status === 404);
  const outsiderList = await req(`/files/conversation/${convId}`, { token: tokenC });
  check('non-participant cannot list files', outsiderList.status === 403 || outsiderList.status === 404);

  // ---- AUTHORIZED RECIPIENT CAN DOWNLOAD + DECRYPT ----
  console.log('--- authorized download + decrypt ---');
  const tok = await req(`/files/${fileId}/token`, { token: tokenB });
  check('recipient gets temporary download token', tok.status === 200 && Boolean(tok.data.token && tok.data.expiresAt));
  const got = await fetch(`${BASE}/files/${fileId}/download?token=${encodeURIComponent(tok.data.token)}`);
  check('authorized download returns 200', got.status === 200);
  const cipherBytes = new Uint8Array(await got.arrayBuffer());
  const deciphered = await crypto.decryptFile(cipherBytes, { iv: enc.iv, wrappedKey: enc.wrappedKey }, bKeys.priv);
  check('recipient decrypts plaintext correctly', new TextDecoder().decode(deciphered) === plainSecret);

  // ---- META NOT EXPOSED TO NON-PARTICIPANT ----
  const metaOutsider = await req(`/files/${fileId}/meta`, { token: tokenC });
  check('non-participant cannot read file meta', metaOutsider.status === 403 || metaOutsider.status === 404);

  // ---- EXPIRE / REVOCATION ----
  console.log('--- time-limited access ---');
  const short = await crypto.encryptFile(new TextEncoder().encode('short lived'), [bKeys.pub, aKeys.pub]);
  const shortMeta = await req('/files', {
    method: 'POST',
    token: tokenA,
    body: {
      conversationId: convId,
      name: 'short.bin',
      mime: 'application/octet-stream',
      size: short.cipherBytes.length,
      iv: short.iv,
      authTag: short.authTag,
      wrappedKey: short.wrappedKey,
      senderWrappedKey: short.senderWrappedKey,
      accessWindowSeconds: 2,
    },
  });
  const shortId = shortMeta.data.file.id;
  await req(`/files/${shortId}/body`, { method: 'PUT', token: tokenA, raw: short.cipherBytes });
  check('short-lived file uploads OK', Boolean(shortId));

  await sleep(3000);
  const expiredTok = await req(`/files/${shortId}/token`, { token: tokenB });
  check('expired file refuses access (token endpoint)', expiredTok.status === 410 || expiredTok.status === 404);
  const shortMetaFetch = await req(`/files/${shortId}/meta`, { token: tokenB });
  check('expired file meta unreachable', shortMetaFetch.status === 410 || shortMetaFetch.status === 404);
  check('expired ciphertext purged from disk', !fs.existsSync(path.join(__dirname, '..', 'data', 'uploads', `${shortId}.bin`)));

  // ---- AUDIT LOG ----
  console.log('--- audit log ---');
  const auditRaw = fs.readFileSync(path.join(__dirname, '..', 'data', 'audit_logs.json'), 'utf8');
  const audit = JSON.parse(auditRaw);
  check('audit records file expiry purge', audit.some((e) => e.action === 'file_expired_purged'));
  check('audit log contains no plaintext', !auditRaw.includes(plainSecret));

  // ---- REVOKE VIA DELETE ----
  console.log('--- explicit revocation ---');
  const del = await req(`/files/${fileId}`, { method: 'DELETE', token: tokenB });
  check('participant deletes file', del.status === 200);
  const afterDel = await req(`/files/${fileId}/meta`, { token: tokenB });
  check('deleted file is gone', afterDel.status === 404);
  check('deleted ciphertext removed from disk', !fs.existsSync(path.join(__dirname, '..', 'data', 'uploads', `${fileId}.bin`)));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});