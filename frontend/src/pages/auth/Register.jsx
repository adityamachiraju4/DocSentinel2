// ─────────────────────────────────────────
// DocSentinel v2 — Register Page
// PhRedSec™ | Register.jsx
// ─────────────────────────────────────────
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed.')
      navigate('/login?registered=1')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem',
    padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid rgba(26,26,24,0.15)',
    background: '#fff', color: '#1A1A18', outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <>
      <Helmet>
        <title>Create account — DocSentinel</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex' }}>
        {/* Left panel */}
        <div style={{
          flex: '0 0 42%', background: '#1A1A18', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '2.5rem 3rem',
        }} className="register-left-panel">
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
            {/* Plan highlight */}
            <div style={{ background: 'rgba(82,183,136,0.12)', border: '1px solid rgba(82,183,136,0.25)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.75rem' }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52B788', marginBottom: 6 }}>Free plan included</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.5rem', color: '#FAFAF7', marginBottom: 4 }}>₹0 / month</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#AEAEA8' }}>25 documents per month, forever. No credit card required.</div>
            </div>
            {[
              '✓  Smart Vault with AES-256-GCM encryption',
              '✓  AI-powered document extraction',
              '✓  GST & GSTIN auto-detection',
              '✓  Upgrade anytime — pay in INR via Razorpay',
            ].map((item, i) => (
              <div key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.87rem', color: '#AEAEA8', marginBottom: 10, lineHeight: 1.4 }}>{item}</div>
            ))}
          </div>

          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#6B6B64' }}>
            © {new Date().getFullYear()} PhRedSec™ Private Limited
          </p>
        </div>

        {/* Right panel — form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem,5vw,4rem)' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(1.8rem,3vw,2.4rem)', color: '#1A1A18', letterSpacing: '-0.025em', marginBottom: 8 }}>
              Create your account
            </h1>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '0.95rem', marginBottom: '2rem' }}>
              Free forever. No credit card required.
            </p>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: '1.25rem', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#1A1A18', display: 'block', marginBottom: 6 }}>Full name</label>
                <input
                  type="text" name="name" value={form.name} onChange={handleChange}
                  required placeholder="Priya Sharma"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#2D6A4F'}
                  onBlur={e => e.target.style.borderColor = 'rgba(26,26,24,0.15)'}
                />
              </div>

              <div>
                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#1A1A18', display: 'block', marginBottom: 6 }}>Email address</label>
                <input
                  type="email" name="email" value={form.email} onChange={handleChange}
                  required placeholder="you@company.com"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#2D6A4F'}
                  onBlur={e => e.target.style.borderColor = 'rgba(26,26,24,0.15)'}
                />
              </div>

              <div>
                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#1A1A18', display: 'block', marginBottom: 6 }}>Password</label>
                <input
                  type="password" name="password" value={form.password} onChange={handleChange}
                  required placeholder="Min. 8 characters"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#2D6A4F'}
                  onBlur={e => e.target.style.borderColor = 'rgba(26,26,24,0.15)'}
                />
              </div>

              <div>
                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#1A1A18', display: 'block', marginBottom: 6 }}>Confirm password</label>
                <input
                  type="password" name="confirm" value={form.confirm} onChange={handleChange}
                  required placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#2D6A4F'}
                  onBlur={e => e.target.style.borderColor = 'rgba(26,26,24,0.15)'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '1rem',
                  background: loading ? '#6B6B64' : '#2D6A4F', color: '#FAFAF7',
                  border: 'none', borderRadius: 10, padding: '13px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s', marginTop: 4,
                }}
                onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.85' }}
                onMouseLeave={e => e.target.style.opacity = '1'}
              >
                {loading ? 'Creating account…' : 'Create free account'}
              </button>

              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#AEAEA8', textAlign: 'center', lineHeight: 1.5 }}>
                By creating an account you agree to our{' '}
                <Link to="/terms" style={{ color: '#6B6B64', textDecoration: 'underline' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" style={{ color: '#6B6B64', textDecoration: 'underline' }}>Privacy Policy</Link>.
              </p>
            </form>

            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#6B6B64', textAlign: 'center', marginTop: '1.5rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#2D6A4F', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .register-left-panel { display: none !important; }
        }
      `}</style>
    </>
  )
}
