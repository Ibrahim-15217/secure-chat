import { useHealth } from './hooks/useHealth'
import './index.css'

function App() {
  const { status, data, check } = useHealth()

  const statusColor = {
    checking: 'text-yellow-500',
    loading: 'text-yellow-500',
    ok: 'text-green-500',
    error: 'text-red-500',
  }[status]

  const statusLabel = {
    checking: 'Checking backend...',
    loading: 'Checking backend...',
    ok: 'Backend connected',
    error: 'Backend unreachable',
  }[status]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
            Phase 1 - Project Foundation
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Secure Chat
          </h1>
          <p className="mt-2 text-slate-400">
            End-to-end encrypted messaging with self-destructing messages.
          </p>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor} animate-pulse`} />
              <span className="text-sm font-medium">{statusLabel}</span>
            </div>
            <button
              type="button"
              onClick={check}
              disabled={status === 'loading'}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50"
            >
              Re-check
            </button>
          </div>

          {status === 'ok' && data && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs">Status</div>
                <div className="text-green-400 font-mono">{data.status}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs">Uptime (s)</div>
                <div className="font-mono">{Math.round(data.uptime)}</div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4 text-sm text-red-400">
              Could not reach the backend. Ensure the server is running
              (<code className="font-mono">npm run dev</code> in{' '}
              <code className="font-mono">server/</code>).
            </div>
          )}
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Foundations: React + Vite + Tailwind frontend · Node + Express backend
          · Health-check connectivity verified.
        </p>
      </div>
    </div>
  )
}

export default App
