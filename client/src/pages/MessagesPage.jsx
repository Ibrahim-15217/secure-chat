import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useKeypair } from '../hooks/useKeypair'
import { api } from '../services/api'
import { connectSocket, getSocket } from '../services/socket'
import { decryptMessage, encryptMessageFor } from '../crypto/cryptoEngine'

function decryptWith(message, myId, privateKeyJwk) {
  const wrappedKey = message.sender_id === myId ? message.sender_key_reference : message.encrypted_key_reference
  return decryptMessage(
    { ciphertext: message.ciphertext, iv: message.nonce, wrappedKey },
    privateKeyJwk
  )
}

export default function MessagesPage() {
  const { user, token } = useAuth()
  const { keypair } = useKeypair(user?.id)
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(searchParams.get('c'))
  const [messages, setMessages] = useState([])
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const bottomRef = useRef(null)
  const typingSentRef = useRef(false)
  const typingTimerRef = useRef(null)

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  )

  const refreshConversations = useCallback(async () => {
    try {
      const data = await api.listConversations()
      setConversations(data.conversations)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listConversations()
        if (cancelled) return
        setConversations(data.conversations)
        if (data.conversations.length && !selectedId) setSelectedId(data.conversations[0].id)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, selectedId])

  useEffect(() => {
    if (!selectedId || !keypair) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listMessages(selectedId)
        if (cancelled) return
        const decrypted = await Promise.all(
          data.messages.map(async (m) => {
            try {
              const text = await decryptWith(m, user.id, keypair.privateJwk)
              return { ...m, text }
            } catch {
              return { ...m, text: '[Unable to decrypt]' }
            }
          })
        )
        setMessages(decrypted)
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

        const unread = decrypted.filter((m) => m.recipient_id === user.id && !m.read_at)
        unread.forEach((m) => {
          api
            .markRead(m.id)
            .then(() => getSocket()?.emit('message:read', { messageId: m.id }))
            .catch(() => {})
        })
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, keypair, user])

  const appendDecrypted = useCallback(
    async (incoming) => {
      if (!keypair || !selectedId || incoming.conversation_id !== selectedId) return false
      try {
        const text = await decryptWith(incoming, user.id, keypair.privateJwk)
        setMessages((ms) => (ms.some((m) => m.id === incoming.id) ? ms : [...ms, { ...incoming, text }]))
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        return true
      } catch {
        return false
      }
    },
    [keypair, selectedId, user]
  )

  useEffect(() => {
    if (!token) return undefined
    const socket = connectSocket(token)
    const onNew = (data) => {
      if (data && data.message) {
        appendDecrypted(data.message).then((shown) => {
          if (shown) refreshConversations()
        })
      }
    }
    const onRead = (data) => {
      if (!data) return
      setMessages((ms) => ms.map((m) => (m.id === data.messageId ? { ...m, read_at: data.readAt } : m)))
    }
    const onTypingStart = (data) => {
      if (data && data.conversationId === selectedId) setTypingUser(true)
    }
    const onTypingStop = (data) => {
      if (data && data.conversationId === selectedId) setTypingUser(false)
    }
    socket.on('message:new', onNew)
    socket.on('message:read', onRead)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)
    return () => {
      socket.off('message:new', onNew)
      socket.off('message:read', onRead)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
    }
  }, [token, selectedId, appendDecrypted, refreshConversations, user])

  useEffect(() => {
    if (!token || !selectedId) return undefined
    const socket = connectSocket(token)
    socket.emit('conversation:join', { conversationId: selectedId })
    return () => {
      socket.emit('conversation:leave', { conversationId: selectedId })
    }
  }, [token, selectedId])

  async function sendMessage(e) {
    e.preventDefault()
    if (!selected || !keypair) return
    const text = (drafts[selected.id] || '').trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      const recipientPub = await api.getPublicKey(selected.other_participant_id)
      const payload = await encryptMessageFor(text, [recipientPub.publicKey, keypair.publicJwk])
      await api.sendMessage(selected.id, {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        wrappedKey: payload.wrappedKeys[0],
        senderWrappedKey: payload.wrappedKeys[1],
      })
      getSocket()?.emit('typing:stop', { conversationId: selected.id })
      typingSentRef.current = false
      setTypingUser(false)
      setDrafts((d) => ({ ...d, [selected.id]: '' }))
      const data = await api.listMessages(selected.id)
      const decrypted = await Promise.all(
        data.messages.map(async (m) => {
          try {
            const t = await decryptWith(m, user.id, keypair.privateJwk)
            return { ...m, text: t }
          } catch {
            return { ...m, text: '[Unable to decrypt]' }
          }
        })
      )
      setMessages(decrypted)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      refreshConversations()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeMessage(messageId) {
    try {
      await api.deleteMessage(messageId)
      setMessages((ms) => ms.filter((m) => m.id !== messageId))
    } catch (err) {
      setError(err.message)
    }
  }

  function emitTyping(conversationId) {
    if (!getSocket() || !conversationId) return
    if (!typingSentRef.current) {
      typingSentRef.current = true
      getSocket().emit('typing:start', { conversationId })
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      typingSentRef.current = false
      getSocket().emit('typing:stop', { conversationId })
    }, 1200)
  }

  function stopTyping(conversationId) {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = null
    if (typingSentRef.current) {
      typingSentRef.current = false
      getSocket()?.emit('typing:stop', { conversationId })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Messages</h1>
          <div className="flex items-center gap-3">
            <Link to="/messages/new" className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm">
              New conversation
            </Link>
            <Link to="/dashboard" className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg p-3">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Conversation list */}
          <aside className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Conversations
            </div>
            {conversations.length === 0 && (
              <div className="p-4 text-sm text-slate-500">
                No conversations yet.{' '}
                <Link to="/messages/new" className="text-cyan-400">
                  Start one
                </Link>
                .
              </div>
            )}
            <ul className="divide-y divide-slate-800">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-800 ${selectedId === c.id ? 'bg-slate-800' : ''}`}
                  >
                    <div className="font-medium text-sm text-white">{c.other_participant?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {c.last_message ? (c.last_message.sender_id === user.id ? 'You: ' : '') + '[encrypted]' : 'No messages yet'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Chat pane */}
          <section className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col min-h-[480px]">
            {selected ? (
              <>
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="font-medium text-white">{selected.other_participant?.name}</div>
                  <div className="text-xs text-slate-500">
                    {typingUser ? (
                      <span className="text-cyan-400">typing...</span>
                    ) : (
                      selected.other_participant?.email
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[420px]">
                  {messages.length === 0 && (
                    <div className="text-sm text-slate-500 mt-8 text-center">No messages yet. Send the first one.</div>
                  )}
                  {messages.map((m) => {
                    const mine = m.sender_id === user.id
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                            mine ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-100'
                          }`}
                        >
                          <div className="break-words whitespace-pre-wrap">{m.text}</div>
                          <div className="mt-1 text-[11px] opacity-70">
                            {m.read_at ? 'read' : m.recipient_id === user.id && !m.read_at ? 'sent' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMessage(m.id)}
                          className="ml-2 self-center text-xs text-slate-600 hover:text-red-400"
                          title="Delete message"
                        >
                          x
                        </button>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={sendMessage} className="border-t border-slate-800 p-4 flex gap-3">
                  <input
                    value={drafts[selected.id] || ''}
                    onChange={(e) => {
                      setDrafts((d) => ({ ...d, [selected.id]: e.target.value }))
                      emitTyping(selected.id)
                    }}
                    onBlur={() => stopTyping(selected.id)}
                    placeholder="Type a message... (encrypted before sending)"
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {busy ? 'Encrypting...' : 'Send'}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                Select a conversation to start chatting.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}