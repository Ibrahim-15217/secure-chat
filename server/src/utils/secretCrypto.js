const crypto = require('crypto');
const config = require('../config');

const ALGO = 'aes-256-gcm';

function deriveKey() {
  const raw = process.env.TOTP_ENCRYPTION_KEY || `${config.jwt.secret}:totp`;
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

function decrypt(stored) {
  const [ivHex, dataHex, tagHex] = String(stored).split(':');
  if (!ivHex || !dataHex || !tagHex) return null;
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };