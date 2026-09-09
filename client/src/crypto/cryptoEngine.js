const RSAParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

const AesKeyParams = { name: 'AES-GCM', length: 256 }

function base64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes) {
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin)
}

export async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(RSAParams, true, ['encrypt', 'decrypt'])
  return { publicKey: pair.publicKey, privateKey: pair.privateKey }
}

export async function exportPublicKeyJwk(publicKey) {
  return crypto.subtle.exportKey('jwk', publicKey)
}

export async function exportPrivateKeyJwk(privateKey) {
  return crypto.subtle.exportKey('jwk', privateKey)
}

export async function importPublicKeyJwk(jwk) {
  return crypto.subtle.importKey('jwk', jwk, RSAParams, false, ['encrypt'])
}

export async function importPrivateKeyJwk(jwk) {
  return crypto.subtle.importKey('jwk', jwk, RSAParams, false, ['decrypt'])
}

export async function encryptMessage(plaintext, recipientPublicJwk) {
  const publicKey = await importPublicKeyJwk(recipientPublicJwk)

  const aesKey = await crypto.subtle.generateKey(AesKeyParams, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded)

  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    await crypto.subtle.exportKey('raw', aesKey)
  )

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
  }
}

export async function decryptMessage(payload, privateKeyJwk) {
  const privateKey = await importPrivateKeyJwk(privateKeyJwk)
  const aesKeyRaw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToBytes(payload.wrappedKey)
  )
  const aesKey = await crypto.subtle.importKey('raw', aesKeyRaw, AesKeyParams, false, ['decrypt'])

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    aesKey,
    base64ToBytes(payload.ciphertext)
  )
  return new TextDecoder().decode(decrypted)
}

export async function verifyPayloadIsEncrypted(payload) {
  return (
    payload &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.wrappedKey === 'string' &&
    payload.ciphertext.length > 0
  )
}