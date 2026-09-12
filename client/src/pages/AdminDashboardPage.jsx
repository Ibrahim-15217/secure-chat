import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/useAuth'
import AppShell from '../layouts/AppShell'

const TABS = ['Users', 'Audit Log', 'Security', 'Stats']

const ICON_USERS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
)

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Users')
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [userList, logList, evtList, statsData] = await Promise.all([
          api.adminUsers(),
          api.adminAuditLogs({ limit: 200 }),
          api.adminSecurityEvents(),
          api.adminStats(),
        ])
        if (cancelled) return
        setUsers(userList.users)
        setLogs(logList.logs)
        setEvents(evtList.events)
        setStats(statsData.stats)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function updateUser(id, patch) {
    try {
      const { user: updated } = await api.adminUpdateUser(id, patch)
      setUsers((list) => list.map((u) => (u.id === id ? updated : u)))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-aurora-500/15 border border-aurora-500/25 flex items-center justify-center text-aurora-300 text-2xl mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Access denied</h1>
          <p className="mt-2 text-sm text-night-300">This area is restricted to administrators.</p>
        </div>
      </div>
    )
  }

  const statCards = [
    ['Users', stats.users],
    ['Active users', stats.activeUsers],
    ['2FA enabled', stats.twoFaEnabled],
    ['Public keys', stats.withPublicKey],
    ['Conversations', stats.conversations],
    ['Messages', stats.messages],
    ['Files', stats.files],
    ['Failed logins (24h)', stats.failedLoginsLast24h],
    ['Audit events', stats.auditEvents],
  ]

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-aurora-500/20 text-aurora-300 flex items-center justify-center shrink-0">
              {ICON_USERS}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-aurora-400">Operations</div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin console</h1>
            </div>
          </div>

          <div className="mt-4 flex gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-aurora-500/20 text-aurora-300 border border-aurora-500/30'
                    : 'bg-white/[0.04] text-night-300 border border-transparent hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {tab === 'Stats' && stats && (
            <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {statCards.map(([label, value]) => (
                <div key={label} className="card p-4">
                  <div className="text-[11px] text-night-400 uppercase tracking-wide">{label}</div>
                  <div className="text-2xl font-bold text-white mt-1">{value}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Users' && (
            <div className="card mt-5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-left text-night-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">2FA</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-night-400">
                          Loading users…
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      users.map((u) => (
                        <tr key={u.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                          <td className="px-4 py-3 text-night-300">{u.email}</td>
                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onChange={(e) => updateUser(u.id, { role: e.target.value })}
                              className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-night-100 focus:outline-none focus:border-aurora-400"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {u.two_factor_enabled ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Yes
                              </span>
                            ) : (
                              <span className="text-night-400 text-xs">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={u.status}
                              onChange={(e) => updateUser(u.id, { status: e.target.value })}
                              className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-night-100 focus:outline-none focus:border-aurora-400"
                            >
                              <option value="active">active</option>
                              <option value="suspended">suspended</option>
                              <option value="banned">banned</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-night-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Audit Log' && (
            <div className="card mt-5 overflow-hidden">
              <div className="overflow-auto max-h-[540px]">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-left text-night-400 text-[11px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((e) => (
                      <tr key={e.id} className="border-t border-white/[0.05]">
                        <td className="px-4 py-2 text-night-400 whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-night-200">{e.event_type}</td>
                        <td className="px-4 py-2 text-night-200">{e.action}</td>
                        <td className={`px-4 py-2 ${e.success ? 'text-emerald-400' : 'text-red-400'}`}>
                          {e.success ? 'success' : 'failed'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Security' && (
            <div className="card mt-5 overflow-hidden">
              <div className="overflow-auto max-h-[540px]">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-left text-night-400 text-[11px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Result</th>
                      <th className="px-4 py-3">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-white/[0.05]">
                        <td className="px-4 py-2 text-night-400 whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-night-200">{e.action}</td>
                        <td className={`px-4 py-2 ${e.success ? 'text-emerald-400' : 'text-red-400'}`}>
                          {e.success ? 'success' : 'failed'}
                        </td>
                        <td className="px-4 py-2 text-night-400">{e.detail?.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Stats' && !stats && !error && (
            <div className="mt-5 text-sm text-night-400">{loading ? 'Loading statistics…' : 'No statistics available.'}</div>
          )}
        </div>
      </div>
    </AppShell>
  )
}