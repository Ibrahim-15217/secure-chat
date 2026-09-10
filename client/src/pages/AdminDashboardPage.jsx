import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/useAuth'

const TABS = ['Users', 'Audit Log', 'Security', 'Stats']

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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">&#128274;</div>
          <h1 className="text-xl font-bold text-white">Access denied</h1>
          <p className="mt-2 text-sm text-slate-400">This area is restricted to administrators.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="max-w-5xl mx-auto px-6 py-10">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
          Admin
        </span>
        <h1 className="text-2xl font-bold text-white">Admin dashboard</h1>

        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === t ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">{error}</div>
        )}

        {tab === 'Stats' && stats && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Users', stats.users],
              ['Active users', stats.activeUsers],
              ['2FA enabled', stats.twoFaEnabled],
              ['Public keys', stats.withPublicKey],
              ['Conversations', stats.conversations],
              ['Messages', stats.messages],
              ['Files', stats.files],
              ['Failed logins (24h)', stats.failedLoginsLast24h],
              ['Audit events', stats.auditEvents],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
                <div className="text-2xl font-bold text-white mt-1">{value}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Users' && (
          <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-left text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">2FA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                )}
                {!loading &&
                  users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-white">{u.name}</td>
                      <td className="px-4 py-3 text-slate-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">{u.two_factor_enabled ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.status}
                          onChange={(e) => updateUser(u.id, { status: e.target.value })}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="banned">banned</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Audit Log' && (
          <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl overflow-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-left text-slate-400 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((e) => (
                  <tr key={e.id} className="border-t border-slate-800">
                    <td className="px-4 py-2 text-slate-400">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-300">{e.event_type}</td>
                    <td className="px-4 py-2 text-slate-300">{e.action}</td>
                    <td className={`px-4 py-2 ${e.success ? 'text-green-400' : 'text-red-400'}`}>
                      {e.success ? 'success' : 'failed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Security' && (
          <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl overflow-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-left text-slate-400 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">User</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-slate-800">
                    <td className="px-4 py-2 text-slate-400">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-300">{e.action}</td>
                    <td className={`px-4 py-2 ${e.success ? 'text-green-400' : 'text-red-400'}`}>
                      {e.success ? 'success' : 'failed'}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{e.detail?.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}