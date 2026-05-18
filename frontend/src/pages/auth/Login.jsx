// ─────────────────────────────────────────
// DocSentinel v2 — Login Page
// PhRedSec™ | Login.jsx
// ─────────────────────────────────────────
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth.jsx'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid email or password.')
      login(data.user, data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Sign in — DocSentinel</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex' }}>
        <div style={{
          flex: '0 0 42%', background: '#1A1A18', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '2.5rem 3rem',
        }} className="login-left-panel">
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#2D6A4F', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 3h10v2H4zM4 7h10v2H4zM4 11h6v2H4z" fill="#FAFAF7"/>
                <circle cx="13" cy="13" r="3" fill="#52B788"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.15rem', color: '#FAFAF7', letterSpacing: '-0.02em' }}>DocSentinel</span>
          </Link>

          <div>
            <p style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', color: '#FAFAF7', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
              "Your documents,<br />finally intelligent."
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: '🗄️', text: 'Smart Vault — encrypted, searchable storage' },
                { icon: '🧾', text: 'GST & invoice data extracted automatically' },
                { icon: '📋', text: 'Contracts analysed for risks and renewals' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#AEAEA8', lineHeight: 1.4 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#6B6B64' }}>
            © {new Date().getFullYear()} PhRedSec™ Private Limited
          </p>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem,5vw,4rem)' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(1.8rem,3vw,2.4rem)', color: '#1A1A18', letterSpacing: '-0.025em', marginBottom: 8 }}>
              Welcome back
            </h1>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '0.95rem', marginBottom: '2rem' }}>
              Sign in to your DocSentinel account.
            </p>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: '1.25rem', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#1A1A18', display: 'block', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  type="email" name="email" value={form.email} onChange={handleChange}
                  required placeholder="you@company.com"
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(26,26,24,0.15)', background: '#fff', color: '#1A1A18', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#2D6A4F'}
                  onBlur={e => e.target.style.borderColor = 'rgba(26,26,24,0.15)'}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#1A1A18' }}>Password</label>
                  <a href="#" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem', color: '#2D6A4F', textDecoration: 'none' }}>Forgot password?</a>
                </div>
                <input
                  type="password" name="password" value={form.password} onChange={handleChange}
                  required placeholder="••••••••"
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(26,26,24,0.15)', background: '#fff', color: '#1A1A18', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#2D6A4F'}
                  onBlur={e => e.target.style.borderColor = 'rgba(26,26,24,0.15)'}
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '1rem', background: loading ? '#6B6B64' : '#1A1A18', color: '#FAFAF7', border: 'none', borderRadius: 10, padding: '13px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', marginTop: 4 }}
                onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.85' }}
                onMouseLeave={e => e.target.style.opacity = '1'}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#6B6B64', textAlign: 'center', marginTop: '1.75rem' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#2D6A4F', fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
        }
      `}</style>
    </>
  )
}
