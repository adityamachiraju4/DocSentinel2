// ─────────────────────────────────────────
// DocSentinel v2 — Auth Hook
// PhRedSec™ | hooks/useAuth.jsx
// ─────────────────────────────────────────
import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Prevents parallel 401s from firing N simultaneous /refresh calls.
  // The first one refreshes; the rest await the same promise.
  const refreshPromise = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const login = (userData, accessToken, refreshToken) => {
    localStorage.setItem('token', accessToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const clearSession = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const logout = useCallback(async () => {
    // Best-effort server-side revocation; clear locally regardless.
    const token = localStorage.getItem('token')
    if (token) {
      try {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch { /* network failure shouldn't block local logout */ }
    }
    clearSession()
  }, [clearSession])

  // Single-flight refresh: returns the new access token, or null on failure.
  const doRefresh = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) return null

    refreshPromise.current = (async () => {
      try {
        const res = await fetch(`${API}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        if (!res.ok) return null
        const data = await res.json()
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        return data.access_token
      } catch {
        return null
      } finally {
        refreshPromise.current = null
      }
    })()

    return refreshPromise.current
  }, [])

  // Central authenticated fetch. Attaches the access token; on 401, refreshes
  // once and retries. If refresh fails, clears session and bounces to login.
  const authFetch = useCallback(async (path, options = {}) => {
    const url = path.startsWith('http') ? path : `${API}${path}`

    const withAuth = (token) => {
      const headers = { ...(options.headers || {}) }
      if (token) headers.Authorization = `Bearer ${token}`
      return { ...options, headers }
    }

    let token = localStorage.getItem('token')
    let res = await fetch(url, withAuth(token))

    if (res.status !== 401) return res

    // Access token likely expired — try a single refresh + retry.
    const newToken = await doRefresh()
    if (!newToken) {
      clearSession()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return res
    }

    return fetch(url, withAuth(newToken))
  }, [doRefresh, clearSession])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
