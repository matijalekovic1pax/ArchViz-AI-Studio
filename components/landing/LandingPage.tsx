import React, { useState } from 'react';
import { Zap, Check, ChevronRight, X } from 'lucide-react';
import { LoginPage } from '../auth/LoginPage';
import { PLAN_PRICES_USD, PLAN_CREDITS } from '../../lib/stripePrices';

const FEATURES = [
  { title: '3D Architectural Renders', desc: 'Transform sketches and floor plans into photorealistic 3D renders in seconds.' },
  { title: 'CAD to Render', desc: 'Upload CAD files and instantly visualise design intent with AI.' },
  { title: 'Masterplan Generator', desc: 'Generate site masterplans and urban layouts with a single prompt.' },
  { title: 'Visual Editing', desc: 'Erase, replace, and modify specific elements in any architectural image.' },
  { title: 'Multi-Angle Views', desc: 'Generate consistent renders from multiple viewpoints in one click.' },
  { title: 'Document Translate', desc: 'Translate architectural documents and specifications across languages.' },
  { title: 'Material Validation', desc: 'AI-powered material schedule and BoQ validation for compliance.' },
  { title: 'Professional Headshots', desc: 'Create polished, context-aware professional headshots for your team.' },
];

const PLANS = [
  {
    id: 'starter',
    label: 'Starter',
    price: PLAN_PRICES_USD.starter,
    credits: PLAN_CREDITS.starter,
    features: [`${PLAN_CREDITS.starter} credits / month`, 'All core render modes', 'Headshot generator', 'Video generation (pay-per-gen)'],
    highlight: false,
  },
  {
    id: 'professional',
    label: 'Professional',
    price: PLAN_PRICES_USD.professional,
    credits: PLAN_CREDITS.professional,
    features: [`${PLAN_CREDITS.professional} credits / month`, 'Everything in Starter', 'img-to-CAD & img-to-3D', 'Document translate', 'Material validation', 'PDF compression', '50% credit rollover'],
    highlight: true,
  },
  {
    id: 'studio',
    label: 'Studio',
    price: 199,
    credits: PLAN_CREDITS.studio,
    features: [`${PLAN_CREDITS.studio} credits / month`, 'Everything in Professional', 'Up to 5 team seats', 'Shared credit pool'],
    highlight: false,
  },
] as const;

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-foreground">AVAS</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-foreground text-background text-xs font-semibold rounded-lg hover:bg-foreground/90 transition-colors"
            >
              Get started free <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent border border-accent/30 bg-accent/5 px-3 py-1 rounded-full mb-6">
          <Zap size={11} /> 20 free credits on signup
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-5">
          AI-powered visualisation<br />for architects
        </h1>
        <p className="text-base text-foreground-secondary max-w-xl mx-auto mb-8 leading-relaxed">
          Turn sketches, floor plans, and CAD files into photorealistic renders,
          masterplans, and professional visuals — in seconds, not hours.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setShowAuth(true)}
            className="px-6 py-3 bg-foreground text-background text-sm font-bold rounded-xl hover:bg-foreground/90 transition-colors shadow-sm"
          >
            Start for free
          </button>
          <a
            href="#pricing"
            className="px-6 py-3 border border-border text-sm font-semibold rounded-xl hover:bg-surface-sunken transition-colors"
          >
            View pricing
          </a>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <h2 className="text-xl font-bold text-center text-foreground mb-10">Everything your practice needs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface-elevated border border-border rounded-xl p-5 space-y-2 hover:shadow-elevated transition-shadow">
              <p className="text-sm font-bold text-foreground">{f.title}</p>
              <p className="text-xs text-foreground-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-surface-sunken border-t border-border py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl font-bold text-center text-foreground mb-2">Simple, transparent pricing</h2>
          <p className="text-sm text-foreground-muted text-center mb-10">Pay monthly, cancel anytime. All prices in USD.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col gap-4 relative ${
                  plan.highlight ? 'border-accent bg-white shadow-elevated' : 'border-border bg-surface-elevated'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-3 py-0.5 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">{plan.label}</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">
                    ${plan.price}<span className="text-sm font-normal text-foreground-muted">/mo</span>
                  </p>
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-foreground-secondary">
                      <Check size={13} className="mt-0.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowAuth(true)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    plan.highlight
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'border border-border hover:bg-surface-sunken'
                  }`}
                >
                  Get started
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-foreground-muted mt-8">
            Need more seats or custom usage?{' '}
            <a href="mailto:hello@avas.ai" className="text-accent hover:underline">Contact us for Enterprise pricing.</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-foreground-muted">
          <span>© {new Date().getFullYear()} AVAS · Architecture Visualisation AI Studio</span>
          <div className="flex gap-4">
            <a href="mailto:hello@avas.ai" className="hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm mx-4">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <LoginPage />
          </div>
        </div>
      )}
    </div>
  );
}
