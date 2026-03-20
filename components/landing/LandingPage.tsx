import React, { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { LoginForm } from '../auth/LoginPage';
import { PLAN_PRICES_USD, PLAN_CREDITS } from '../../lib/stripePrices';

const FEATURES = [
  { n: '01', title: '3D Architectural Renders', desc: 'Transform sketches and floor plans into photorealistic 3D renders in seconds — no 3D modelling expertise required.' },
  { n: '02', title: 'CAD to Render', desc: 'Upload CAD drawings and instantly visualise design intent. Iterate on finishes and materials without re-rendering from scratch.' },
  { n: '03', title: 'Masterplan Generator', desc: 'Generate site masterplans and urban layouts from a single reference image or a written prompt.' },
  { n: '04', title: 'Visual Editing', desc: 'Erase, replace, and precisely modify specific elements in any architectural image using natural language.' },
  { n: '05', title: 'Multi-Angle Views', desc: 'Generate spatially-consistent renders from multiple viewpoints — elevation, section, perspective — in one session.' },
  { n: '06', title: 'Document Translation', desc: 'Translate architectural specifications, tender documents, and reports across 50+ languages whilst preserving formatting.' },
  { n: '07', title: 'Material Validation', desc: 'AI-powered material schedule and Bill of Quantities validation for compliance and accuracy checking.' },
  { n: '08', title: 'Professional Headshots', desc: 'Create polished, context-aware professional headshots for your practice team at a fraction of studio cost.' },
];

const PLANS = [
  {
    id: 'starter',
    label: 'Starter',
    price: PLAN_PRICES_USD.starter,
    credits: PLAN_CREDITS.starter,
    features: [
      `${PLAN_CREDITS.starter} credits / month`,
      'All core render modes',
      'Headshot generator',
      'Video generation (pay-per-gen)',
      'Email support',
    ],
    highlight: false,
    cta: 'Start with Starter',
  },
  {
    id: 'professional',
    label: 'Professional',
    price: PLAN_PRICES_USD.professional,
    credits: PLAN_CREDITS.professional,
    features: [
      `${PLAN_CREDITS.professional} credits / month`,
      'Everything in Starter',
      'img-to-CAD & img-to-3D',
      'Document translate',
      'Material validation',
      'PDF compression',
      '50% credit rollover',
    ],
    highlight: true,
    cta: 'Start with Professional',
  },
  {
    id: 'studio',
    label: 'Studio',
    price: 199,
    credits: PLAN_CREDITS.studio,
    features: [
      `${PLAN_CREDITS.studio} credits / month`,
      'Everything in Professional',
      'Up to 5 team seats',
      'Shared credit pool',
      'Priority support',
    ],
    highlight: false,
    cta: 'Start with Studio',
  },
] as const;

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-base font-extrabold tracking-tight text-foreground">AVAS</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAuth(true)}
              className="h-9 px-4 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="h-9 px-4 bg-foreground text-background text-sm font-semibold rounded-lg hover:bg-foreground/90 transition-colors flex items-center gap-1.5"
            >
              Get started <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        {/* Architectural grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-32">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-px w-8" style={{ backgroundColor: '#C9B99A' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#C9B99A' }}>
              20 free credits on signup
            </p>
          </div>

          {/* Headline */}
          <h1 className="text-white text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-4xl mb-8">
            Architecture intelligence<br />
            for the modern{' '}
            <span style={{ color: '#C9B99A' }}>practice.</span>
          </h1>

          {/* Sub */}
          <p className="text-white/55 text-lg max-w-xl leading-relaxed mb-12">
            Turn sketches, floor plans, and CAD files into photorealistic renders,
            masterplans, and professional visuals — in seconds, not hours.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAuth(true)}
              className="h-12 px-7 text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
              style={{ backgroundColor: '#C9B99A', color: '#1A1A1A' }}
            >
              Start for free <ArrowRight size={15} />
            </button>
            <a
              href="#pricing"
              className="h-12 px-7 border border-white/20 text-white text-sm font-semibold rounded-xl hover:border-white/40 transition-colors"
            >
              View pricing
            </a>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center gap-10 mt-20 pt-10 border-t border-white/10">
            {[
              ['18', 'generation modes'],
              ['< 30s', 'average render time'],
              ['1 credit', '≈ $0.05 USD'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-white text-2xl font-extrabold tracking-tight">{value}</p>
                <p className="text-white/40 text-xs uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-20 mb-20">
          <div className="lg:w-64 shrink-0 mb-6 lg:mb-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground-muted mb-3">Capabilities</p>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight leading-tight">
              Everything your practice needs
            </h2>
          </div>
          <p className="text-foreground-secondary text-sm leading-relaxed max-w-lg lg:pt-8">
            AVAS covers the full visualisation workflow — from early-stage concept to presentation-ready output — powered by the latest generation AI models.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-2xl overflow-hidden">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface-elevated p-6 space-y-3 hover:bg-background/80 transition-colors">
              <p className="text-[11px] font-bold text-foreground-muted tabular-nums">{f.n}</p>
              <p className="text-sm font-bold text-foreground leading-snug">{f.title}</p>
              <p className="text-xs text-foreground-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="bg-surface-sunken border-y border-border">
        <div className="max-w-7xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground-muted mb-3">Pricing</p>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight mb-3">Simple, transparent pricing</h2>
            <p className="text-sm text-foreground-muted">Pay monthly, cancel anytime. All prices in USD.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border flex flex-col relative transition-shadow ${
                  plan.highlight
                    ? 'border-foreground bg-foreground text-background shadow-elevated'
                    : 'border-border bg-surface-elevated hover:shadow-subtle'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: '#C9B99A', color: '#1A1A1A' }}>
                      Most popular
                    </span>
                  </div>
                )}

                <div className="p-7 pb-5">
                  <p className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${plan.highlight ? 'text-background/50' : 'text-foreground-muted'}`}>
                    {plan.label}
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-4xl font-extrabold tracking-tight ${plan.highlight ? 'text-background' : 'text-foreground'}`}>
                      ${plan.price}
                    </span>
                    <span className={`text-sm mb-1 ${plan.highlight ? 'text-background/50' : 'text-foreground-muted'}`}>/mo</span>
                  </div>
                  <p className={`text-xs ${plan.highlight ? 'text-background/50' : 'text-foreground-muted'}`}>
                    {plan.credits.toLocaleString()} credits included
                  </p>
                </div>

                <div className={`mx-7 h-px ${plan.highlight ? 'bg-background/10' : 'bg-border'}`} />

                <ul className="p-7 pt-5 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-xs ${plan.highlight ? 'text-background/80' : 'text-foreground-secondary'}`}>
                      <Check size={13} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-background/50' : ''}`} style={!plan.highlight ? { color: '#C9B99A' } : {}} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="px-7 pb-7">
                  <button
                    onClick={() => setShowAuth(true)}
                    className={`w-full h-11 rounded-xl text-sm font-bold transition-colors ${
                      plan.highlight
                        ? 'bg-background text-foreground hover:bg-background/90'
                        : 'bg-foreground text-background hover:bg-foreground/90'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-foreground-muted mt-10">
            Need more seats or custom usage?{' '}
            <a href="mailto:hello@avas.ai" className="underline hover:text-foreground transition-colors">
              Contact us for Enterprise pricing.
            </a>
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-28 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground-muted mb-4">Get started today</p>
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
          Your next render is<br />
          <span style={{ color: '#C9B99A' }}>30 seconds away.</span>
        </h2>
        <p className="text-sm text-foreground-muted mb-10 max-w-sm mx-auto">
          20 free credits on signup. No credit card required.
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="h-12 px-8 bg-foreground text-background text-sm font-bold rounded-xl hover:bg-foreground/90 transition-colors inline-flex items-center gap-2"
        >
          Create free account <ArrowRight size={15} />
        </button>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-foreground-muted">
          <span>© {new Date().getFullYear()} AVAS · Architecture Visualisation AI Studio</span>
          <div className="flex gap-5">
            <a href="mailto:hello@avas.ai" className="hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {/* ── Auth Modal ─────────────────────────────────────────── */}
      {showAuth && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div className="relative w-full max-w-md bg-surface-elevated border border-border rounded-2xl shadow-elevated overflow-hidden">
            {/* Close */}
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
            >
              <X size={16} />
            </button>

            {/* Header strip */}
            <div className="px-8 pt-8 pb-6 border-b border-border">
              <h1 className="text-base font-extrabold text-foreground tracking-tight">AVAS</h1>
            </div>

            {/* Form */}
            <div className="px-8 py-7">
              <LoginForm />
            </div>

            {/* Footer */}
            <div className="px-8 pb-6">
              <p className="text-[10px] text-foreground-muted text-center">
                By continuing you agree to our{' '}
                <a href="#" className="underline hover:text-foreground transition-colors">Terms</a>
                {' '}and{' '}
                <a href="#" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
