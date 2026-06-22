import React, { useState } from "react";

/* ----------------------------------------------------------------
   DocSentinel — Landing Page
   Token system matches dashboard tokens for visual continuity.
   Uses Tailwind utility classes (install steps provided separately)
   plus a few inline styles for things Tailwind's default config
   doesn't cover (custom hex colors, gradients, keyframes).
------------------------------------------------------------------- */

const recent = [
  { k: "VENDOR", v: "Clicktech Retail Pvt Ltd" },
  { k: "GSTIN", v: "27BBBBB2222B2Z2" },
  { k: "AMOUNT", v: "₹2,71,400.00" },
  { k: "HSN CODE", v: "998315" },
];

export default function Landing() {
  const [toast, setToast] = useState(null);

  function handlePayClick(planName) {
    setToast(planName);
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <div className="font-sans antialiased selection:bg-accentViolet/30 selection:text-white bg-docBase text-docTextPrimary min-h-screen">
      {/* NAV */}
      <header className="sticky top-0 z-50 w-full border-b border-docBorder bg-docBase/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-8">
            <a href="/" className="flex items-center space-x-2.5">
              <span className="relative flex h-5 w-5 items-center justify-center rounded-sm bg-accentViolet font-mono text-xs font-bold text-white">
                D
                <span className="absolute -right-[2px] -top-[2px] h-1.5 w-1.5 rounded-full bg-semSuccess" />
              </span>
              <span className="font-mono text-sm font-bold tracking-wider">
                DOCSENTINEL<span className="text-accentViolet">™</span>
              </span>
            </a>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#modules" className="text-xs font-medium text-docTextSecondary hover:text-docTextPrimary transition-colors">Modules</a>
              <a href="#trust" className="text-xs font-medium text-docTextSecondary hover:text-docTextPrimary transition-colors">Security</a>
              <a href="#pricing" className="text-xs font-medium text-docTextSecondary hover:text-docTextPrimary transition-colors">Pricing</a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <a href="/login" className="text-xs font-medium text-docTextSecondary hover:text-docTextPrimary transition-colors hidden sm:block">Sign In</a>
            <a href="/register" className="rounded-[6px] border border-accentViolet bg-accentViolet/10 px-3.5 py-1.5 text-xs font-medium text-accentBright transition-all duration-200 hover:bg-accentViolet/20 hover:border-accentBright">
              Start free →
            </a>
          </div>
        </div>
      </header>

      <main className="overflow-hidden">
        {/* HERO */}
        <section className="relative border-b border-docBorder py-16 lg:py-24">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 items-center">
              {/* left copy */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <div className="inline-flex items-center space-x-2 rounded-sm bg-docPanel border border-docBorder px-2.5 py-1 w-fit mb-6">
                  <span className="h-1.5 w-1.5 rounded-full bg-accentViolet animate-pulse" />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-docTextSecondary">
                    DATA RESIDENCY: INDIA ONLY
                  </span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-[-0.025em] sm:text-5xl leading-[1.1] mb-4">
                  Engineered for <br />
                  <span className="bg-gradient-to-r from-docTextPrimary via-[#E2DFFF] to-accentBright bg-clip-text text-transparent">
                    Indian Document Compliance
                  </span>
                </h1>

                <p className="text-base text-docTextSecondary leading-relaxed mb-8 max-w-lg">
                  An AI-powered document intelligence system tailored specifically for Indian tax laws, GSTR filing formats, vendor contracts, and domestic payroll workflows.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <a href="/register" className="flex items-center justify-center rounded-[6px] bg-accentViolet hover:bg-accentBright text-white px-5 py-3 text-sm font-semibold transition-all duration-150 shadow-[0_4px_20px_rgba(124,92,255,0.25)]">
                    Start free — no card required
                  </a>
                  <a href="#modules" className="flex items-center justify-center rounded-[6px] border border-docBorderStrong bg-docPanel hover:bg-docBase text-docTextSecondary hover:text-docTextPrimary px-5 py-3 text-sm font-medium transition-all duration-150">
                    See how it works
                  </a>
                </div>

                <div className="mt-8 pt-6 border-t border-docBorder flex items-center gap-6 font-mono text-[11px] text-docTextMuted">
                  <div className="flex items-center gap-1.5">
                    <CheckShield />
                    <span>AES-256 encryption at rest</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BoltIcon />
                    <span>Servers hosted in India</span>
                  </div>
                </div>
              </div>

              {/* right: live parser visual */}
              <div className="lg:col-span-7">
                <div className="relative rounded-lg border border-docBorderStrong bg-docPanel p-4 shadow-2xl" style={{ animation: "pulseBorder 3s ease-in-out infinite" }}>
                  <div className="mb-4 flex items-center justify-between border-b border-docBorder pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-semError" />
                      <span className="h-2 w-2 rounded-full bg-semWarning" />
                      <span className="h-2 w-2 rounded-full bg-semSuccess" />
                      <span className="ml-2 font-mono text-[10px] text-docTextMuted">EXTRACTION_ENGINE_v4.2.1</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded bg-[#17181C] px-2 py-0.5 border border-docBorder">
                      <span className="h-1.5 w-1.5 rounded-full bg-semSuccess animate-pulse" />
                      <span className="font-mono text-[9px] text-semSuccess uppercase">LIVE PREVIEW</span>
                    </div>
                  </div>

                  <div className="flex flex-col md:grid md:grid-cols-12 gap-4">
                    {/* source document */}
                    <div className="md:col-span-7 min-w-0 relative overflow-hidden rounded bg-[#121317] border border-docBorder p-3 sm:p-4 flex flex-col justify-between">
                      <div
                        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accentBright to-transparent shadow-[0_0_12px_rgba(124,92,255,1)]"
                        style={{ animation: "scanEffect 4s cubic-bezier(0.4,0,0.2,1) infinite" }}
                      />
                      <div>
                        <div className="flex justify-between items-start border-b border-docBorder pb-3 mb-3">
                          <div>
                            <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider font-bold">TECHCORP INDIA PVT LTD</p>
                            <p className="text-[7px] sm:text-[8px] text-docTextMuted">Sector 62, Noida, UP, 201301</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[8px] sm:text-[9px] uppercase">TAX INVOICE</p>
                            <p className="text-[7px] sm:text-[8px] text-docTextMuted">No: TC-2026-9021</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4 font-mono text-[7px] sm:text-[8px] text-docTextMuted">
                          <div>
                            <span className="block text-docTextFaint uppercase">GSTIN Sender:</span>
                            <span className="text-docTextSecondary font-semibold break-all">09AAAAA1111A1Z1</span>
                          </div>
                          <div>
                            <span className="block text-docTextFaint uppercase">GSTIN Receiver:</span>
                            <span className="text-docTextSecondary font-semibold break-all">27BBBBB2222B2Z2</span>
                          </div>
                        </div>

                        <table className="w-full text-left text-[7px] sm:text-[8px] border-collapse mb-4">
                          <thead>
                            <tr className="border-b border-docBorder text-docTextFaint uppercase font-mono">
                              <th className="py-1">Description</th>
                              <th className="py-1 text-center">HSN</th>
                              <th className="py-1 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="text-docTextSecondary font-mono">
                            <tr className="border-b border-docBorder/40">
                              <td className="py-1">IT Infra Svc</td>
                              <td className="py-1 text-center">998315</td>
                              <td className="py-1 text-right">₹1,40,000</td>
                            </tr>
                            <tr className="border-b border-docBorder/40">
                              <td className="py-1">Cloud Hosting</td>
                              <td className="py-1 text-center">998315</td>
                              <td className="py-1 text-right">₹90,000</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="w-full sm:w-1/2 flex justify-between text-[9px] sm:text-[10px] font-mono mt-1 border-t border-docBorder/60 pt-1 font-bold">
                        <span>Total (INR):</span>
                        <span>₹2,71,400.00</span>
                      </div>
                    </div>

                    {/* extracted fields */}
                    <div className="md:col-span-5 min-w-0 flex flex-col justify-start space-y-3.5">
                      <FieldCard label="01. RECEIVER GSTIN" badge="VALID FORMAT" badgeColor="semSuccess" value="27BBBBB2222B2Z2" note="State code matched." />
                      <FieldCard label="02. HSN CLASSIFICATION" badge="998315" badgeColor="semInfo" value="IT Infrastructure Services" note="Applicable GST rate: 18.00%" />
                      <FieldCard label="03. GSTR RECONCILIATION" badge="RECON_OK" badgeColor="semWarning" value="₹2,71,400.00" note="Base taxable value: ₹2,30,000.00" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section id="trust" className="border-b border-docBorder bg-docPanel py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-y-6 md:grid-cols-4 md:gap-y-0 text-center divide-y md:divide-y-0 md:divide-x divide-docBorder">
              <Stat value="4" label="DOCUMENT TYPES UNDERSTOOD" />
              <Stat value="GSTIN" label="+ HSN VALIDATION BUILT IN" />
              <Stat value="100%" label="DATA HOSTED IN INDIA" />
              <Stat value="AES-256" label="VAULT ENCRYPTION AT REST" />
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section id="modules" className="border-b border-docBorder py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center max-w-3xl mx-auto">
              <span className="font-mono text-xs uppercase tracking-widest text-accentViolet font-semibold">SYSTEM ARCHITECTURE</span>
              <h2 className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl mt-3 leading-tight">
                Built for India's high-volume regulatory environments.
              </h2>
              <p className="text-sm text-docTextSecondary mt-4">
                Consolidate tax operations, contract risk, HR compliance, and structured records in one secure workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ModuleCard
                num="01"
                title="Smart Vault"
                desc="Encrypted, organized storage for every business document. Upload once, and DocSentinel classifies, indexes, and keeps it searchable — with strict access controls on every file."
                bullets={["AES-256 encryption at rest", "Automatic document type detection"]}
                icon={<VaultIcon />}
              />
              <ModuleCard
                num="02"
                title="Invoice & GST Intelligence"
                desc="Upload an invoice or receipt and DocSentinel extracts the vendor, GSTIN, HSN codes, and amounts automatically — formatted and ready for your GSTR filing."
                bullets={["GSTIN format validation", "HSN code extraction & GSTR-ready export"]}
                icon={<InvoiceIcon />}
              />
              <ModuleCard
                num="03"
                title="Contract Intelligence"
                desc="Upload a contract and surface what matters — key terms, renewal dates, and the clauses worth a second look — without reading the whole document."
                bullets={["Key term & clause extraction", "Renewal date tracking"]}
                icon={<ContractIcon />}
                comingSoon
              />
              <ModuleCard
                num="04"
                title="HR Document Manager"
                desc="Keep payslips, offer letters, and employee paperwork organized and searchable by person — instead of scattered across folders and inboxes."
                bullets={["Per-employee document organization", "Payslip & compliance document parsing"]}
                icon={<HRIcon />}
                comingSoon
              />
            </div>
          </div>
        </section>

        {/* ARCHITECTURE / TRUST DETAIL */}
        <section className="border-b border-docBorder bg-docPanel py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5">
                <span className="font-mono text-xs uppercase tracking-widest text-accentViolet font-semibold">BUILT FOR INDIA</span>
                <h2 className="text-3xl font-extrabold tracking-[-0.025em] mt-3">
                  Engineered around how Indian businesses actually file.
                </h2>
                <p className="text-sm text-docTextSecondary mt-4 leading-relaxed">
                  DocSentinel is built specifically for GST-compliant invoicing, HSN classification, and the document formats Indian finance teams handle every day — not adapted from a generic Western tool.
                </p>
                <div className="mt-8 flex items-center space-x-3 text-xs text-docTextSecondary font-mono bg-docBase border border-docBorder p-3.5 rounded">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-semSuccess" />
                  <span>All infrastructure and stored data is located inside India.</span>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoCard label="Encryption standard" value="AES-256" note="Applied to every document at rest" />
                <InfoCard label="Data residency" value="India" note="No data stored or processed abroad" />
                <div className="bg-docBase border border-docBorder p-6 rounded col-span-1 sm:col-span-2">
                  <p className="text-xs font-mono text-docTextMuted uppercase mb-3">WHAT DOCSENTINEL HANDLES</p>
                  <div className="grid grid-cols-3 gap-4 border-t border-docBorder/40 pt-3">
                    <MiniStat value="GSTIN" label="Format validation" />
                    <MiniStat value="HSN" label="Code extraction" />
                    <MiniStat value="GSTR" label="Export-ready format" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="border-b border-docBorder py-20 lg:py-24 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center max-w-2xl mx-auto">
              <span className="font-mono text-xs uppercase tracking-widest text-accentViolet font-semibold">PRICING</span>
              <h2 className="text-3xl font-extrabold tracking-[-0.025em] mt-3">
                Simple pricing. Paid via Razorpay.
              </h2>
              <p className="text-sm text-docTextSecondary mt-4">
                No setup fees. Choose a plan that matches how much you process.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              <PlanCard
                tag="FREE TIER"
                name="Free"
                desc="For freelancers & early validation."
                price="₹0"
                period="/ forever"
                bullets={["100 document extractions / mo", "Access to Smart Vault"]}
                ctaLabel="Start for free"
                onClick={() => handlePayClick("Free Plan")}
              />
              <PlanCard
                tag="MOST POPULAR"
                name="Starter"
                desc="For growing startups and SMBs."
                price="₹999"
                period="/ month"
                bullets={["2,500 document extractions / mo", "Invoice & GST Intelligence", "Priority processing queue"]}
                ctaLabel="Pay with Razorpay"
                onClick={() => handlePayClick("Starter Plan")}
                highlighted
              />
              <PlanCard
                tag="ENTERPRISE SCALE"
                name="Pro"
                desc="For larger finance & ops teams."
                price="₹2,499"
                period="/ month"
                bullets={["10,000 document extractions / mo", "All modules included", "Priority email support"]}
                ctaLabel="Pay with Razorpay"
                onClick={() => handlePayClick("Pro Plan")}
              />
            </div>

            {toast && (
              <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-docBorderStrong bg-docPanel p-4 shadow-2xl max-w-sm">
                <div className="flex items-start space-x-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accentViolet text-white text-[10px] font-bold">✓</span>
                  <div>
                    <p className="font-mono text-xs font-bold">RAZORPAY CHECKOUT</p>
                    <p className="text-[10px] text-docTextSecondary mt-1">
                      Opening checkout for <span className="font-bold text-accentBright">{toast}</span>.
                    </p>
                    <p className="text-[9px] text-docTextMuted mt-1">Secure Indian payment gateway.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="relative bg-docBase py-20 lg:py-24 border-b border-docBorder">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">
              Stop reading invoices by hand.
            </h2>
            <p className="mx-auto max-w-xl text-sm text-docTextSecondary mt-4">
              Set up DocSentinel in the time it takes to read this sentence.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/register" className="rounded-[6px] bg-accentViolet hover:bg-accentBright text-white px-6 py-3 text-xs font-bold transition-all duration-150">
                Start free
              </a>
              <a href="mailto:support@phredsec.com" className="font-mono text-xs text-docTextSecondary hover:text-docTextPrimary flex items-center gap-1">
                Contact PhRedSec™ Sales →
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-docBase py-12 border-t border-docBorder">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-docTextMuted">
          <div className="flex flex-col sm:flex-row items-center sm:space-x-4 space-y-2 sm:space-y-0 text-center sm:text-left">
            <span className="font-bold text-docTextSecondary">DOCSENTINEL™</span>
            <span>© 2026 PhRedSec™ Private Limited. All Rights Reserved.</span>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-6">
            <a href="/terms" className="hover:text-docTextSecondary transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-docTextSecondary transition-colors">Privacy</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes scanEffect { 0% { top: -2px; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes pulseBorder { 0%, 100% { border-color: rgba(124,92,255,0.2); } 50% { border-color: rgba(155,130,255,0.5); } }
      `}</style>
    </div>
  );
}

/* ---------- small subcomponents ---------- */

function FieldCard({ label, badge, badgeColor, value, note }) {
  return (
    <div className={`rounded bg-[#17181C] border border-docBorder hover:border-${badgeColor}/40 transition-colors duration-200 p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[9px] text-docTextMuted uppercase tracking-wider">{label}</span>
        <span className={`rounded-sm bg-${badgeColor}/10 px-1 py-0.5 text-[8px] font-mono text-${badgeColor} font-semibold`}>{badge}</span>
      </div>
      <p className="font-mono text-xs font-bold">{value}</p>
      <p className="text-[8px] text-docTextMuted mt-1">{note}</p>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col justify-center py-2 md:py-0">
      <span className="font-mono text-2xl font-bold tracking-tight text-accentBright" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span className="font-mono text-[10px] text-docTextMuted uppercase tracking-wider mt-1">{label}</span>
    </div>
  );
}

function InfoCard({ label, value, note }) {
  return (
    <div className="bg-docBase border border-docBorder p-6 rounded">
      <p className="text-xs font-mono text-docTextMuted uppercase">{label}</p>
      <p className="text-4xl font-extrabold tracking-tight mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="text-[10px] text-docTextMuted mt-1">{note}</p>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div>
      <p className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="text-[9px] font-mono text-docTextMuted uppercase">{label}</p>
    </div>
  );
}

function ModuleCard({ num, title, desc, bullets, icon, comingSoon }) {
  return (
    <div className="group relative rounded-lg border border-docBorder bg-gradient-to-b from-[#17181C] to-[#121317] p-6 hover:border-accentViolet/50 hover:shadow-[0_0_24px_rgba(124,92,255,0.06)] transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-accentViolet/10 border border-accentViolet/30 text-accentBright">
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {comingSoon && (
            <span className="font-mono text-[9px] text-semWarning bg-semWarning/10 px-2 py-0.5 rounded border border-semWarning/20">COMING SOON</span>
          )}
          <span className="font-mono text-[9px] text-semSuccess bg-semSuccess/10 px-2 py-0.5 rounded border border-semSuccess/20">MODULE {num}</span>
        </div>
      </div>
      <h3 className="text-lg font-bold mt-6 tracking-tight">{title}</h3>
      <p className="text-xs text-docTextSecondary mt-2 leading-relaxed">{desc}</p>
      <div className="mt-6 border-t border-docBorder/60 pt-4">
        <ul className="space-y-2 font-mono text-[10px] text-docTextMuted">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="h-1 w-1 bg-accentBright" /> {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlanCard({ tag, name, desc, price, period, bullets, ctaLabel, onClick, highlighted }) {
  return (
    <div
      className={`flex flex-col justify-between p-6 rounded-lg relative bg-gradient-to-b ${
        highlighted ? "from-[#1E1F26] to-[#15161B] border-2 border-accentViolet" : "from-[#17181C] to-[#121317] border border-docBorder"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accentViolet px-3 py-0.5 rounded-full font-mono text-[9px] font-semibold text-white uppercase tracking-wider">
          {tag}
        </div>
      )}
      <div>
        {!highlighted && (
          <span className="font-mono text-[9px] text-docTextMuted uppercase bg-docBase border border-docBorder px-2 py-0.5 rounded">{tag}</span>
        )}
        <h3 className="text-xl font-bold mt-4">{name}</h3>
        <p className="text-xs text-docTextSecondary mt-1 leading-relaxed">{desc}</p>
        <div className="mt-6 flex items-baseline">
          <span className="font-mono text-3xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{price}</span>
          <span className="font-mono text-xs text-docTextMuted ml-1">{period}</span>
        </div>
        <ul className="mt-8 space-y-3.5 font-mono text-[10px] text-docTextSecondary">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <CheckIcon /> {b}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={onClick}
        className={`w-full mt-8 py-2.5 text-xs font-bold rounded-[6px] tracking-wide transition-all duration-150 ${
          highlighted
            ? "bg-accentViolet hover:bg-accentBright text-white shadow-[0_4px_16px_rgba(124,92,255,0.3)]"
            : "bg-docBase hover:bg-docPanel border border-docBorderStrong hover:border-accentViolet"
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

/* ---------- icons (inline SVG, no external icon lib needed here) ---------- */
function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-semSuccess" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function CheckShield() {
  return (
    <svg className="h-3.5 w-3.5 text-semSuccess" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-semSuccess" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function VaultIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function InvoiceIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2-2 4 4m0-3V3M1 21h22" />
    </svg>
  );
}
function ContractIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function HRIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
