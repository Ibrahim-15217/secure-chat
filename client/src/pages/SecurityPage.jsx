import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../services/api'
import { useAuth } from '../context/useAuth'
import AppShell from '../layouts/AppShell'

const ICON_SHIELD = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />
  </svg>
)
const ICON_KEY = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M21 2l-9.6 9.6" />
    <path d="M15.5 7.5l3 3L22 7l-3-3" />
  </svg>
)

export default function SecurityPage() {
  const { user, setUser } = useAuth()
  const [setup, setSetup] = useState(null)
  const [enableCode, setEnableCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const twoFactorEnabled = user?.two_factor_enabled

  function handleSetup() {
    setError('')
    setMessage('')
    setBusy(true)
    api
      .setup2fa()
      .then(setSetup)
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false))
  }

  function handleEnable(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    api
      .enable2fa(enableCode)
      .then(({ user: updated }) => {
        setUser(updated)
        setSetup(null)
        setEnableCode('')
        setMessage('Two-factor authentication enabled.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false))
  }

  function handleDisable(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    api
      .disable2fa(disableCode)
      .then(({ user: updated }) => {
        setUser(updated)
        setDisableCode('')
        setMessage('Two-factor authentication disabled.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false))
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-aurora-400 mb-1">Security settings</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Two-factor authentication</h1>
          <p className="mt-1.5 text-sm text-night-300">
            Add an extra layer of protection using an authenticator application such as Google Authenticator or Aegis.
          </p>

          {error && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              {message}
            </div>
          )}

          {!twoFactorEnabled && !setup && (
            <div className="card mt-5 p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-300 shrink-0">
                    {ICON_SHIELD}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Status: Disabled</div>
                    <div className="text-xs text-night-400 mt-1">
                      Your account is only protected by a password right now.
                    </div>
                  </div>
                </div>
                <button type="button" onClick={handleSetup} disabled={busy} className="btn-primary">
                  {busy ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Set up 2FA'
                  )}
                </button>
              </div>
            </div>
          )}

          {twoFactorEnabled && (
            <div className="card mt-5">
              <div className="flex items-start gap-3 p-5">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 shrink-0">
                  {ICON_SHIELD}
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-soft" />
                    Status: Enabled
                  </div>
                  <div className="text-xs text-night-400 mt-1">
                    Your account requires a verification code at sign-in.
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-night-400">
                    {ICON_KEY} Authenticator app
                  </div>
                  <form onSubmit={handleDisable} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter current code to disable"
                      className="field flex-1 text-center tracking-[0.3em] font-mono"
                    />
                    <button
                      type="submit"
                      disabled={busy || disableCode.length !== 6}
                      className="btn-ghost text-red-300 hover:bg-red-500/10 shrink-0"
                    >
                      {busy ? 'Disabling…' : 'Disable'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {setup && (
            <div className="card mt-5 p-5">
              <div className="text-sm font-semibold text-white">Scan the QR code</div>
              <p className="text-xs text-night-400 mt-1 mb-4">
                Open your authenticator app and scan, or enter the secret manually. Then confirm by entering the generated code below.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="bg-white rounded-2xl p-3 shadow-lg shrink-0">
                  <QRCodeSVG value={setup.otpUrl} size={176} />
                </div>
                <div className="flex-1 w-full">
                  <div className="text-[11px] text-night-400 mb-1">Manual entry secret</div>
                  <code className="text-xs font-mono bg-night-900/80 border border-white/[0.06] px-3 py-2 rounded-lg inline-block break-all text-night-200">
                    {setup.secret}
                  </code>
                  <form onSubmit={handleEnable} className="mt-4 space-y-3">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={enableCode}
                      onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit code"
                      className="field text-center tracking-[0.3em] font-mono"
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busy || enableCode.length !== 6} className="btn-primary">
                        {busy ? 'Confirming…' : 'Confirm & enable'}
                      </button>
                      <button type="button" onClick={() => setSetup(null)} className="btn-ghost">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}