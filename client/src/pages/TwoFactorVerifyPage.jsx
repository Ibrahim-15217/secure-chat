import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import AuthLayout from '../layouts/AuthLayout'

export default function TwoFactorVerifyPage() {
  const { verify2fa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pendingToken = location.state?.pendingToken
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!pendingToken) return <Navigate to="/login" replace />

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    verify2fa(pendingToken, code)
      .then(() => navigate('/messages'))
      .catch((err) => setError(err.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <AuthLayout title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-night-200 mb-1.5">Verification code</label>
          <input
            type="text"
            required
            autoFocus
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="field text-center text-xl tracking-[0.4em] font-mono"
          />
          <div className="flex justify-center gap-1.5 mt-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i < code.length ? 'bg-aurora-400' : 'bg-night-600'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting || code.length !== 6} className="btn-primary w-full">
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying...
            </span>
          ) : (
            'Verify'
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full text-center text-sm text-night-400 hover:text-night-200 transition-colors"
        >
          Back to sign in
        </button>
      </form>
    </AuthLayout>
  )
}
