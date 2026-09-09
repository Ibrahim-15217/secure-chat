import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useKeypair } from '../hooks/useKeypair'
import { decryptMessage, encryptMessage } from '../crypto/cryptoEngine'

export default function KeyManagementPage() {
  const { user } = useAuth()
  const { keypair, status, error, regenerate, reload } = useKeypair(user?.id)

  const [plaintext, setPlaintext] = useState('')
  const [encResult, setEncResult] = useState(null)
  const [decrypted, setDecrypted] = useState('')
  const [cryptoError, setCryptoError] = useState('')
  const [busy, setBusy] = useState(false)

  const publicKeyPreview = keypair?.publicJwk
    ? `${keypair.publicJwk.n.slice(0, 40)}...`
    : ''

  async function runSelfTest(e) {
    e.preventDefault()
    setCryptoError('')
    setDecrypted('')
    setBusy(true)
    try {
      const payload = await encryptMessage(plaintext, keypair.publicJwk)
      setEncResult(payload)
      const text = await decryptMessage(payload, keypair.privateJwk)
      setDecrypted(text)
    } catch (err) {
      setCryptoError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="max-w-2xl mx-auto px-6 py-10">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
          Phase 4 - Cryptographic Foundation
        </span>
        <h1 className="text-2xl font-bold text-white">Key Management</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your RSA-OAEP key pair is generated in the browser. The private key never leaves this device;
          only the public key is registered with the server.
        </p>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">{error}</div>
        )}

        {/* Keypair status */}
        <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">RSA key pair</div>
              <div className="text-xs text-slate-400 mt-1">
                {status === 'loading' && 'Generating / loading...'}
                {status === 'ready' && (
                  <>
                    Public key registered: {keypair?.registered ? 'Yes' : 'No'}
                    {keypair?.registerError && <span className="text-red-400"> ({keypair.registerError})</span>}
                  </>
                )}
                {status === 'error' && 'Load failed'}
              </div>
            </div>
            <div className="flex gap-2">
              {status === 'ready' && (
                <>
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => reload()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                  >
                    Re-sync
                  </button>
                </>
              )}
            </div>
          </div>

          {status === 'ready' && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-1">Public key (JWK, truncated)</div>
              <code className="text-xs font-mono bg-slate-800 px-3 py-2 rounded-lg inline-block break-all">
                {publicKeyPreview}
              </code>
            </div>
          )}
        </div>

        {/* Encrypt/decrypt self test */}
        <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="font-medium text-white mb-1">Encrypt / Decrypt self-test</div>
          <p className="text-xs text-slate-400 mb-4">
            AES-256-GCM payload, session key wrapped with RSA-OAEP public key. Verify round-trip works.
          </p>

          <form onSubmit={runSelfTest} className="space-y-3">
            <textarea
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              placeholder="Type a secret message..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={busy || status !== 'ready' || !plaintext}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Encrypting...' : 'Encrypt & decrypt'}
            </button>
          </form>

          {cryptoError && (
            <div className="mt-4 text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">
              {cryptoError}
            </div>
          )}

          {encResult && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-slate-500 mb-1">Ciphertext</div>
                <code className="break-all">{encResult.ciphertext.slice(0, 32)}...</code>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-slate-500 mb-1">Wrapped key</div>
                <code className="break-all">{encResult.wrappedKey.slice(0, 32)}...</code>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-slate-500 mb-1">Decrypted</div>
                <code className="text-green-400">{decrypted || '...'}</code>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}