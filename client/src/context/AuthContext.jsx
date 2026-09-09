import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { AuthContext } from './authContextInstance'

const TOKEN_KEY = 'securechat_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api
      .me()
      .then(({ user: me }) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const login = useCallback(async (credentials) => {
    const { user: authedUser, token: newToken } = await api.login(credentials)
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(authedUser)
    return authedUser
  }, [])

  const register = useCallback(async (payload) => {
    const { user: newUser, token: newToken } = await api.register(payload)
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}