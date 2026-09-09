import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-cyan-600 flex items-center justify-center font-bold text-white">
              SC
            </div>
            <span className="font-semibold text-white">Secure Chat</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/messages"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                Messages
              </Link>
              <Link
                to="/keys"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                Keys
              </Link>
              <Link
                to="/security"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                Security
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  Admin
                </Link>
              )}
            </nav>
            <div className="text-right">
              <div className="text-sm font-medium text-white">{user?.name}</div>
              <div className="text-xs text-slate-400">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
          Phase 2 - Authentication
        </div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-slate-400 text-sm">
          Authentication and session handling are working. Conversations,
          encryption, and messaging arrive in later phases.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-500 text-xs">Account</div>
            <div className="mt-1 font-medium text-white">{user?.name}</div>
            <div className="text-xs text-slate-400">{user?.email}</div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-500 text-xs">Role</div>
            <div className="mt-1 font-medium text-white capitalize">{user?.role}</div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-500 text-xs">Security</div>
            <div className="mt-1 font-medium text-white">
              2FA: {user?.two_factor_enabled ? 'Enabled' : 'Not set up'}
            </div>
            <div className="text-xs text-slate-400 capitalize">{user?.status}</div>
          </div>
        </div>
      </main>
    </div>
  )
}