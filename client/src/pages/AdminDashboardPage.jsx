import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/useAuth'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .adminUsers()
      .then(({ users: list }) => {
        if (!cancelled) setUsers(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">&#128274;</div>
          <h1 className="text-xl font-bold text-white">Access denied</h1>
          <p className="mt-2 text-sm text-slate-400">
            This area is restricted to administrators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="max-w-4xl mx-auto px-6 py-10">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
          Admin
        </span>
        <h1 className="text-2xl font-bold text-white">User management</h1>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">{error}</div>
        )}

        <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-white">{u.name}</td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{u.role}</td>
                    <td className="px-4 py-3">{u.two_factor_enabled ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 capitalize text-green-400">{u.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}