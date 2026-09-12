import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import AppShell from '../layouts/AppShell'
import Avatar from '../components/Avatar'

const ICON_NEW = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
  </svg>
)

export default function NewConversationPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pendingId, setPendingId] = useState(null)

  async function search(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError('')
    setSearched(true)
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
    setPendingId(participantId)
    setError('')
    try {
      const data = await api.createConversation(participantId)
      navigate(`/messages?c=${data.conversation.id}`)
    } catch (err) {
      setError(err.message)
      setPendingId(null)
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-xl mx-auto pt-2 sm:pt-8">
          <div className="text-night-300 uppercase tracking-widest text-[11px] font-semibold mb-1">Messenger</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">New conversation</h1>
          <p className="text-sm text-night-300 mt-1">Find someone by name or email and start chatting securely.</p>

          <form onSubmit={search} className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name or email…"
                className="field pl-10!"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-night-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </span>
            </div>
            <button type="submit" disabled={busy || !query.trim()} className="btn-primary">
              {busy ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Search'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <ul className="mt-5 space-y-1.5">
            {results.map((u) => (
              <li key={u.id} className="animate-fade-up">
                <div className="flex items-center gap-3 rounded-2xl px-3 py-3 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors">
                  <Avatar name={u.name} size={42} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white truncate">{u.name}</div>
                    <div className="text-xs text-night-400 truncate">{u.email}</div>
                  </div>
                  <button
                    type="button"
                    disabled={pendingId === u.id}
                    onClick={() => start(u.id)}
                    className="h-9 px-3.5 rounded-xl bg-aurora-500/20 border border-aurora-500/30 text-aurora-300 hover:bg-aurora-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60"
                  >
                    {pendingId === u.id ? (
                      <span className="h-3.5 w-3.5 border-2 border-aurora-300/30 border-t-aurora-300 rounded-full animate-spin" />
                    ) : (
                      <>
                        {ICON_NEW} Message
                      </>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {searched && !busy && results.length === 0 && !error && (
            <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
              <div className="h-14 w-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-2xl mb-3">
                🔍
              </div>
              <div className="text-sm font-medium text-white">No users found</div>
              <div className="text-xs text-night-400 mt-1">Try a different name or email address.</div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}