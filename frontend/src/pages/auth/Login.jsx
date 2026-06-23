// ─────────────────────────────────────────
// DocSentinel v2 — Login Page
// PhRedSec™ | Login.jsx
// ─────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth.jsx'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const T = {
  bg: { base: '#07080A', panel: '#0B0C0F', card: '#0F1014' },
  border: { hairline: 'rgba(255,255,255,0.07)', strong: 'rgba(255,255,255,0.14)' },
  text: { primary: '#F5F6F7', secondary: '#BDC1C8', muted: '#858992', faint: '#5B5F66' },
  accent: { violet: '#7C5CFF', bright: '#9B82FF' },
  semantic: { success: '#3FB950', error: '#F85149' },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
}

const EXTRACT_FIELDS = [
  { key: 'VENDOR', value: 'Clicktech Retail Pvt Ltd' },
  { key: 'GSTIN', value: '29AABCT1332L1ZT' },
  { key: 'INVOICE NO', value: 'INV-2026-00471' },
  { key: 'HSN', value: '8471 · 9403' },
  { key: 'TOTAL', value: '₹9,55,729.00' },
]

const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function ExtractRow({ field, active, done, last }) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!active && !done) { setTyped(''); return }
    if (done && !active) { setTyped(field.value); return }
    if (REDUCE) { setTyped(field.value); return }
    setTyped('')
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(field.value.slice(0, i))
      if (i >= field.value.length) clearInterval(id)
    }, 38)
    return () => clearInterval(id)
  }, [active, done, field.value])

  const filled = active || done
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${T.border.hairline}` }}>
      <span style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.faint, letterSpacing: '0.1em' }}>{field.key}</span>
      <span style={{
        fontFamily: T.font.mono, fontSize: 12, fontWeight: 500,
        color: filled ? T.text.primary : T.text.faint,
        background: filled ? 'transparent' : 'rgba(255,255,255,0.03)',
        borderRadius: 4, padding: filled ? 0 : '2px 8px', textAlign: 'right',
        minWidth: filled ? 0 : 90, transition: 'color 0.2s, background 0.2s',
      }}>
        {filled ? (
          <>
            {typed}
            {active && typed.length < field.value.length && <span className="ds-caret">▋</span>}
          </>
        ) : '— — —'}
      </span>
    </div>
  )
}

function ExtractionDemo() {
  const [active, setActive] = useState(-1)
  const [doneTo, setDoneTo] = useState(-1)
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    if (REDUCE) { setDoneTo(EXTRACT_FIELDS.length - 1); setScanning(false); return }
    let idx = 0
    let timer
    const step = () => {
      if (idx >= EXTRACT_FIELDS.length) {
        setActive(-1); setScanning(false)
        timer = setTimeout(() => { setDoneTo(-1); idx = 0; setScanning(true); step() }, 2000)
        return
      }
      setActive(idx)
      const dwell = 38 * EXTRACT_FIELDS[idx].value.length + 520
      timer = setTimeout(() => {
        setDoneTo(idx); idx += 1; step()
      }, dwell)
    }
    step()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ position: 'relative', border: `1px solid ${T.border.hairline}`, borderRadius: 12, background: T.bg.card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: `1px solid ${T.border.hairline}` }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ marginLeft: 8, fontFamily: T.font.mono, fontSize: 10, color: T.text.faint, letterSpacing: '0.08em' }}>extracting · invoice.pdf</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: scanning ? T.accent.bright : T.semantic.success, boxShadow: scanning ? `0 0 8px ${T.accent.bright}` : 'none' }} />
          <span style={{ fontFamily: T.font.mono, fontSize: 10, color: scanning ? T.accent.bright : T.semantic.success }}>{scanning ? 'READING' : 'DONE'}</span>
        </span>
      </div>

      <div style={{ position: 'relative', padding: '18px 16px', minHeight: 220 }}>
        {scanning && <div className="ds-scan" style={{ position: 'absolute', left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.accent.violet}, transparent)`, boxShadow: `0 0 12px ${T.accent.violet}` }} />}
        {EXTRACT_FIELDS.map((f, i) => (
          <ExtractRow key={f.key} field={f} active={active === i} done={i <= doneTo} last={i === EXTRACT_FIELDS.length - 1} />
        ))}
      </div>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [publicDevice, setPublicDevice] = useState(false)

  // 2FA two-call flow state
  const [stage, setStage] = useState('password')   // 'password' | 'totp'
  const [pendingToken, setPendingToken] = useState('')
  const [code, setCode] = useState('')
  const codeRef = useRef(null)

  useEffect(() => {
    if (stage === 'totp' && codeRef.current) codeRef.current.focus()
  }, [stage])

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError('') }

  const finishLogin = (data) => {
    login(data.user, data.access_token, data.refresh_token, publicDevice)
    navigate('/dashboard')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid email or password.')

      // 2FA-enabled account: no access token yet, switch to code entry.
      if (data.totp_required) {
        setPendingToken(data.pending_token)
        setStage('totp')
        return
      }

      finishLogin(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/auth/login/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_token: pendingToken, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid code.')
      finishLogin(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const backToPassword = () => {
    setStage('password'); setCode(''); setPendingToken(''); setError('')
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', fontFamily: T.font.sans, fontSize: '0.92rem',
    padding: '12px 14px', borderRadius: 8, border: `1px solid ${T.border.strong}`,
    background: T.bg.panel, color: T.text.primary, outline: 'none', transition: 'border-color 0.18s, box-shadow 0.18s',
  }
  const labelStyle = { fontFamily: T.font.mono, fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.text.muted, display: 'block', marginBottom: 8 }
  const focusOn = e => { e.target.style.borderColor = T.accent.violet; e.target.style.boxShadow = '0 0 0 3px rgba(124,92,255,0.12)' }
  const focusOff = e => { e.target.style.borderColor = T.border.strong; e.target.style.boxShadow = 'none' }

  return (
    <>
      <Helmet>
        <title>Sign in — DocSentinel</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="ds-auth" style={{ minHeight: '100vh', background: T.bg.base, display: 'grid', gridTemplateColumns: '1.1fr 1fr' }}>
        {/* Left */}
        <div className="ds-auth-left" style={{ background: T.bg.panel, borderRight: `1px solid ${T.border.hairline}`, padding: '2.75rem 3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border.hairline} 1px, transparent 1px), linear-gradient(90deg, ${T.border.hairline} 1px, transparent 1px)`, backgroundSize: '44px 44px', opacity: 0.35, maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle at 30% 20%, black, transparent 75%)' }} />

          <div className="ds-rise ds-rise-1" style={{ position: 'relative', zIndex: 1 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, background: T.accent.violet, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(124,92,255,0.5)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontFamily: T.font.mono, fontWeight: 'bold', fontSize: '0.95rem', color: T.text.primary, letterSpacing: '0.14em' }}>DOCSENTINEL</span>
            </Link>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="ds-rise ds-rise-2">
              <span style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.accent.bright, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Live extraction</span>
              <h2 style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: 'clamp(1.3rem, 2vw, 1.7rem)', color: T.text.primary, lineHeight: 1.25, letterSpacing: '-0.02em', margin: '10px 0 22px 0', maxWidth: 360 }}>
                Paper goes in. Structured data comes out.
              </h2>
            </div>
            <div className="ds-rise ds-rise-3"><ExtractionDemo /></div>
          </div>

          <p className="ds-rise ds-rise-4" style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.text.faint, letterSpacing: '0.05em', position: 'relative', zIndex: 1 }}>
            © {new Date().getFullYear()} PHREDSEC™ PRIVATE LIMITED
          </p>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem,5vw,4rem)' }}>
          <div className="ds-rise ds-rise-2" style={{ width: '100%', maxWidth: 380 }}>

            {stage === 'password' ? (
              <>
                <span style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.text.faint, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Authentication</span>
                <h1 style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 'clamp(1.7rem,3vw,2.1rem)', color: T.text.primary, letterSpacing: '-0.03em', margin: '0 0 8px 0' }}>Welcome back</h1>
                <p style={{ fontFamily: T.font.sans, color: T.text.secondary, fontSize: '0.9rem', marginBottom: '2rem' }}>Sign in to your DocSentinel account.</p>

                {error && (
                  <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.30)', borderRadius: 8, padding: '12px 16px', marginBottom: '1.25rem', fontFamily: T.font.mono, fontSize: '0.8rem', color: T.semantic.error }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Email address</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@company.com"
                      style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                      <a href="#" style={{ fontFamily: T.font.mono, fontSize: '0.7rem', color: T.accent.bright, textDecoration: 'none' }}>Forgot?</a>
                    </div>
                    <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="••••••••"
                      style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={publicDevice}
                      onChange={e => { setPublicDevice(e.target.checked); setError('') }}
                      style={{ width: 16, height: 16, marginTop: 1, accentColor: T.accent.violet, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontFamily: T.font.sans, fontSize: '0.82rem', color: T.text.secondary, lineHeight: 1.4 }}>
                      This is a public or shared device
                      <span style={{ display: 'block', fontFamily: T.font.mono, fontSize: '0.68rem', color: T.text.faint, marginTop: 2 }}>
                        Don't keep me signed in — session ends when the tab closes.
                      </span>
                    </span>
                  </label>

                  <button type="submit" disabled={loading} className="ds-submit"
                    style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: '0.95rem', background: loading ? T.bg.panel : T.accent.violet, color: loading ? T.text.muted : '#FFF', border: loading ? `1px solid ${T.border.strong}` : 'none', borderRadius: 8, padding: '13px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'transform 0.12s, box-shadow 0.18s', marginTop: 4 }}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>

                <p style={{ fontFamily: T.font.sans, fontSize: '0.85rem', color: T.text.secondary, textAlign: 'center', marginTop: '1.75rem' }}>
                  Don't have an account?{' '}
                  <Link to="/register" style={{ color: T.accent.bright, fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
                </p>
              </>
            ) : (
              <>
                <span style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.text.faint, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Two-factor</span>
                <h1 style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 'clamp(1.7rem,3vw,2.1rem)', color: T.text.primary, letterSpacing: '-0.03em', margin: '0 0 8px 0' }}>Enter your code</h1>
                <p style={{ fontFamily: T.font.sans, color: T.text.secondary, fontSize: '0.9rem', marginBottom: '2rem' }}>Open your authenticator app and enter the 6-digit code.</p>

                {error && (
                  <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.30)', borderRadius: 8, padding: '12px 16px', marginBottom: '1.25rem', fontFamily: T.font.mono, fontSize: '0.8rem', color: T.semantic.error }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Authentication code</label>
                    <input
                      ref={codeRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                      required
                      placeholder="000000"
                      style={{ ...inputStyle, fontFamily: T.font.mono, fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center' }}
                      onFocus={focusOn} onBlur={focusOff} />
                  </div>
                  <button type="submit" disabled={loading || code.length !== 6} className="ds-submit"
                    style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: '0.95rem', background: (loading || code.length !== 6) ? T.bg.panel : T.accent.violet, color: (loading || code.length !== 6) ? T.text.muted : '#FFF', border: (loading || code.length !== 6) ? `1px solid ${T.border.strong}` : 'none', borderRadius: 8, padding: '13px', cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer', transition: 'transform 0.12s, box-shadow 0.18s', marginTop: 4 }}>
                    {loading ? 'Verifying…' : 'Verify & sign in'}
                  </button>
                </form>

                <button onClick={backToPassword}
                  style={{ display: 'block', margin: '1.75rem auto 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.font.sans, fontSize: '0.85rem', color: T.text.secondary }}>
                  ← Back to sign in
                </button>
              </>
            )}

          </div>
        </div>
      </div>

      <style>{`
        @keyframes ds-scan-move { 0% { top: 8px; } 100% { top: calc(100% - 8px); } }
        .ds-scan { animation: ds-scan-move 2.2s ease-in-out infinite alternate; }
        @keyframes ds-caret-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        .ds-caret { animation: ds-caret-blink 0.8s steps(1) infinite; color: ${T.accent.bright}; margin-left: 1px; }
        @keyframes ds-rise-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .ds-rise { opacity: 0; animation: ds-rise-in 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
        .ds-rise-1 { animation-delay: 0.05s; }
        .ds-rise-2 { animation-delay: 0.18s; }
        .ds-rise-3 { animation-delay: 0.32s; }
        .ds-rise-4 { animation-delay: 0.46s; }
        .ds-submit:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(124,92,255,0.30); transform: translateY(-1px); }
        input::placeholder { color: #5B5F66; }
        @media (max-width: 880px) {
          .ds-auth { grid-template-columns: 1fr !important; }
          .ds-auth-left { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-scan, .ds-caret { animation: none !important; }
          .ds-scan { display: none; }
          .ds-rise { opacity: 1 !important; animation: none !important; transform: none !important; }
        }
      `}</style>
    </>
  )
}
