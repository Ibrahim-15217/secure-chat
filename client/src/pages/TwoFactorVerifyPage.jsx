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
      .then(() => navigate('/dashboard'))
      .catch((err) => setError(err.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <AuthLayout title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Verification code</label>
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
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="w-full px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          Back to sign in
        </button>
      </form>
    </AuthLayout>
  )
}