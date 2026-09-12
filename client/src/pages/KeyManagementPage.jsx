import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useKeypair } from '../hooks/useKeypair'
import { decryptMessage, encryptMessage } from '../crypto/cryptoEngine'
import AppShell from '../layouts/AppShell'

const ICON_KEY = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
)
const ICON_SHIELD = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />
  </svg>
)
const ICON_REFRESH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
)

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
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-aurora-400 mb-1">
            Cryptographic foundation
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Key management</h1>
          <p className="mt-1.5 text-sm text-night-300">
            Your RSA-OAEP key pair is generated entirely in the browser. The private key never leaves this device; only
            the public key is registered with the server.
          </p>

          {error && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Keypair status */}
          <div className="card mt-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-aurora-500/20 flex items-center justify-center text-aurora-300 shrink-0">
                  {ICON_KEY}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">RSA key pair</div>
                  <div className="text-xs text-night-300 mt-1">
                    {status === 'loading' && (
                      <span className="flex items-center gap-2 text-night-300">
                        <span className="h-3 w-3 border-2 border-aurora-400/30 border-t-aurora-400 rounded-full animate-spin" />
                        Generating bitcaster key locally…
                      </span>
                    )}
                    {status === 'ready' && (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {keypair?.registered
                          ? 'Public key registered with the server'
                          : 'Generated locally — will register on next sync'}
                        {keypair?.registerError && <span className="text-red-400"> ({keypair.registerError})</span>}
                      </span>
                    )}
                    {status === 'error' && 'Load failed'}
                  </div>
                </div>
              </div>
              {status === 'ready' && (
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => reload()} className="btn-ghost px-2.5 py-1.5 text-xs">
                    Re-sync
                  </button>
                  <button type="button" onClick={() => regenerate()} className="btn-ghost px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                    Regenerate
                  </button>
                </div>
              )}
            </div>

            {status === 'ready' && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="text-[11px] text-night-400 mb-1.5">Public key (JWK, truncated)</div>
                <code className="text-[11px] font-mono bg-night-900/80 border border-white/[0.06] px-3 py-2 rounded-lg inline-block break-all text-night-200">
                  {publicKeyPreview}
                </code>
              </div>
            )}
          </div>

          {/* Encrypt / decrypt self test */}
          <div className="card mt-4 p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 shrink-0">
                {ICON_SHIELD}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Encrypt / decrypt self-test</div>
                <div className="text-xs text-night-400">
                  AES-256-GCM payload, session key wrapped with your RSA-OAEP public key.
                </div>
              </div>
            </div>

            <form onSubmit={runSelfTest} className="mt-4 space-y-3">
              <textarea
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                placeholder="Type a secret message…"
                rows={3}
                className="field resize-none"
              />
              <button
                type="submit"
                disabled={busy || status !== 'ready' || !plaintext}
                className="btn-primary"
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Encrypting…
                  </span>
                ) : (
                  'Encrypt & decrypt'
                )}
              </button>
            </form>

            {cryptoError && (
              <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {cryptoError}
              </div>
            )}

            {encResult && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-night-900/70 border border-white/[0.06] rounded-xl p-3">
                  <div className="text-night-400 mb-1">Ciphertext</div>
                  <code className="break-all text-night-200">{encResult.ciphertext.slice(0, 32)}…</code>
                </div>
                <div className="bg-night-900/70 border border-white/[0.06] rounded-xl p-3">
                  <div className="text-night-400 mb-1">Wrapped key</div>
                  <code className="break-all text-night-200">{encResult.wrappedKey.slice(0, 32)}…</code>
                </div>
                <div className="bg-night-900/70 border border-emerald-500/20 rounded-xl p-3">
                  <div className="text-night-400 mb-1">Decrypted</div>
                  <code className="text-emerald-300 break-all">{decrypted || '…'}</code>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 text-xs text-night-400">
            {ICON_REFRESH}
            <span>
              <span className="text-amber-300/90 font-medium">Warning:</span> regenerating your key pair invalidates all
              references to the previous public key. Existing messages can no longer be decrypted on this device unless
              you kept the old private key.
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  )
}