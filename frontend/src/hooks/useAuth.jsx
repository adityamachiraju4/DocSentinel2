// ─────────────────────────────────────────
// DocSentinel v2 — Auth Hook
// PhRedSec™ | hooks/useAuth.jsx
// ─────────────────────────────────────────
import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const AuthContext = createContext(null)

// Marks which backing store holds the active session.
// Set to 'session' when the user logs in on a public/shared device.
const MODE_KEY = 'auth_mode'

// Returns the storage object for the active session.
// Public/shared device → sessionStorage (cleared on tab close, no refresh token).
// Private device (default) → localStorage (persistent, refresh token kept).
function sessionStore() {
  return localStorage.getItem(MODE_KEY) === 'session' ? sessionStorage : localStorage
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Prevents parallel 401s from firing N simultaneous /refresh calls.
  // The first one refreshes; the rest await the same promise.
  const refreshPromise = useRef(null)
  const sensitiveGrant = useRef(null)

  useEffect(() => {
    const store = sessionStore()
    const token = store.getItem('token')
    const userData = store.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  // publicDevice=true → session-only: use sessionStorage, drop the refresh token.
  const login = (userData, accessToken, refreshToken, publicDevice = false) => {
    // Record the mode flag in localStorage so it survives even when the
    // session itself lives in sessionStorage, and so sessionStore() can read it.
    if (publicDevice) {
      localStorage.setItem(MODE_KEY, 'session')
    } else {
      localStorage.removeItem(MODE_KEY)
    }

    const store = sessionStore()
    store.setItem('token', accessToken)
    store.setItem('user', JSON.stringify(userData))
    // No refresh token on public/shared devices — session expires with the access token.
    if (refreshToken && !publicDevice) store.setItem('refresh_token', refreshToken)

    setUser(userData)
  }

  const clearSession = useCallback(() => {
    // Clear from both stores regardless of mode, then drop the mode flag.
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem('token')
      store.removeItem('refresh_token')
      store.removeItem('user')
    }
    localStorage.removeItem(MODE_KEY)
    sensitiveGrant.current = null
    setUser(null)
  }, [])

  const logout = useCallback(async () => {
    // Best-effort server-side revocation; clear locally regardless.
    const token = sessionStore().getItem('token')
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
  // Public/shared sessions have no refresh token, so this returns null and the
  // session is allowed to expire.
  const doRefresh = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current

    const store = sessionStore()
    const refreshToken = store.getItem('refresh_token')
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
        store.setItem('token', data.access_token)
        store.setItem('refresh_token', data.refresh_token)
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
      if (sensitiveGrant.current) headers['X-Sensitive-Grant'] = sensitiveGrant.current
      return { ...options, headers }
    }

    let token = sessionStore().getItem('token')
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

  const sensitiveReauth = useCallback(async (password) => {
    const res = await authFetch('/api/auth/sensitive/reauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) return false
    const data = await res.json()
    sensitiveGrant.current = data.sensitive_grant
    return true
  }, [authFetch])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authFetch, sensitiveReauth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
