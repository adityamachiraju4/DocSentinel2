// ─────────────────────────────────────────
// DocSentinel v2 — Register Page
// PhRedSec™ | Register.jsx
// ─────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const T = {
  bg: { base: '#07080A', panel: '#0B0C0F', card: '#0F1014' },
  border: { hairline: 'rgba(255,255,255,0.07)', strong: 'rgba(255,255,255,0.14)' },
  text: { primary: '#F5F6F7', secondary: '#BDC1C8', muted: '#858992', faint: '#5B5F66' },
  accent: { violet: '#7C5CFF', bright: '#9B82FF' },
  semantic: { success: '#3FB950', error: '#F85149' },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
}

const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Onboarding "provisioning" demo — mirrors Login's terminal, themed for account setup
const PROVISION_STEPS = [
  { key: 'WORKSPACE', value: 'Provisioned' },
  { key: 'ENCRYPTION', value: 'AES-256-GCM' },
  { key: 'DATA REGION', value: 'India (Mumbai)' },
  { key: 'PLAN', value: 'Free · 25 docs/mo' },
  { key: 'STATUS', value: 'Ready' },
]

function ProvisionRow({ field, active, done, last }) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!active && !done) { setTyped(''); return }
    if (done && !active) { setTyped(field.value); return }
    if (REDUCE) { setTyped(field.value); return }
    setTyped('')
    let i = 0
    const id = setInterval(() => {
      i += 1; setTyped(field.value.slice(0, i))
      if (i >= field.value.length) clearInterval(id)
    }, 38)
    return () => clearInterval(id)
  }, [active, done, field.value])

  const filled = active || done
  const isReady = field.key === 'STATUS'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${T.border.hairline}` }}>
      <span style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.faint, letterSpacing: '0.1em' }}>{field.key}</span>
      <span style={{
        fontFamily: T.font.mono, fontSize: 12, fontWeight: 500,
        color: filled ? (isReady ? T.semantic.success : T.text.primary) : T.text.faint,
        background: filled ? 'transparent' : 'rgba(255,255,255,0.03)',
        borderRadius: 4, padding: filled ? 0 : '2px 8px', textAlign: 'right',
        minWidth: filled ? 0 : 90, transition: 'color 0.2s, background 0.2s',
        display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end',
      }}>
        {filled ? (
          <>
            {isReady && done && <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.semantic.success, boxShadow: `0 0 6px ${T.semantic.success}` }} />}
            {typed}
            {active && typed.length < field.value.length && <span className="ds-caret">▋</span>}
          </>
        ) : '— — —'}
      </span>
    </div>
  )
}

function ProvisionDemo() {
  const [active, setActive] = useState(-1)
  const [doneTo, setDoneTo] = useState(-1)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (REDUCE) { setDoneTo(PROVISION_STEPS.length - 1); setRunning(false); return }
    let idx = 0, timer
    const step = () => {
      if (idx >= PROVISION_STEPS.length) {
        setActive(-1); setRunning(false)
        timer = setTimeout(() => { setDoneTo(-1); idx = 0; setRunning(true); step() }, 2200)
        return
      }
      setActive(idx)
      const dwell = 38 * PROVISION_STEPS[idx].value.length + 520
      timer = setTimeout(() => { setDoneTo(idx); idx += 1; step() }, dwell)
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
        <span style={{ marginLeft: 8, fontFamily: T.font.mono, fontSize: 10, color: T.text.faint, letterSpacing: '0.08em' }}>provisioning · new account</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: running ? T.accent.bright : T.semantic.success, boxShadow: running ? `0 0 8px ${T.accent.bright}` : 'none' }} />
          <span style={{ fontFamily: T.font.mono, fontSize: 10, color: running ? T.accent.bright : T.semantic.success }}>{running ? 'SETUP' : 'READY'}</span>
        </span>
      </div>
      <div style={{ position: 'relative', padding: '18px 16px', minHeight: 220 }}>
        {running && <div className="ds-scan" style={{ position: 'absolute', left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.accent.violet}, transparent)`, boxShadow: `0 0 12px ${T.accent.violet}` }} />}
        {PROVISION_STEPS.map((f, i) => (
          <ProvisionRow key={f.key} field={f} active={active === i} done={i <= doneTo} last={i === PROVISION_STEPS.length - 1} />
        ))}
      </div>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed.')
      navigate('/login?registered=1')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
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
        <title>Create account — DocSentinel</title>
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
              <span style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.accent.bright, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Account setup</span>
              <h2 style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: 'clamp(1.3rem, 2vw, 1.7rem)', color: T.text.primary, lineHeight: 1.25, letterSpacing: '-0.02em', margin: '10px 0 22px 0', maxWidth: 360 }}>
                A secure workspace, ready in seconds.
              </h2>
            </div>
            <div className="ds-rise ds-rise-3"><ProvisionDemo /></div>
          </div>

          <p className="ds-rise ds-rise-4" style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.text.faint, letterSpacing: '0.05em', position: 'relative', zIndex: 1 }}>
            © {new Date().getFullYear()} PHREDSEC™ PRIVATE LIMITED · DATA RESIDENT IN INDIA
          </p>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem,5vw,4rem)' }}>
          <div className="ds-rise ds-rise-2" style={{ width: '100%', maxWidth: 380 }}>
            <span style={{ fontFamily: T.font.mono, fontSize: '0.68rem', color: T.text.faint, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Get started</span>
            <h1 style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 'clamp(1.7rem,3vw,2.1rem)', color: T.text.primary, letterSpacing: '-0.03em', margin: '0 0 8px 0' }}>Create your account</h1>
            <p style={{ fontFamily: T.font.sans, color: T.text.secondary, fontSize: '0.9rem', marginBottom: '2rem' }}>Free forever. No credit card required.</p>

            {error && (
              <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.30)', borderRadius: 8, padding: '12px 16px', marginBottom: '1.25rem', fontFamily: T.font.mono, fontSize: '0.8rem', color: T.semantic.error }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Full name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Your full name" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <div>
                <label style={labelStyle}>Email address</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@company.com" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="Min. 8 characters" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <div>
                <label style={labelStyle}>Confirm password</label>
                <input type="password" name="confirm" value={form.confirm} onChange={handleChange} required placeholder="••••••••" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <button type="submit" disabled={loading} className="ds-submit"
                style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: '0.95rem', background: loading ? T.bg.panel : T.accent.violet, color: loading ? T.text.muted : '#FFF', border: loading ? `1px solid ${T.border.strong}` : 'none', borderRadius: 8, padding: '13px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'transform 0.12s, box-shadow 0.18s', marginTop: 4 }}>
                {loading ? 'Creating account…' : 'Create free account'}
              </button>

              <p style={{ fontFamily: T.font.sans, fontSize: '0.75rem', color: T.text.muted, textAlign: 'center', lineHeight: 1.5 }}>
                By creating an account you agree to our{' '}
                <Link to="/terms" style={{ color: T.text.secondary, textDecoration: 'underline' }}>Terms of Service</Link>{' '}and{' '}
                <Link to="/privacy" style={{ color: T.text.secondary, textDecoration: 'underline' }}>Privacy Policy</Link>.
              </p>
            </form>

            <p style={{ fontFamily: T.font.sans, fontSize: '0.85rem', color: T.text.secondary, textAlign: 'center', marginTop: '1.5rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: T.accent.bright, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
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
