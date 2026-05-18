// ─────────────────────────────────────────
// DocSentinel v2 — Landing Page
// PhRedSec™ | Landing.jsx
// ─────────────────────────────────────────
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

// ── Structured Data (JSON-LD) ─────────────
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "DocSentinel",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "AI-powered document intelligence platform for Indian businesses. Smart Vault, Invoice & GST Intelligence, Contract Intelligence, HR Document Manager.",
  "offers": [
    { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "INR" },
    { "@type": "Offer", "name": "Starter", "price": "2499", "priceCurrency": "INR" },
    { "@type": "Offer", "name": "Pro", "price": "8299", "priceCurrency": "INR" }
  ],
  "provider": {
    "@type": "Organization",
    "name": "PhRedSec™",
    "url": "https://phredsec.com"
  }
}

// ── Scroll Animation Hook ─────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

// ── Nav ───────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(250,250,247,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(26,26,24,0.08)' : '1px solid transparent',
      transition: 'all 0.3s ease',
      padding: '0 clamp(1.25rem, 5vw, 4rem)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: '#2D6A4F', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 3h10v2H4zM4 7h10v2H4zM4 11h6v2H4z" fill="#FAFAF7"/>
              <circle cx="13" cy="13" r="3" fill="#52B788"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.15rem', color: '#1A1A18', letterSpacing: '-0.02em' }}>
            DocSentinel
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="nav-links-desktop">
          {['Features', 'Pricing', 'About'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', color: '#6B6B64', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#1A1A18'}
              onMouseLeave={e => e.target.style.color = '#6B6B64'}
            >{item}</a>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="nav-cta-desktop">
          <Link to="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', color: '#6B6B64', textDecoration: 'none', fontWeight: 500, padding: '8px 16px' }}>
            Sign in
          </Link>
          <Link to="/register" style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', fontWeight: 600,
            background: '#1A1A18', color: '#FAFAF7', textDecoration: 'none',
            padding: '8px 20px', borderRadius: 10, transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => e.target.style.opacity = '0.85'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Get started free
          </Link>
        </div>

        {/* Hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="nav-hamburger" style={{
          display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8,
        }}>
          <div style={{ width: 22, height: 2, background: '#1A1A18', marginBottom: 5, transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
          <div style={{ width: 22, height: 2, background: '#1A1A18', marginBottom: 5, opacity: menuOpen ? 0 : 1 }} />
          <div style={{ width: 22, height: 2, background: '#1A1A18', transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: '#FAFAF7', borderTop: '1px solid rgba(26,26,24,0.08)', padding: '1rem clamp(1.25rem,5vw,4rem) 1.5rem' }}>
          {['Features', 'Pricing', 'About'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}
              style={{ display: 'block', fontFamily: 'DM Sans, sans-serif', color: '#1A1A18', textDecoration: 'none', padding: '10px 0', fontSize: '1rem', borderBottom: '1px solid rgba(26,26,24,0.06)' }}>
              {item}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Link to="/login" style={{ flex: 1, textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: '#6B6B64', textDecoration: 'none', padding: '10px', border: '1px solid rgba(26,26,24,0.12)', borderRadius: 10 }}>Sign in</Link>
            <Link to="/register" style={{ flex: 1, textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, background: '#1A1A18', color: '#FAFAF7', textDecoration: 'none', padding: '10px', borderRadius: 10 }}>Get started</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// ── Hero ──────────────────────────────────
function Hero() {
  return (
    <section style={{ paddingTop: 'clamp(7rem, 14vw, 10rem)', paddingBottom: 'clamp(4rem, 8vw, 7rem)', paddingLeft: 'clamp(1.25rem,5vw,4rem)', paddingRight: 'clamp(1.25rem,5vw,4rem)', background: '#FAFAF7', position: 'relative', overflow: 'hidden' }}>
      {/* Background decoration */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 500, height: 500, background: 'radial-gradient(circle, rgba(82,183,136,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 320, height: 320, background: 'radial-gradient(circle, rgba(45,106,79,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EAF4EE', border: '1px solid rgba(45,106,79,0.2)', borderRadius: 100, padding: '6px 14px', marginBottom: '1.75rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52B788' }} />
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: '#2D6A4F', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Now available in India</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(2.6rem, 6.5vw, 5rem)', color: '#1A1A18', lineHeight: 1.08, letterSpacing: '-0.03em', maxWidth: 780, marginBottom: '1.5rem' }}>
          Your documents,<br />
          <span style={{ color: '#2D6A4F', position: 'relative' }}>
            finally intelligent.
            <svg style={{ position: 'absolute', bottom: -4, left: 0, width: '100%', height: 6 }} viewBox="0 0 400 6" preserveAspectRatio="none">
              <path d="M0 5 Q100 1 200 4 Q300 7 400 3" stroke="#52B788" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </svg>
          </span>
        </h1>

        {/* Subheadline */}
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#6B6B64', lineHeight: 1.65, maxWidth: 580, marginBottom: '2.5rem' }}>
          AI-powered document intelligence for Indian businesses. Extract GST data, analyse contracts, manage HR documents — all in one secure platform.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: '3.5rem' }}>
          <Link to="/register" style={{
            fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '1rem',
            background: '#1A1A18', color: '#FAFAF7', textDecoration: 'none',
            padding: '14px 28px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 4px 16px rgba(26,26,24,0.15)',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,26,24,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,26,24,0.15)' }}
          >
            Start for free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#FAFAF7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <a href="#features" style={{
            fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '1rem',
            color: '#1A1A18', textDecoration: 'none',
            padding: '14px 28px', borderRadius: 12, border: '1.5px solid rgba(26,26,24,0.15)', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(26,26,24,0.35)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(26,26,24,0.15)'}
          >
            See how it works
          </a>
        </div>

        {/* Social proof */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex' }}>
              {['#2D6A4F','#52B788','#EAF4EE'].map((bg, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: bg, border: '2px solid #FAFAF7', marginLeft: i === 0 ? 0 : -8 }} />
              ))}
            </div>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#6B6B64' }}>Trusted by 500+ businesses</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5].map(i => (
              <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#52B788"><path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.885 3.91 10.51l.59-3.44L2 4.635l3.455-.505z"/></svg>
            ))}
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#6B6B64', marginLeft: 4 }}>4.9 / 5</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────
const modules = [
  {
    icon: '🗄️',
    title: 'Smart Vault',
    tag: 'Storage & Security',
    desc: 'AES-256-GCM encrypted document storage with AI-powered tagging, instant search, and automated organisation across all your files.',
    color: '#2D6A4F',
    lightColor: '#EAF4EE',
  },
  {
    icon: '🧾',
    title: 'Invoice & GST Intelligence',
    tag: 'Finance & Compliance',
    desc: 'Automatically extract GSTIN, HSN codes, tax breakdowns, and totals from any invoice — scanned or digital. Built for Indian compliance.',
    color: '#1A5276',
    lightColor: '#EBF5FB',
  },
  {
    icon: '📋',
    title: 'Contract Intelligence',
    tag: 'Legal & Risk',
    desc: 'AI analyses your contracts for key clauses, renewal dates, obligations, and risks — so nothing slips through the cracks.',
    color: '#6E2C00',
    lightColor: '#FDF2E9',
  },
  {
    icon: '👥',
    title: 'HR Document Manager',
    tag: 'People & Operations',
    desc: 'Manage offer letters, payslips, appraisals, and compliance documents for your entire team in one organised, searchable hub.',
    color: '#4A235A',
    lightColor: '#F5EEF8',
  },
]

function Features() {
  const [ref, inView] = useInView()
  return (
    <section id="features" ref={ref} style={{ padding: 'clamp(4rem,8vw,7rem) clamp(1.25rem,5vw,4rem)', background: '#FAFAF7' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem,5vw,4rem)' }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2D6A4F' }}>Four modules</span>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(2rem,4vw,3rem)', color: '#1A1A18', letterSpacing: '-0.025em', marginTop: 10, marginBottom: 14 }}>
            Everything your documents need
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '1.05rem', maxWidth: 500, margin: '0 auto' }}>
            One platform. Four intelligent modules designed for the way Indian businesses actually work.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {modules.map((mod, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid rgba(26,26,24,0.08)', borderRadius: 16, padding: '2rem',
              opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)',
              transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
              cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,26,24,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: mod.lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '1.25rem' }}>
                {mod.icon}
              </div>
              <div style={{ display: 'inline-block', background: mod.lightColor, color: mod.color, fontFamily: 'DM Sans, sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 100, marginBottom: 12 }}>
                {mod.tag}
              </div>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.2rem', color: '#1A1A18', marginBottom: 10, letterSpacing: '-0.02em' }}>{mod.title}</h3>
              <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '0.92rem', lineHeight: 1.65 }}>{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Stats ─────────────────────────────────
function Stats() {
  const [ref, inView] = useInView()
  const stats = [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '< 3s', label: 'AI extraction time' },
    { value: 'AES-256', label: 'Encryption standard' },
    { value: 'GST-ready', label: 'Indian compliance' },
  ]
  return (
    <section ref={ref} style={{ padding: 'clamp(3rem,6vw,5rem) clamp(1.25rem,5vw,4rem)', background: '#1A1A18' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(16px)', transition: `all 0.5s ease ${i * 0.1}s` }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', color: '#52B788', letterSpacing: '-0.03em', marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#AEAEA8', fontSize: '0.9rem' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────
const plans = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    desc: 'Perfect for freelancers getting started.',
    features: ['25 documents / month', 'Smart Vault', 'Basic AI extraction', 'Email support'],
    cta: 'Get started',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '₹2,499',
    period: 'per month',
    desc: 'For growing SMBs that need more power.',
    features: ['500 documents / month', 'All 4 modules', 'GST & GSTIN extraction', 'Contract analysis', 'Priority support', 'Team up to 5 users'],
    cta: 'Start Starter',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '₹8,299',
    period: 'per month',
    desc: 'Unlimited scale for enterprises.',
    features: ['Unlimited documents', 'All 4 modules', 'Custom AI workflows', 'API access', 'Dedicated account manager', 'Unlimited users', 'SSO & audit logs'],
    cta: 'Talk to sales',
    highlight: false,
  },
]

function Pricing() {
  const [ref, inView] = useInView()
  return (
    <section id="pricing" ref={ref} style={{ padding: 'clamp(4rem,8vw,7rem) clamp(1.25rem,5vw,4rem)', background: '#FAFAF7' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem,5vw,4rem)' }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2D6A4F' }}>Pricing</span>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(2rem,4vw,3rem)', color: '#1A1A18', letterSpacing: '-0.025em', marginTop: 10, marginBottom: 14 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '1.05rem' }}>
            Pay in INR. Cancel anytime. No hidden charges.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, alignItems: 'start' }}>
          {plans.map((plan, i) => (
            <div key={i} style={{
              background: plan.highlight ? '#1A1A18' : '#fff',
              border: plan.highlight ? 'none' : '1px solid rgba(26,26,24,0.08)',
              borderRadius: 16, padding: '2rem',
              opacity: inView ? 1 : 0, transform: inView ? (plan.highlight ? 'scale(1.02)' : 'none') : 'translateY(24px)',
              transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
              position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#52B788', color: '#fff', fontFamily: 'DM Sans, sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: 100 }}>
                  Most popular
                </div>
              )}
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.3rem', color: plan.highlight ? '#FAFAF7' : '#1A1A18', marginBottom: 6 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(1.8rem,3vw,2.4rem)', color: plan.highlight ? '#52B788' : '#1A1A18', letterSpacing: '-0.03em' }}>{plan.price}</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', color: plan.highlight ? '#AEAEA8' : '#AEAEA8', fontSize: '0.85rem' }}>/{plan.period}</span>
              </div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', color: plan.highlight ? '#AEAEA8' : '#6B6B64', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>{plan.desc}</p>
              <Link to="/register" style={{
                display: 'block', textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '0.95rem',
                background: plan.highlight ? '#52B788' : '#1A1A18',
                color: '#FAFAF7', textDecoration: 'none', padding: '12px', borderRadius: 10, marginBottom: '1.5rem', transition: 'opacity 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >{plan.cta}</Link>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: plan.highlight ? '#AEAEA8' : '#6B6B64' }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <circle cx="7.5" cy="7.5" r="7.5" fill={plan.highlight ? 'rgba(82,183,136,0.2)' : '#EAF4EE'}/>
                      <path d="M4.5 7.5l2 2 4-4" stroke="#52B788" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem', color: '#AEAEA8', marginTop: 24 }}>
          Payments powered by Razorpay · UPI, Net Banking, Cards accepted · GST invoice provided
        </p>
      </div>
    </section>
  )
}

// ── About / Trust ─────────────────────────
function About() {
  const [ref, inView] = useInView()
  return (
    <section id="about" ref={ref} style={{ padding: 'clamp(4rem,8vw,7rem) clamp(1.25rem,5vw,4rem)', background: '#EAF4EE' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'clamp(2rem,5vw,5rem)', alignItems: 'center' }}>
        <div style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateX(-24px)', transition: 'all 0.6s ease' }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2D6A4F' }}>Built for India</span>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', color: '#1A1A18', letterSpacing: '-0.025em', marginTop: 10, marginBottom: 16, lineHeight: 1.15 }}>
            Compliance-first,<br />security-always.
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '0.97rem', lineHeight: 1.7, marginBottom: 20 }}>
            DocSentinel is built from the ground up for Indian regulatory requirements — GST, GSTIN validation, HSN codes, and INR-native workflows. Your data never leaves Indian servers without your explicit permission.
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B6B64', fontSize: '0.97rem', lineHeight: 1.7 }}>
            A product by <strong style={{ color: '#1A1A18' }}>PhRedSec™</strong> — building intelligent security tools for modern businesses.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateX(24px)', transition: 'all 0.6s ease 0.2s' }}>
          {[
            { icon: '🔒', title: 'AES-256-GCM', desc: 'Military-grade encryption at rest and in transit' },
            { icon: '🇮🇳', title: 'Made in India', desc: 'Built and hosted in India for Indian businesses' },
            { icon: '🧠', title: 'AI-Powered', desc: 'Groq-powered LLaMA models for fast, accurate extraction' },
            { icon: '📊', title: 'GST-Native', desc: 'GSTIN, HSN, IGST/CGST/SGST extracted automatically' },
          ].map((item, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '1.25rem', border: '1px solid rgba(45,106,79,0.12)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: '0.95rem', color: '#1A1A18', marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem', color: '#6B6B64', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────
function CTABanner() {
  const [ref, inView] = useInView()
  return (
    <section ref={ref} style={{ padding: 'clamp(4rem,8vw,6rem) clamp(1.25rem,5vw,4rem)', background: '#1A1A18' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)', transition: 'all 0.6s ease' }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 'clamp(2rem,4.5vw,3.2rem)', color: '#FAFAF7', letterSpacing: '-0.025em', marginBottom: 16, lineHeight: 1.1 }}>
          Start organising your documents intelligently — today.
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#AEAEA8', fontSize: '1rem', marginBottom: 32, lineHeight: 1.6 }}>
          Free forever for up to 25 documents a month. No credit card required.
        </p>
        <Link to="/register" style={{
          fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '1.05rem',
          background: '#52B788', color: '#fff', textDecoration: 'none',
          padding: '16px 36px', borderRadius: 12, display: 'inline-block', transition: 'background 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#2D6A4F'}
          onMouseLeave={e => e.currentTarget.style.background = '#52B788'}
        >
          Create your free account →
        </Link>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#1A1A18', borderTop: '1px solid rgba(250,250,247,0.08)', padding: 'clamp(2rem,4vw,3rem) clamp(1.25rem,5vw,4rem)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: '#2D6A4F', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M4 3h10v2H4zM4 7h10v2H4zM4 11h6v2H4z" fill="#FAFAF7"/>
                <circle cx="13" cy="13" r="3" fill="#52B788"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1rem', color: '#FAFAF7' }}>DocSentinel</span>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#6B6B64', marginLeft: 4 }}>by PhRedSec™</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {[['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Contact', 'mailto:support@docsentinel.in']].map(([label, href]) => (
              <a key={label} href={href} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#6B6B64', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = '#AEAEA8'}
                onMouseLeave={e => e.target.style.color = '#6B6B64'}
              >{label}</a>
            ))}
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#6B6B64' }}>
            © {new Date().getFullYear()} PhRedSec™ Private Limited
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Responsive styles injected once ───────
const globalStyles = `
  @media (max-width: 768px) {
    .nav-links-desktop { display: none !important; }
    .nav-cta-desktop { display: none !important; }
    .nav-hamburger { display: block !important; }
  }
`

// ── Page ──────────────────────────────────
export default function Landing() {
  return (
    <>
      <Helmet>
        <title>DocSentinel — AI Document Intelligence for Indian Businesses</title>
        <meta name="description" content="DocSentinel is an AI-powered document intelligence platform for Indian businesses. Extract GST data, analyse contracts, and manage HR documents — securely." />
        <meta name="keywords" content="document management India, GST invoice extraction, AI document platform, contract intelligence, HR document manager, DocSentinel, PhRedSec" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://docsentinel.in" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://docsentinel.in" />
        <meta property="og:title" content="DocSentinel — AI Document Intelligence for Indian Businesses" />
        <meta property="og:description" content="Smart Vault, Invoice & GST Intelligence, Contract Intelligence, HR Document Manager — one secure AI platform." />
        <meta property="og:image" content="https://docsentinel.in/og-image.png" />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DocSentinel — AI Document Intelligence" />
        <meta name="twitter:description" content="AI-powered document intelligence for Indian businesses." />
        <meta name="twitter:image" content="https://docsentinel.in/og-image.png" />
        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <style>{globalStyles}</style>
      </Helmet>

      <Navbar />
      <main>
        <Hero />
        <Features />
        <Stats />
        <Pricing />
        <About />
        <CTABanner />
      </main>
      <Footer />
    </>
  )
}
