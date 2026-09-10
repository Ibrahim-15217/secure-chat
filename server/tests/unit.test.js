const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const config = require('../src/config');
const conversationStore = require('../src/services/conversationStore');
const { validateMessageBody } = require('../src/validators/messages');
const { validateRegister, validateLogin } = require('../src/validators/auth');
const { verifyToken, verifyPreAuthToken } = require('../src/services/authService');

let engine;
describe('crypto unit', () => {
  test.before(async () => {
    const imported = await import(`../../client/src/crypto/cryptoEngine.js?u=${Date.now()}`);
    engine = imported;
  });

  test('RSA-OAEP keypair generation + export/import', async () => {
    const pair = await engine.generateKeyPair();
    const pub = await engine.exportPublicKeyJwk(pair.publicKey);
    const priv = await engine.exportPrivateKeyJwk(pair.privateKey);
    assert.ok(pub.kty === 'RSA' && priv.d);
    await engine.importPublicKeyJwk(pub);
    await engine.importPrivateKeyJwk(priv);
    assert.ok(true);
  });

  test('message encryption/decryption roundtrip', async () => {
    const a = await engine.generateKeyPair();
    const b = await engine.generateKeyPair();
    const [pubA, privA, pubB, privB] = await Promise.all([
      engine.exportPublicKeyJwk(a.publicKey),
      engine.exportPrivateKeyJwk(a.privateKey),
      engine.exportPublicKeyJwk(b.publicKey),
      engine.exportPrivateKeyJwk(b.privateKey),
    ]);
    const secret = 'hello self-destruct world';
    const enc = await engine.encryptMessageFor(secret, [pubB, pubA]);
    const decByB = await engine.decryptMessage({ ciphertext: enc.ciphertext, iv: enc.iv, wrappedKey: enc.wrappedKeys[0] }, privB);
    assert.equal(decByB, secret);
    const decByA = await engine.decryptMessage({ ciphertext: enc.ciphertext, iv: enc.iv, wrappedKey: enc.wrappedKeys[1] }, privA);
    assert.equal(decByA, secret);
  });

  test('decryption fails with wrong private key', async () => {
    const a = await engine.generateKeyPair();
    const b = await engine.generateKeyPair();
    const [pubB, privA] = await Promise.all([
      engine.exportPublicKeyJwk(b.publicKey),
      engine.exportPrivateKeyJwk(a.privateKey),
    ]);
    const enc = await engine.encryptMessageFor('for a wrong reader', [pubB]);
    await assert.rejects(() =>
      engine.decryptMessage({ ciphertext: enc.ciphertext, iv: enc.iv, wrappedKey: enc.wrappedKeys[0] }, privA)
    );
  });

  test('ciphertext/AES-GCM tampering fails authentication', async () => {
    const a = await engine.generateKeyPair();
    const [pubA, privA] = await Promise.all([
      engine.exportPublicKeyJwk(a.publicKey),
      engine.exportPrivateKeyJwk(a.privateKey),
    ]);
    const enc = await engine.encryptMessageFor('tamper me', [pubA]);
    const bytes = Uint8Array.from(atob(enc.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const tampered = btoa(String.fromCharCode(...bytes));
    await assert.rejects(() =>
      engine.decryptMessage({ ciphertext: tampered, iv: enc.iv, wrappedKey: enc.wrappedKeys[0] }, privA)
    );
  });

  test('file encryption/decryption roundtrip', async () => {
    const a = await engine.generateKeyPair();
    const b = await engine.generateKeyPair();
    const [pubA, privA, pubB, privB] = await Promise.all([
      engine.exportPublicKeyJwk(a.publicKey),
      engine.exportPrivateKeyJwk(a.privateKey),
      engine.exportPublicKeyJwk(b.publicKey),
      engine.exportPrivateKeyJwk(b.privateKey),
    ]);
    const payload = new TextEncoder().encode('file contents 1234567890');
    const enc = await engine.encryptFile(payload, [pubB, pubA]);
    assert.ok(enc.cipherBytes.length === payload.length + 16);
    const dec = await engine.decryptFile(enc.cipherBytes, { iv: enc.iv, wrappedKey: enc.wrappedKey }, privB);
    assert.equal(new TextDecoder().decode(dec), 'file contents 1234567890');
    void privA;
  });
});

describe('expiry calculation unit', () => {
  test('validateExpiry accepts valid time/read', () => {
    assert.ok(conversationStore.validateExpiry('time', 60).ok);
    assert.ok(conversationStore.validateExpiry('read', 1).ok);
    assert.ok(conversationStore.validateExpiry('time', 604800).ok);
  });
  test('validateExpiry rejects bad values', () => {
    assert.ok(!conversationStore.validateExpiry('forever', 10).ok);
    assert.ok(!conversationStore.validateExpiry('time', 0).ok);
    assert.ok(!conversationStore.validateExpiry('time', 604801).ok);
    assert.ok(!conversationStore.validateExpiry('time', 1.5).ok);
    assert.ok(!conversationStore.validateExpiry('time', 'abc').ok);
    assert.ok(!conversationStore.validateExpiry(undefined, 10).ok);
  });
  test('createMessage computes expires_at for time-based only', () => {
    const conv = { id: 'c1', user_one_id: 'u1', user_two_id: 'u2' };
    const payload = {
      ciphertext: Buffer.from(crypto.randomBytes(32)).toString('base64'),
      iv: Buffer.from('0123456789ab').toString('base64'),
      wrappedKey: Buffer.from('a').toString('base64'),
      senderWrappedKey: Buffer.from('b').toString('base64'),
    };
    const t = conversationStore.createMessage(conv, 'u1', { ...payload, expiryType: 'time', expiryDuration: 30 });
    assert.ok(t.expires_at && new Date(t.expires_at).getTime() - new Date(t.created_at).getTime() === 30000);
    const r = conversationStore.createMessage(conv, 'u1', { ...payload, expiryType: 'read', expiryDuration: 30 });
    assert.equal(r.expires_at, null);
    const n = conversationStore.createMessage(conv, 'u1', { ...payload });
    assert.equal(n.expires_at, null);
  });
});

describe('validators unit', () => {
  test('validateMessageBody accepts valid payload', () => {
    const { errors } = validateMessageBody({
      ciphertext: Buffer.from('x').toString('base64'),
      iv: Buffer.from('0123456789ab').toString('base64'),
      wrappedKey: Buffer.from('a').toString('base64'),
      senderWrappedKey: Buffer.from('b').toString('base64'),
    });
    assert.equal(errors.length, 0);
  });
  test('validateMessageBody rejects bad payloads', () => {
    assert.ok(validateMessageBody({}).errors.length > 0);
    assert.ok(validateMessageBody({ ciphertext: '%%%', iv: 'x', wrappedKey: 'y', senderWrappedKey: 'z' }).errors.length > 0);
    assert.ok(validateMessageBody({ ciphertext: 'A'.repeat(2_000_001), iv: 'x', wrappedKey: 'y', senderWrappedKey: 'z' }).errors.length > 0);
  });
  test('validateRegister enforces caps', () => {
    assert.ok(validateRegister({ name: 'x', email: 'a@b.com', password: '1234567' }).errors.length > 0);
    assert.ok(validateRegister({ name: 'x'.repeat(101), email: 'a@b.com', password: '12345678' }).errors.length > 0);
    assert.equal(validateRegister({ name: 'x', email: 'a@b.com', password: '12345678' }).errors.length, 0);
  });
  test('validateLogin basic', () => {
    assert.ok(validateLogin({ email: 'not-an-email', password: '' }).errors.length > 0);
    assert.equal(validateLogin({ email: 'a@b.com', password: 'x' }).errors.length, 0);
  });
});

describe('JWT unit', () => {
  const user = { sub: 'u1', role: 'admin', email: 'a@b.com' };
  test('sign/verify roundtrip + preauth blocked in verifyToken', () => {
    const good = jwt.sign(user, config.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });
    const payload = verifyToken(good);
    assert.equal(payload.sub, 'u1');
    const pre = jwt.sign({ ...user, preauth: true }, config.jwt.secret, { algorithm: 'HS256', expiresIn: '5m' });
    assert.equal(verifyToken(pre), null);
    assert.equal(verifyPreAuthToken(pre).sub, 'u1');
  });
  test('alg:none token rejected', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(user)}.`;
    assert.equal(verifyToken(token), null);
  });
  test('tampered signature / wrong secret / expired rejected', () => {
    const good = jwt.sign(user, config.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });
    const [h, p, s] = good.split('.');
    assert.equal(verifyToken(`${h}.${p}.${s.slice(0, -1)}x`), null);
    assert.equal(verifyToken(jwt.sign(user, 'wrong-secret', { algorithm: 'HS256' })), null);
    assert.equal(verifyToken(jwt.sign(user, config.jwt.secret, { algorithm: 'HS256', expiresIn: '-5s' })), null);
  });
});