import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'

export default function NewConversationPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function search(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError('')
    try {
      const data = await api.searchUsers(q)
      setResults(data.users)
      if (data.users.length === 0) setError('No users found')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function start(participantId) {
    setBusy(true)
    setError('')
    try {
      const data = await api.createConversation(participantId)
      navigate(`/messages?c=${data.conversation.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">New conversation</h1>
          <Link to="/messages" className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
            Back to messages
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={search} className="flex gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-slate-400 bg-slate-900 border border-slate-700 rounded-lg p-3">{error}</div>
        )}

        <ul className="mt-6 divide-y divide-slate-800 bg-slate-900 border border-slate-700 rounded-xl">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="font-medium text-sm text-white">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <button
                type="button"
                onClick={() => start(u.id)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white text-xs"
              >
                Message
              </button>
            </li>
          ))}
          {!busy && query && results.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-500">No users found.</li>
          )}
        </ul>
      </main>
    </div>
  )
}