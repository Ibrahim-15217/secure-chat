const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('securechat_token')
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed with status ${res.status}`)
  }

  return res.json()
}

export const api = {
  getHealth: () => request('/health'),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  verify2fa: (payload) => request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify(payload) }),
  setup2fa: () => request('/auth/setup-2fa', { method: 'POST' }),
  enable2fa: (code) => request('/auth/enable-2fa', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2fa: (code) => request('/auth/disable-2fa', { method: 'POST', body: JSON.stringify({ code }) }),
  me: () => request('/auth/me'),
  adminUsers: () => request('/admin/users'),
  setPublicKey: (publicJwk) =>
    request('/crypto/public-key', { method: 'POST', body: JSON.stringify({ publicKey: publicJwk }) }),
  getPublicKey: (userId) => request(`/crypto/public-key/${userId}`),
  getMyPublicKey: () => request('/crypto/my-public-key'),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  createConversation: (participantId) =>
    request('/conversations', { method: 'POST', body: JSON.stringify({ participantId }) }),
  listConversations: () => request('/conversations'),
  getConversation: (id) => request(`/conversations/${id}`),
  listMessages: (conversationId) => request(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, payload) =>
    request(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
  markRead: (messageId) => request(`/messages/${messageId}/read`, { method: 'POST' }),
  deleteMessage: (messageId) => request(`/messages/${messageId}`, { method: 'DELETE' }),
}