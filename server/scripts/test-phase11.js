const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5000/api';
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
  console.log('=== PHASE 11 TESTING & EVALUATION ===');
  const cryptoEngine = await import('../../client/src/crypto/cryptoEngine.js');

  // ---- CIPHERTEXT TAMPERING + FORENSIC SELF-DESTRUCT ----
  console.log('--- security / forensic ---');
  const stamp = Date.now();
  const reg = (n) => req('/auth/register', { method: 'POST', body: { name: n, email: `${n}${stamp}@e.com`, password: 'Password123!' } });
  const [a, b] = [await reg('EvalA'), await reg('EvalB')];
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
  const convId = conv.data.conversation.id;

  const b64toBytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

  const tamper = await cryptoEngine.encryptMessageFor('deliver untampered', [bKeys.pub, aKeys.pub]);
  const cT = b64toBytes(tamper.ciphertext);
  cT[Math.floor(cT.length / 2)] ^= 0x40;
  const send = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: a.data.token,
    body: {
      ciphertext: Buffer.from(cT).toString('base64'),
      iv: tamper.iv,
      wrappedKey: tamper.wrappedKeys[0],
      senderWrappedKey: tamper.wrappedKeys[1],
    },
  });
  check('tampered ciphertext accepted at rest (server cannot see plaintext)', send.status === 201);
  await req(`/messages/${send.data.message.id}/read`, { method: 'POST', token: b.data.token });
  const list = await req(`/conversations/${convId}/messages`, { token: b.data.token });
  const tamperedMsg = list.data.messages.find((m) => m.id === send.data.message.id);
  let decOk = false;
  try {
    await cryptoEngine.decryptMessage(
      { ciphertext: tamperedMsg.ciphertext, iv: tamperedMsg.nonce, wrappedKey: tamperedMsg.encrypted_key_reference },
      bKeys.priv
    );
    decOk = true;
  } catch {
    decOk = false;
  }
  check('tampered ciphertext FAILS decryption (integrity)', decOk === false);

  // ---- FORENSIC RECOVERY: EXPIRED MESSAGE MUST BE UNRECOVERABLE ----
  const secret = await cryptoEngine.encryptMessageFor('burn after read', [bKeys.pub, aKeys.pub]);
  const bMsg = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: a.data.token,
    body: {
      ciphertext: secret.ciphertext,
      iv: secret.iv,
      wrappedKey: secret.wrappedKeys[0],
      senderWrappedKey: secret.wrappedKeys[1],
      expiryType: 'time',
      expiryDuration: 2,
    },
  });
  await sleep(3500);
  const after = await req(`/conversations/${convId}/messages`, { token: b.data.token });
  check('expired message gone from API (forensic chain-of-custody safe)', !after.data.messages.some((m) => m.id === bMsg.data.message.id));
  const rawDb = fs.readFileSync(path.join(DATA_DIR, 'messages.json'), 'utf8');
  check('expired message absent from physical DB file', !rawDb.includes(bMsg.data.message.id));
  const audit = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'audit_logs.json'), 'utf8'));
  {
    const purge = audit.filter((e) => e.action === 'message_expired_purged' || e.action === 'file_expired_purged');
    check('audit trail records purge without content', purge.length > 0 && !JSON.stringify(purge).includes('burn after read'));
  }

  // ---- INTEGRATION: full E2E path via proxy ----
  console.log('--- integration (frontend->backend via proxy) ---');
  let proxyOk = false;
  try {
    const sockProbe = await import('socket.io-client');
    const s = sockProbe.io('http://localhost:3000', { auth: { token: a.data.token }, transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      s.on('connect', resolve);
      s.on('connect_error', reject);
    });
    const enc2 = await cryptoEngine.encryptMessageFor('e2e proxy message', [bKeys.pub, aKeys.pub]);
    const ok = await new Promise((resolve) =>
      s.emit('message:send', {
        conversationId: convId,
        ciphertext: enc2.ciphertext,
        iv: enc2.iv,
        wrappedKey: enc2.wrappedKeys[0],
        senderWrappedKey: enc2.wrappedKeys[1],
      }, resolve)
    );
    proxyOk = Boolean(ok && ok.ok);
    s.disconnect();
  } catch {
    proxyOk = false;
  }
  check('E2E socket delivery through proxy', proxyOk);

  // ---- PERFORMANCE ----
  console.log('--- performance vs unencrypted baseline ---');
  const N = 12;
  const baseline = await req('/health');
  const baselineMs = baseline.ms;

  let encMs = 0;
  let decMs = 0;
  for (let i = 0; i < 3; i += 1) {
    const t0 = performance.now();
    const p = await cryptoEngine.encryptMessageFor('x'.repeat(120), [bKeys.pub, aKeys.pub]);
    encMs += performance.now() - t0;
    const t1 = performance.now();
    await cryptoEngine.decryptMessage({ ciphertext: p.ciphertext, iv: p.iv, wrappedKey: p.wrappedKeys[0] }, bKeys.priv);
    decMs += performance.now() - t1;
  }
  encMs /= 3;
  decMs /= 3;

  let sendMs = 0;
  let readMs = 0;
  for (let i = 0; i < N; i += 1) {
    const p = await cryptoEngine.encryptMessageFor('perf ' + i, [bKeys.pub, aKeys.pub]);
    const t0 = performance.now();
    const r = await req(`/conversations/${convId}/messages`, {
      method: 'POST',
      token: a.data.token,
      body: {
        ciphertext: p.ciphertext,
        iv: p.iv,
        wrappedKey: p.wrappedKeys[0],
        senderWrappedKey: p.wrappedKeys[1],
      },
    });
    sendMs += performance.now() - t0;
    const t1 = performance.now();
    await req(`/conversations/${convId}/messages`, { token: b.data.token });
    readMs += performance.now() - t1;
  }
  sendMs /= N;
  readMs /= N;

  const d0 = performance.now();
  const dur = await cryptoEngine.encryptMessageFor('expiry probe', [bKeys.pub, aKeys.pub]);
  const expMsg = await req(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: a.data.token,
    body: {
      ciphertext: dur.ciphertext,
      iv: dur.iv,
      wrappedKey: dur.wrappedKeys[0],
      senderWrappedKey: dur.wrappedKeys[1],
      expiryType: 'time',
      expiryDuration: 1,
    },
  });
  const purgeProbe = fs.statSync(path.join(DATA_DIR, 'messages.json'));
  let purgeMs = 0;
  for (let i = 0; i < 50; i += 1) {
    if (fs.statSync(path.join(DATA_DIR, 'messages.json')).size !== purgeProbe.size) {
      const raw2 = fs.readFileSync(path.join(DATA_DIR, 'messages.json'), 'utf8');
      if (!raw2.includes(expMsg.data.message.id)) {
        purgeMs = performance.now() - d0;
        break;
      }
    }
    await sleep(50);
  }
  check('self-destruct processed within 1s window + sweep', purgeMs > 0 && purgeMs <= 2500, `${purgeMs.toFixed(0)}ms`);

  console.log(`   metrics:
    unencrypted baseline request: ${baselineMs.toFixed(1)} ms
    encryption overhead:           ${encMs.toFixed(1)} ms
    decryption overhead:           ${decMs.toFixed(1)} ms
    message send (REST+store):     ${sendMs.toFixed(1)} ms
    message read (REST+store):     ${readMs.toFixed(1)} ms
    self-destruct purge detected:  ${purgeMs.toFixed(0)} ms`);

  const totalLatency = sendMs - baselineMs;
  check('encrypted msg vs unencrypted baseline < 500ms target', totalLatency < 500, `${totalLatency.toFixed(1)}ms net`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});