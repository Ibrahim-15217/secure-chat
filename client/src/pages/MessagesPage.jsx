import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useKeypair } from '../hooks/useKeypair'
import { api } from '../services/api'
import { connectSocket, getSocket } from '../services/socket'
import { decryptFile, decryptMessage, encryptFile, encryptMessageFor } from '../crypto/cryptoEngine'
import Avatar from '../components/Avatar'

function decryptWith(message, myId, privateKeyJwk) {
  const wrappedKey = message.sender_id === myId ? message.sender_key_reference : message.encrypted_key_reference
  return decryptMessage(
    { ciphertext: message.ciphertext, iv: message.nonce, wrappedKey },
    privateKeyJwk
  )
}

function isExpired(m, t) {
  if (m.expiry_type === 'time' && m.expires_at) return t >= new Date(m.expires_at).getTime()
  if (m.expiry_type === 'read' && m.read_at && m.expiry_duration) {
    return t >= new Date(m.read_at).getTime() + m.expiry_duration * 1000
  }
  return false
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function messageTime(iso) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function listTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return messageTime(iso)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatCountdown(s) {
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${s}s`
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TICK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)
const TICK_DOUBLE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 13l4 4L15 8" />
    <path d="M9 20l11-11" />
  </svg>
)
const ICON_SEND = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
  </svg>
)
const ICON_CLIP = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
)
const ICON_NEW = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
  </svg>
)
const ICON_BACK = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
)
const ICON_LOCK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)
const ICON_FILES = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h5" />
  </svg>
)
const ICON_DOWNLOAD = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
)
const ICON_TRASH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6l3 12a2 2 0 002 1.35h8A2 2 0 0018 18l3-12" />
    <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M19 6h-14" />
  </svg>
)
const ICON_TIMER = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M9 2h6" />
  </svg>
)
const ICON_SEARCH = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

export default function MessagesPage() {
  const { user, token } = useAuth()
  const { keypair, status: keyStatus } = useKeypair(user?.id)
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(searchParams.get('c'))
  const [messages, setMessages] = useState([])
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [typingUser, setTypingUser] = useState(false)
  const bottomRef = useRef(null)
  const typingSentRef = useRef(false)
  const typingTimerRef = useRef(null)
  const [expirySelect, setExpirySelect] = useState('')
  const [now, setNow] = useState(0)
  const [files, setFiles] = useState([])
  const [fileBusy, setFileBusy] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [showList, setShowList] = useState(!searchParams.get('c'))
  const [search, setSearch] = useState('')
  const [unread, setUnread] = useState({})
  const [lastTexts, setLastTexts] = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!error) return undefined
    const t = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(t)
  }, [error])

  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setMessages((ms) => ms.filter((m) => !isExpired(m, t)))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  function remainingSeconds(m, t) {
    if (m.expiry_type === 'time' && m.expires_at) {
      return Math.max(0, Math.ceil((new Date(m.expires_at).getTime() - t) / 1000))
    }
    if (m.expiry_type === 'read' && m.read_at && m.expiry_duration) {
      return Math.max(0, Math.ceil((new Date(m.read_at).getTime() + m.expiry_duration * 1000 - t) / 1000))
    }
    return null
  }

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  )

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? conversations.filter(
          (c) =>
            (c.other_participant?.name || '').toLowerCase().includes(q) ||
            (c.other_participant?.email || '').toLowerCase().includes(q)
        )
      : conversations
    return [...list].sort((a, b) => {
      const ta = a.last_message?.created_at || a.created_at || ''
      const tb = b.last_message?.created_at || b.created_at || ''
      return tb.localeCompare(ta)
    })
  }, [conversations, search])

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
    if (!selectedId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listFiles(selectedId)
        if (!cancelled) setFiles(data.files || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const refreshFiles = useCallback(async () => {
    if (!selectedId) return
    try {
      const data = await api.listFiles(selectedId)
      setFiles(data.files || [])
    } catch (err) {
      setError(err.message)
    }
  }, [selectedId])

  async function handleFileSelected(e) {
    const input = e.target
    const raw = input.files && input.files[0]
    input.value = ''
    if (!raw || !selected || !keypair) return
    setFileBusy(true)
    try {
      const bytesArrayBuffer = await raw.arrayBuffer()
      const bytes = new Uint8Array(bytesArrayBuffer)
      const recipientPub = await api.getPublicKey(selected.other_participant_id)
      const enc = await encryptFile(bytes, [recipientPub.publicKey, keypair.publicJwk])
      const meta = await api.createFileMeta({
        conversationId: selected.id,
        name: raw.name,
        mime: raw.type,
        size: enc.cipherBytes.length,
        iv: enc.iv,
        authTag: enc.authTag,
        wrappedKey: enc.wrappedKey,
        senderWrappedKey: enc.senderWrappedKey,
        accessWindowSeconds: 900,
      })
      await api.uploadCiphertext(meta.file.id, enc.cipherBytes)
      await refreshFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setFileBusy(false)
    }
  }

  async function downloadFile(file) {
    if (!keypair) return
    setFileBusy(true)
    try {
      const wrappedKey = file.sender_id === user.id ? file.sender_key_reference : file.encrypted_key_reference
      const { token } = await api.requestFileToken(file.id)
      const cipherBytes = new Uint8Array(await api.downloadFile(file.id, token))
      const plain = await decryptFile(cipherBytes, { iv: file.iv, wrappedKey }, keypair.privateJwk)
      const blob = new Blob([plain], { type: file.mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setFileBusy(false)
    }
  }

  async function removeFile(fileId) {
    try {
      await api.deleteFile(fileId)
      await refreshFiles()
    } catch (err) {
      setError(err.message)
    }
  }

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
        if (decrypted.length) {
          const lastOwn = [...decrypted].reverse().find((m) => m.sender_id === user.id)
          const lastIncoming = [...decrypted].reverse().find((m) => m.sender_id !== user.id)
          const tail = lastOwn || lastIncoming
          setLastTexts((l) => ({ ...l, [selectedId]: tail ? (tail.sender_id === user.id ? 'You: ' : '') + tail.text : '' }))
        }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

        const unreadMsgs = decrypted.filter((m) => m.recipient_id === user.id && !m.read_at)
        if (unreadMsgs.length) {
          setUnread((u) => ({ ...u, [selectedId]: 0 }))
        }
        unreadMsgs.forEach((m) => {
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
      if (!keypair) return false
      if (incoming.conversation_id === selectedId) {
        try {
          const text = await decryptWith(incoming, user.id, keypair.privateJwk)
          setMessages((ms) => (ms.some((m) => m.id === incoming.id) ? ms : [...ms, { ...incoming, text }]))
          setLastTexts((l) => ({ ...l, [incoming.conversation_id]: text }))
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          return true
        } catch {
          return false
        }
      }
      setLastTexts((l) => ({ ...l, [incoming.conversation_id]: 'Encrypted message' }))
      if (incoming.sender_id !== user.id) {
        setUnread((u) => ({ ...u, [incoming.conversation_id]: (u[incoming.conversation_id] || 0) + 1 }))
      }
      return false
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
          else refreshConversations()
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
    const onExpired = (data) => {
      if (data && data.messageId) {
        setMessages((ms) => ms.filter((m) => m.id !== data.messageId))
      }
    }
    socket.on('message:new', onNew)
    socket.on('message:read', onRead)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)
    socket.on('message:expired', onExpired)
    return () => {
      socket.off('message:new', onNew)
      socket.off('message:read', onRead)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
      socket.off('message:expired', onExpired)
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
      const messageBody = {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        wrappedKey: payload.wrappedKeys[0],
        senderWrappedKey: payload.wrappedKeys[1],
      }
      if (expirySelect) {
        const [et, ed] = expirySelect.split(':')
        messageBody.expiryType = et
        messageBody.expiryDuration = Number(ed)
      }
      if (getSocket() && getSocket().connected) {
        const sent = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 4000)
          getSocket().emit('message:send', { conversationId: selected.id, ...messageBody }, (resp) => {
            clearTimeout(timer)
            resolve(resp || {})
          })
        })
        if (!sent || !sent.ok) {
          setError((sent && sent.error) || 'Message could not be delivered in real time')
          return
        }
      } else {
        await api.sendMessage(selected.id, messageBody)
      }
      getSocket()?.emit('typing:stop', { conversationId: selected.id })
      typingSentRef.current = false
      setTypingUser(false)
      setDrafts((d) => ({ ...d, [selected.id]: '' }))
      setExpirySelect('')
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
      const tail = decrypted[decrypted.length - 1]
      setLastTexts((l) => ({ ...l, [selected.id]: tail ? (tail.sender_id === user.id ? 'You: ' : '') + tail.text : '' }))
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

  function selectConversation(id) {
    setSelectedId(id)
    setShowList(false)
    setUnread((u) => ({ ...u, [id]: 0 }))
    setTypingUser(false)
  }

  function backToList() {
    setShowList(true)
    setSearch('')
  }

  const groupedMessages = useMemo(() => {
    const groups = []
    messages.forEach((m, i) => {
      const prev = messages[i - 1]
      if (prev && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 90 * 1000) {
        groups[groups.length - 1].push(m)
      } else {
        groups.push([m])
      }
    })
    return groups
  }, [messages])

  const textareaRef = useRef(null)
  function growTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  return (
    <div className="h-full flex relative">
      {error && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 z-40 animate-fade-up">
          <div className="flex items-center gap-2 text-sm text-red-200 bg-red-500/15 backdrop-blur border border-red-500/30 rounded-xl px-4 py-2.5 shadow-xl shadow-red-500/10">
            <span className="text-red-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-300/70 hover:text-red-200 pl-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside
        className={`${
          showList ? 'flex' : 'hidden'
        } lg:flex flex-col w-full lg:w-[340px] shrink-0 border-r border-white/[0.06] bg-night-800/40`}
      >
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name} size={30} />
              <div>
                <div className="text-sm font-semibold text-white leading-tight">{user?.name}</div>
                <div className="text-[11px] text-night-300 flex items-center gap-1">
                  {ICON_LOCK} Private
                </div>
              </div>
            </div>
            <Link
              to="/messages/new"
              className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-night-200 hover:text-white hover:bg-aurora-500/20 hover:border-aurora-500/30 transition-all"
              title="Start a new conversation"
            >
              {ICON_NEW}
            </Link>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-night-400">{ICON_SEARCH}</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="field pl-9!"
            />
          </div>
        </div>

        <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-night-400">
          Messages {conversations.length > 0 && `· ${conversations.length}`}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filteredConversations.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-night-300">
              {conversations.length === 0 ? (
                <>
                  <div className="text-3xl mb-2">🔒</div>
                  No conversations yet.
                  <Link to="/messages/new" className="block mt-2 text-aurora-400 hover:text-aurora-300 font-medium">
                    Start one →
                  </Link>
                </>
              ) : (
                'No conversations match your search.'
              )}
            </div>
          )}
          <ul className="space-y-0.5">
            {filteredConversations.map((c) => {
              const active = c.id === selectedId
              const unreadCount = unread[c.id] || 0
              const preview = lastTexts[c.id] || (c.last_message ? 'Encrypted message' : 'No messages yet')
              const name = c.other_participant?.name || 'Unknown'
              const time = listTime(c.last_message?.created_at || c.created_at)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(c.id)}
                    className={`w-full text-left rounded-xl px-2.5 py-2.5 flex items-center gap-3 transition-colors group ${
                      active ? 'bg-aurora-500/[0.14] ring-1 ring-aurora-500/30' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="relative">
                      <Avatar name={name} size={44} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full aurora-bg text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-night-900">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-night-100'}`}>
                          {name}
                        </span>
                        <span className="text-[10px] text-night-400 shrink-0">{time}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-xs truncate ${active ? 'text-aurora-200' : 'text-night-300'}`}>
                          {preview}
                        </span>
                        {active && (
                          <span className="text-aurora-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {ICON_LOCK}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      {/* Chat pane */}
      <section className={`${selected && !showList ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0`}>
        {selected ? (
          <>
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-night-800/30 shrink-0">
              <button
                type="button"
                onClick={backToList}
                className="lg:hidden h-9 w-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-night-200 hover:text-white"
              >
                {ICON_BACK}
              </button>
              <Avatar name={selected.other_participant?.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {selected.other_participant?.name || 'Unknown'}
                </div>
                <div className="text-[11px] text-night-300 flex items-center gap-3 min-h-[16px]">
                  {typingUser ? (
                    <span className="flex items-center gap-1 text-aurora-400">
                      typing
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  ) : (
                    <>
                      <span className="truncate">{selected.other_participant?.email}</span>
                      <span className="flex items-center gap-1 shrink-0 text-emerald-400/80">
                        {ICON_LOCK} End-to-end encrypted
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFiles((v) => !v)}
                title="Shared files"
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
                  showFiles
                    ? 'bg-aurora-500/20 text-aurora-300 border border-aurora-500/30'
                    : 'bg-white/[0.06] text-night-200 hover:text-white'
                }`}
              >
                {ICON_FILES}
                {files.length > 0 && !showFiles && (
                  <span className="absolute translate-x-2.5 -translate-y-2.5 h-4 min-w-4 px-1 rounded-full aurora-bg text-white text-[9px] font-bold flex items-center justify-center" />
                )}
              </button>
            </header>

            {showFiles && (
              <div className="border-b border-white/[0.06] bg-night-800/40 px-4 py-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-night-300">
                    Shared files
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileBusy}
                    className="text-[11px] font-medium text-aurora-400 hover:text-aurora-300 disabled:opacity-50"
                  >
                    {fileBusy ? 'Working…' : '+ Add file'}
                  </button>
                </div>
                {files.length === 0 ? (
                  <div className="text-xs text-night-400 py-1">No files shared yet.</div>
                ) : (
                  <ul className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {files.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 bg-night-900/60 border border-white/[0.06] rounded-xl px-3 py-2">
                        <div className="h-9 w-9 rounded-lg bg-aurora-500/20 flex items-center justify-center text-aurora-300 shrink-0">
                          {ICON_FILES}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{f.name}</div>
                          <div className="text-[11px] text-night-400">
                            {formatBytes(f.size)} · expires {new Date(f.expires_at).toLocaleTimeString()}
                          </div>
                        </div>
                        {f.status === 'ready' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={fileBusy}
                              onClick={() => downloadFile(f)}
                              className="h-8 w-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-night-200 hover:text-white disabled:opacity-50"
                              title="Download & decrypt"
                            >
                              {ICON_DOWNLOAD}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFile(f.id)}
                              className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-night-400 hover:text-red-400"
                              title="Delete file"
                            >
                              {ICON_TRASH}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-400 pulse-soft shrink-0">encrypting…</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex justify-center mb-4">
                  <span className="text-[10px] font-medium uppercase tracking-wider bg-white/[0.05] border border-white/[0.06] text-night-300 px-3 py-1 rounded-full">
                    Messages are end-to-end encrypted
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="relative mb-5">
                      <div className="h-20 w-20 rounded-full aurora-bg opacity-30 blur-xl glow-orb" />
                      <div className="absolute inset-0 flex items-center justify-center text-3xl">💬</div>
                    </div>
                    <div className="text-night-100 font-medium">No messages yet</div>
                    <div className="text-sm text-night-400 mt-1">
                      Say hello to {selected.other_participant?.name} — it's fully encrypted.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groupedMessages.map((group) => {
                      const first = group[0]
                      const mine = first.sender_id === user.id
                      const prev = messages[messages.indexOf(first) - 1]
                      const next = messages[messages.indexOf(group[group.length - 1]) + 1]
                      const showDayDivider = !prev || dayLabel(prev.created_at) !== dayLabel(first.created_at)
                      const showAvatar = !mine && (!next || next.sender_id !== first.sender_id)
                      return (
                        <div key={`grp-${first.id}`} className="space-y-1">
                          {showDayDivider && (
                            <div className="flex justify-center py-2">
                              <span className="text-[10px] font-medium uppercase tracking-wider bg-white/[0.05] border border-white/[0.06] text-night-300 px-3 py-1 rounded-full">
                                {dayLabel(first.created_at)}
                              </span>
                            </div>
                          )}
                          {group.map((m, mi) => {
                            const isLastInGroup = mi === group.length - 1
                            const secs = remainingSeconds(m, now)
                            return (
                              <div key={m.id} className={`flex items-end gap-2 animate-fade-up ${mine ? 'justify-end' : 'justify-start'}`}>
                                {!mine && (
                                  <div className="w-7 shrink-0 pb-0.5">
                                    {showAvatar && <Avatar name={selected.other_participant?.name} size={28} />}
                                  </div>
                                )}
                                <div className={`group relative max-w-[72%] sm:max-w-[62%] ${mine ? 'items-end' : 'items-start'}`}>
                                  <button
                                    type="button"
                                    onClick={() => removeMessage(m.id)}
                                    title="Delete message"
                                    className={`absolute -top-3 ${
                                      mine ? 'right-1' : 'left-1'
                                    } h-6 w-6 rounded-full bg-night-700 border border-white/[0.1] flex items-center justify-center text-night-300 opacity-0 group-hover:opacity-100 shadow-lg transition-opacity z-10 hover:text-red-400`}
                                  >
                                    {ICON_TRASH}
                                  </button>
                                  <div
                                    className={`px-3.5 py-2 ${mine ? 'bubble-mine' : 'bubble-other'} ${
                                      isLastInGroup ? '' : mine ? 'rounded-br-md' : 'rounded-bl-md'
                                    }`}
                                  >
                                    <div className="text-[13.5px] leading-relaxed break-words whitespace-pre-wrap">{m.text}</div>
                                    <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${mine ? 'text-white/75 justify-end' : 'text-night-400 justify-start'}`}>
                                      <span>{messageTime(m.created_at)}</span>
                                      {secs !== null && (
                                        <span className="flex items-center gap-0.5 font-medium text-amber-300">
                                          {ICON_TIMER} {formatCountdown(secs)}
                                        </span>
                                      )}
                                      {mine && (
                                        <span className={m.read_at ? 'text-cyan-300' : 'text-amber-300'}>
                                          {m.read_at ? TICK_DOUBLE : TICK}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Composer */}
            <form onSubmit={sendMessage} className="border-t border-white/[0.06] bg-night-800/30 px-3 sm:px-4 py-3 shrink-0">
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileBusy}
                    title="Share an encrypted file"
                    className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-night-300 hover:text-white hover:border-aurora-500/40 transition-all disabled:opacity-50"
                  >
                    {ICON_CLIP}
                  </button>
                  <div className="relative hidden sm:block">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-night-400 pointer-events-none">
                      {ICON_TIMER}
                    </span>
                    <select
                      value={expirySelect}
                      onChange={(e) => setExpirySelect(e.target.value)}
                      title="Self-destruct timing"
                      className={`h-10 pl-8 pr-2 rounded-xl text-xs font-medium border appearance-none cursor-pointer transition-colors ${
                        expirySelect
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-white/[0.06] text-night-300 border-white/[0.08] hover:text-white'
                      }`}
                    >
                      <option value="">No timer</option>
                      <option>───────────</option>
                      <option value="time:10">Land 10 sec</option>
                      <option value="time:30">Land 30 sec</option>
                      <option value="time:60">Land 1 min</option>
                      <option value="time:300">Land 5 min</option>
                      <option>───────────</option>
                      <option value="read:10">After read · 10s</option>
                      <option value="read:30">After read · 30s</option>
                      <option value="read:60">After read · 1m</option>
                      <option value="read:300">After read · 5m</option>
                    </select>
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={drafts[selected.id] || ''}
                  onChange={(e) => {
                    setDrafts((d) => ({ ...d, [selected.id]: e.target.value }))
                    emitTyping(selected.id)
                    growTextarea()
                  }}
                  onBlur={() => stopTyping(selected.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(e)
                    }
                  }}
                  placeholder="Type a message…"
                  className="field flex-1 min-h-[42px] max-h-[140px] resize-none"
                />

                <button
                  type="submit"
                  disabled={busy || keyStatus !== 'ready' || !(drafts[selected.id] || '').trim()}
                  title="Send"
                  className="h-10 w-10 rounded-xl btn-primary p-0! shrink-0 shadow-none!"
                >
                  {busy ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    ICON_SEND
                  )}
                </button>
              </div>

              <div className="max-w-3xl mx-auto mt-1.5 hidden sm:flex items-center justify-between px-1">
                {expirySelect ? (
                  <span className="text-[10px] text-amber-300/90 flex items-center gap-1">
                    {ICON_TIMER} This message will self-destruct after the selected duration
                  </span>
                ) : (
                  <span className="text-[10px] text-night-400">
                    {ICON_LOCK} Encrypted locally before sending · Enter to send
                  </span>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="relative mb-6">
              <div className="h-28 w-28 rounded-full aurora-bg opacity-25 blur-2xl glow-orb" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-2xl aurora-bg flex items-center justify-center text-white text-2xl shadow-2xl shadow-aurora-500/40">
                  💬
                </div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Your private messenger</h2>
            <p className="text-sm text-night-300 mt-1.5 max-w-sm">
              Select a conversation or start a new one. Every message is encrypted on your device before it leaves.
            </p>
            <Link to="/messages/new" className="btn-primary mt-6">
              {ICON_NEW} New conversation
            </Link>
          </div>
        )}
      </section>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
    </div>
  )
}