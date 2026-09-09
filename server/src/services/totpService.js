const crypto = require('crypto');
const { generateSecret, generateSync, verifySync } = require('otplib');

const OPTIONS = { digits: 6, period: 30 };

function generateSecretForUser() {
  return generateSecret();
}

function buildOtpAuthUrl(secret, email) {
  const label = encodeURIComponent(`SecureChat:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: 'SecureChat',
    digits: String(OPTIONS.digits),
    period: String(OPTIONS.period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function generateSetupSecret(email) {
  const secret = generateSecretForUser();
  const otpUrl = buildOtpAuthUrl(secret, email || 'user@securechat.local');
  return { secret, otpUrl };
}

function generateCode(secret) {
  return generateSync({ secret, ...OPTIONS });
}

function verifyCode(secret, code) {
  if (!secret || !code) return false;
  try {
    const result = verifySync({ secret, token: String(code).trim(), ...OPTIONS });
    return result && result.valid === true;
  } catch (err) {
    return false;
  }
}

function makeBackupCodes(count = 5) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

module.exports = { generateSetupSecret, generateCode, verifyCode, makeBackupCodes, buildOtpAuthUrl };