const B64_RE = /^[A-Za-z0-9+/=]+$/;

const MAX_CIPHERTEXT_LEN = 2_000_000;
const MAX_IV_LEN = 100;
const MAX_WRAPPED_KEY_LEN = 12_000;

function validateMessageBody(body) {
  const errors = [];
  const { ciphertext, iv, wrappedKey, senderWrappedKey, expiryType, expiryDuration } = body || {};

  if (!ciphertext || typeof ciphertext !== 'string' || ciphertext.length > MAX_CIPHERTEXT_LEN) {
    errors.push('ciphertext is required and must be <= 2MB');
  } else if (!B64_RE.test(ciphertext)) {
    errors.push('ciphertext must be base64 encoded');
  }
  if (!iv || typeof iv !== 'string' || iv.length > MAX_IV_LEN || !B64_RE.test(iv)) {
    errors.push('iv is required and must be short base64');
  }
  if (!wrappedKey || typeof wrappedKey !== 'string' || wrappedKey.length > MAX_WRAPPED_KEY_LEN || !B64_RE.test(wrappedKey)) {
    errors.push('wrappedKey is required and must be base64');
  }
  if (!senderWrappedKey || typeof senderWrappedKey !== 'string' || senderWrappedKey.length > MAX_WRAPPED_KEY_LEN || !B64_RE.test(senderWrappedKey)) {
    errors.push('senderWrappedKey is required and must be base64');
  }

  return { errors, value: { ciphertext, iv, wrappedKey, senderWrappedKey, expiryType, expiryDuration } };
}

module.exports = { validateMessageBody, MAX_CIPHERTEXT_LEN };