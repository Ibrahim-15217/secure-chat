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
    const result = await api.login(credentials)
    if (result.requiresTwoFactor) {
      return { requiresTwoFactor: true, pendingToken: result.pendingToken }
    }
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
    return { requiresTwoFactor: false, user: result.user }
  }, [])

  const verify2fa = useCallback(async (pendingToken, code) => {
    const { user: verifiedUser, token: newToken } = await api.verify2fa({ pendingToken, code })
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(verifiedUser)
    return verifiedUser
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
    <AuthContext.Provider
      value={{ user, setUser, token, loading, login, verify2fa, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}