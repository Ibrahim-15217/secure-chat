import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../services/api'
import { useAuth } from '../context/useAuth'

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="max-w-2xl mx-auto px-6 py-10">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
          Security Settings
        </span>
        <h1 className="text-2xl font-bold text-white">Two-factor authentication</h1>
        <p className="mt-2 text-sm text-slate-400">
          Add an extra layer of protection using an authenticator application such as Google Authenticator or Aegis.
        </p>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">{error}</div>
        )}
        {message && (
          <div className="mt-4 text-sm text-green-400 bg-green-950/50 border border-green-800 rounded-lg p-3">{message}</div>
        )}

        {!twoFactorEnabled && !setup && (
          <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">Status: Disabled</div>
                <div className="text-xs text-slate-400 mt-1">2FA is not enabled on your account.</div>
              </div>
              <button
                type="button"
                onClick={handleSetup}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? 'Generating...' : 'Set up 2FA'}
              </button>
            </div>
          </div>
        )}

        {twoFactorEnabled && (
          <div className="mt-6 space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <div className="font-medium text-green-400">Status: Enabled</div>
              <div className="text-xs text-slate-400 mt-1">
                Your account requires a verification code at sign-in.
              </div>
              <form onSubmit={handleDisable} className="mt-4 space-y-3">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current code to disable"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  disabled={busy || disableCode.length !== 6}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {busy ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </form>
            </div>
          </div>
        )}

        {setup && (
          <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="font-medium text-white mb-1">Scan the QR code</div>
            <p className="text-xs text-slate-400 mb-4">
              Open your authenticator app and scan, or enter the secret manually. Then confirm by entering the generated code below.
            </p>
            <div className="bg-white rounded-lg p-4 inline-block mb-4">
              <QRCodeSVG value={setup.otpUrl} size={180} />
            </div>
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-1">Manual entry secret</div>
              <code className="text-sm font-mono bg-slate-800 px-3 py-2 rounded-lg inline-block break-all">
                {setup.secret}
              </code>
            </div>
            <form onSubmit={handleEnable} className="space-y-3">
              <input
                type="text"
                required
                maxLength={6}
                value={enableCode}
                onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy || enableCode.length !== 6}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {busy ? 'Confirming...' : 'Confirm & enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setSetup(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}