import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, Check, ChevronDown, X, Zap,
  Layers, FileText, Video, User, Building, Globe, Pencil,
} from 'lucide-react';
import { LoginForm } from '../auth/LoginPage';
import { PLAN_PRICES_USD, PLAN_CREDITS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { id: 'features',  label: 'Features' },
  { id: 'workflow',  label: 'How It Works' },
  { id: 'use-cases', label: 'Use Cases' },
  { id: 'pricing',   label: 'Pricing' },
  { id: 'faq',       label: 'FAQ' },
];

// ── Hero mode preview ─────────────────────────────────────────────────────────
const MODE_PREVIEW = [
  { label: '3D Render',     sub: 'Photorealistic' },
  { label: 'CAD → Render',  sub: 'Vector to visual' },
  { label: 'Masterplan',    sub: 'Site layout' },
  { label: 'Visual Edit',   sub: 'AI editing' },
  { label: 'Doc Translate', sub: '50+ languages' },
  { label: 'Headshot',      sub: 'Professional' },
];

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURE_TABS = [
  {
    id: 'renders', label: 'Renders', Icon: Layers,
    items: [
      { title: '3D Architectural Render', badge: '', desc: 'Photorealistic renders from sketches, floor plans, or reference photos. Any style, any material palette.' },
      { title: 'CAD to Render', badge: '', desc: 'Upload CAD drawings and visualise design intent instantly. Iterate on finishes without re-modelling.' },
      { title: 'Masterplan Generator', badge: '', desc: 'Site plans and urban layouts from a single reference image or written prompt.' },
      { title: 'Render Sketch', badge: '', desc: 'Turn pencil sketches and hand-drawn line art into polished architectural renders in seconds.' },
      { title: 'Multi-angle Views', badge: '', desc: 'Spatially-consistent renders from elevation, section, and perspective viewpoints in one session.' },
      { title: 'AI Upscale', badge: '', desc: '4× resolution upscaling with AI detail enhancement. Export at print or billboard resolution.' },
    ],
  },
  {
    id: 'editing', label: 'Editing', Icon: Pencil,
    items: [
      { title: 'Visual Edit', badge: '', desc: 'Erase, replace, and precisely modify specific elements in any architectural image using natural language.' },
      { title: 'Section View', badge: '', desc: 'Generate accurate cross-section cuts through any building elevation or rendered scene.' },
      { title: 'Exploded View', badge: '', desc: 'Structural and assembly diagrams from elevations and reference photographs.' },
      { title: 'img-to-CAD', badge: 'Pro+', desc: 'Convert photos and renders back into CAD-ready geometry. Export as DXF.' },
      { title: 'img-to-3D', badge: 'Pro+', desc: 'Reconstruct spatial 3D models from 2D architectural images and photographs.' },
    ],
  },
  {
    id: 'documents', label: 'Documents', Icon: FileText,
    items: [
      { title: 'Document Translate', badge: 'Pro+', desc: 'Translate architectural specifications, tender documents, and reports across 50+ languages whilst preserving formatting.' },
      { title: 'Material Validation', badge: 'Pro+', desc: 'AI-powered material schedule and Bill of Quantities validation for compliance and accuracy.' },
      { title: 'PDF Compression', badge: 'Pro+', desc: 'Reduce PDF size by up to 90% without perceptible quality loss. Batch-compatible.' },
    ],
  },
  {
    id: 'video', label: 'Video', Icon: Video,
    items: [
      { title: 'Kling 2.6', badge: 'Pay/gen', desc: '5–10 second architectural walkthroughs from a single still render. Fluid, realistic camera motion.' },
      { title: 'Veo 3.1', badge: 'Pay/gen', desc: "Cinema-quality video with Google's Veo 3.1 model. Up to 8 seconds of photorealistic output." },
      { title: 'Pay-per-generation', badge: '', desc: 'Video is billed separately — not from your credit balance. No subscription lock-in.' },
    ],
  },
  {
    id: 'headshots', label: 'Headshots', Icon: User,
    items: [
      { title: 'Professional Headshots', badge: '', desc: 'Polished, studio-quality headshots for your whole team — generated in minutes.' },
      { title: 'Role-aware Context', badge: '', desc: 'Architect, engineer, consultant — AI tailors attire, setting, and tone to the role.' },
      { title: 'Batch Generation', badge: '', desc: 'Generate headshots for multiple team members in one session with consistent style.' },
    ],
  },
];

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Upload your file', desc: 'Drag in a sketch, floor plan, CAD export, photo, or PDF. We accept PNG, JPG, PDF, DOCX, XLSX, and more.' },
  { n: '02', title: 'Choose your mode', desc: 'Select from 18 generation modes — 3D render, masterplan, document translate, headshot, video, and more.' },
  { n: '03', title: 'Configure the output', desc: 'Set style, materials, camera angle, language, or quality level. Each mode has intelligent defaults.' },
  { n: '04', title: 'Download your result', desc: 'AI processes your file in under 30 seconds. Download high-res output or iterate with one click.' },
];

// ── Use cases ─────────────────────────────────────────────────────────────────
const USE_CASES = [
  {
    Icon: User, persona: 'Solo Practitioner',
    headline: 'From sketch to client presentation in minutes.',
    desc: 'Generate photorealistic renders during the meeting — not after it. No 3D software required.',
    points: ['600 credits / month on Starter', 'All core render modes', 'Headshot generator included'],
    plan: 'Starter', featured: false,
  },
  {
    Icon: Building, persona: 'Architecture Studio',
    headline: 'Team credits, shared history, multiple seats.',
    desc: 'Run your whole practice on a single shared credit pool with admin controls and usage tracking.',
    points: ['Up to 5 seats on Studio plan', 'Shared 6,000 credit pool', 'Admin dashboard + usage log'],
    plan: 'Studio', featured: true,
  },
  {
    Icon: Globe, persona: 'Developer / Real Estate',
    headline: 'Marketing visuals from planning drawings.',
    desc: 'Turn bare planning submissions into compelling marketing renders before construction begins.',
    points: ['Masterplan generator', 'img-to-3D reconstruction', 'Document translate for international projects'],
    plan: 'Professional', featured: false,
  },
];

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter', label: 'Starter',
    price: PLAN_PRICES_USD.starter, credits: PLAN_CREDITS.starter,
    desc: 'For solo architects and independent practitioners.',
    features: [`${PLAN_CREDITS.starter} credits / month`, 'All core render modes', 'Headshot generator', 'Video (pay-per-gen)', 'Email support'],
    highlight: false, cta: 'Start with Starter',
  },
  {
    id: 'professional', label: 'Professional',
    price: PLAN_PRICES_USD.professional, credits: PLAN_CREDITS.professional,
    desc: 'For practices that need the full toolkit.',
    features: [`${PLAN_CREDITS.professional} credits / month`, 'Everything in Starter', 'img-to-CAD & img-to-3D', 'Document translate', 'Material validation', 'PDF compression', '50% credit rollover'],
    highlight: true, cta: 'Start with Professional',
  },
  {
    id: 'studio', label: 'Studio',
    price: 199, credits: PLAN_CREDITS.studio,
    desc: 'For teams sharing a single credit pool.',
    features: [`${PLAN_CREDITS.studio} credits / month`, 'Everything in Professional', 'Up to 5 team seats', 'Shared credit pool', 'Team admin dashboard', 'Priority support'],
    highlight: false, cta: 'Start with Studio',
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ = [
  { q: 'What are credits and how do they work?', a: '1 credit = $0.05 USD. Each generation deducts credits based on the mode — most renders cost 4 credits (~$0.20). Upscaling costs 3, PDF compression costs 1. Credits are included in your monthly plan.' },
  { q: 'Do unused credits roll over?', a: 'On Professional and Studio plans, up to 50% of unused credits carry over to the next billing period. On Starter, credits reset each month.' },
  { q: 'What file formats can I upload?', a: 'PNG, JPG, WEBP for images — PDF for documents and plans — DOCX for Word documents — XLSX for spreadsheets. Maximum file size is 20 MB.' },
  { q: 'How is video generation charged?', a: "Video is pay-per-generation via Stripe, billed separately from your credit balance. Prices range from $0.25 (Kling 5s) to $3.99 (Veo 8s). No subscription required." },
  { q: 'Can I use outputs commercially?', a: 'Yes. All generated images, documents, and videos are yours to use commercially with no royalty fees or licensing restrictions.' },
  { q: 'How accurate are the renders?', a: 'Render quality scales with input quality. Clear, well-lit floor plans consistently produce photorealistic output. The AI follows your material and style instructions closely.' },
  { q: 'Can I add team members?', a: 'Team features are available on the Studio plan — up to 5 seats sharing a single credit pool. Contact us for Enterprise pricing with larger teams.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [activeTab, setActiveTab] = useState('renders');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Let page scroll (body has overflow-hidden from app shell)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflow = prev || 'hidden'; };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      let current = '';
      for (const { id } of NAV_LINKS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 80) current = id;
      }
      setActiveSection(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const currentTab = FEATURE_TABS.find(t => t.id === activeTab) ?? FEATURE_TABS[0];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className={cn(
        'sticky top-0 z-40 h-14 transition-all duration-200',
        scrolled
          ? 'bg-background/90 backdrop-blur-md border-b border-border shadow-subtle'
          : 'bg-background border-b border-transparent'
      )}>
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Wordmark */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-sm font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            ArchViz <span className="font-normal text-foreground-muted">AI Studio</span>
          </button>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeSection === id
                    ? 'bg-surface-sunken text-foreground'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-sunken'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAuth(true)}
              className="px-3.5 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 h-8 px-4 bg-foreground text-background text-xs font-semibold rounded-lg hover:bg-foreground/90 transition-colors"
            >
              Get started <ArrowRight size={11} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-16">

          {/* Left: copy */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent border border-accent/20 bg-accent/5 px-3 py-1.5 rounded-full mb-7">
              <Zap size={10} />
              20 free credits on signup · no card required
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.08] text-foreground mb-5">
              Architecture visuals,<br />
              generated by{' '}
              <span className="text-accent">AI.</span>
            </h1>

            <p className="text-base text-foreground-secondary leading-relaxed max-w-md mb-8">
              Upload a sketch, floor plan, or CAD file. Choose from 18 generation modes.
              Download a photorealistic render in under 30 seconds — no 3D software needed.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-2 h-10 px-6 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 transition-colors"
              >
                Start for free <ArrowRight size={14} />
              </button>
              <button
                onClick={() => scrollTo('pricing')}
                className="flex items-center gap-2 h-10 px-6 border border-border text-sm font-semibold rounded-xl hover:bg-surface-sunken transition-colors"
              >
                View pricing
              </button>
            </div>

            {/* Stats strip */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-8 border-t border-border">
              {[['18', 'generation modes'], ['< 30s', 'avg. render time'], ['50+', 'languages'], ['$0.05', 'per credit']].map(([v, l]) => (
                <div key={l}>
                  <p className="text-lg font-bold text-foreground font-mono">{v}</p>
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wider mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: app UI mockup */}
          <div className="hidden lg:block shrink-0 w-[460px]">
            <div className="rounded-2xl border border-border bg-surface-elevated shadow-elevated overflow-hidden">
              {/* Fake TopBar */}
              <div className="h-10 border-b border-border bg-background flex items-center px-4 gap-3">
                <div className="text-xs font-bold text-foreground">ArchViz</div>
                <div className="flex-1" />
                <div className="w-16 h-5 bg-surface-sunken rounded-md" />
                <div className="w-6 h-6 bg-surface-sunken rounded-full" />
              </div>

              <div className="flex" style={{ height: 300 }}>
                {/* Left sidebar mock */}
                <div className="w-12 border-r border-border bg-background flex flex-col items-center py-3 gap-2">
                  {[true, false, false, false, false, false].map((active, i) => (
                    <div key={i} className={cn('w-7 h-7 rounded-lg', active ? 'bg-foreground' : 'bg-surface-sunken')} />
                  ))}
                </div>

                {/* Canvas mock */}
                <div className="flex-1 bg-background flex items-center justify-center relative overflow-hidden">
                  {/* Placeholder render output */}
                  <div className="absolute inset-4 rounded-xl bg-surface-sunken">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-40">
                      <Layers size={28} className="text-foreground-muted" />
                      <span className="text-[10px] text-foreground-muted font-medium">Generated render</span>
                    </div>
                    {/* Fake architectural lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                      <line x1="20%" y1="0" x2="20%" y2="100%" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="80%" y1="0" x2="80%" y2="100%" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="0" y1="30%" x2="100%" y2="30%" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="0" y1="65%" x2="100%" y2="65%" stroke="currentColor" strokeWidth="0.5" />
                    </svg>
                  </div>
                </div>

                {/* Right panel mock */}
                <div className="w-36 border-l border-border bg-background flex flex-col gap-3 p-3">
                  <div className="space-y-1">
                    <div className="h-2 bg-surface-sunken rounded-full w-12" />
                    <div className="h-6 bg-surface-sunken rounded-lg w-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 bg-surface-sunken rounded-full w-16" />
                    <div className="h-6 bg-surface-sunken rounded-lg w-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 bg-surface-sunken rounded-full w-10" />
                    <div className="h-4 bg-surface-sunken rounded-full w-full" />
                  </div>
                  <div className="mt-auto h-8 bg-foreground rounded-lg w-full" />
                </div>
              </div>
            </div>

            {/* Mode grid below mockup */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {MODE_PREVIEW.map(({ label, sub }) => (
                <div key={label} className="bg-surface-elevated border border-border rounded-xl p-3 text-center hover:border-foreground-muted transition-colors">
                  <p className="text-[11px] font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-[9px] text-foreground-muted mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-border bg-surface-sunken py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">Capabilities</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Every tool your practice needs</h2>
            <p className="text-sm text-foreground-muted mt-2 max-w-lg">From early-stage concept to final presentation — all in one platform.</p>
          </div>

          {/* Tab bar — matches app's segmented control */}
          <div className="flex bg-background border border-border p-1 rounded-xl gap-1 flex-wrap mb-6 w-fit">
            {FEATURE_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all',
                  activeTab === id
                    ? 'bg-surface-elevated text-foreground shadow-subtle'
                    : 'text-foreground-muted hover:text-foreground'
                )}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentTab.items.map(item => (
              <div key={item.title} className="bg-surface-elevated border border-border rounded-xl p-5 hover:border-foreground-muted transition-colors space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  {item.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="workflow" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">Workflow</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Four steps. Thirty seconds.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold font-mono text-accent">{n}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-foreground-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ───────────────────────────────────────────────────────── */}
      <section id="use-cases" className="border-t border-border bg-surface-sunken py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">Who it's for</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Built for every scale of practice</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {USE_CASES.map(({ Icon, persona, headline, desc, points, plan, featured }) => (
              <div
                key={persona}
                className={cn(
                  'rounded-2xl border p-6 flex flex-col gap-5 transition-shadow',
                  featured
                    ? 'bg-foreground text-background border-foreground shadow-elevated'
                    : 'bg-surface-elevated border-border hover:border-foreground-muted'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', featured ? 'bg-white/10' : 'bg-surface-sunken')}>
                    <Icon size={16} className={featured ? 'text-background/80' : 'text-foreground-muted'} />
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold uppercase tracking-widest border px-2.5 py-1 rounded-full',
                    featured ? 'border-white/20 text-background/60' : 'border-border text-foreground-muted'
                  )}>
                    {plan}
                  </span>
                </div>

                <div>
                  <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-2', featured ? 'text-background/50' : 'text-foreground-muted')}>
                    {persona}
                  </p>
                  <p className={cn('text-sm font-semibold leading-snug mb-3', featured ? 'text-background' : 'text-foreground')}>
                    {headline}
                  </p>
                  <p className={cn('text-xs leading-relaxed', featured ? 'text-background/60' : 'text-foreground-muted')}>
                    {desc}
                  </p>
                </div>

                <ul className="space-y-2 flex-1">
                  {points.map(pt => (
                    <li key={pt} className={cn('flex items-start gap-2 text-xs', featured ? 'text-background/70' : 'text-foreground-secondary')}>
                      <Check size={11} className={cn('mt-0.5 shrink-0', featured ? 'text-background/50' : 'text-accent')} />
                      {pt}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setShowAuth(true)}
                  className={cn(
                    'w-full h-9 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
                    featured
                      ? 'bg-white text-foreground hover:bg-white/90'
                      : 'border border-border hover:bg-surface-sunken text-foreground'
                  )}
                >
                  Get started <ArrowRight size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">Pricing</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2">Simple, transparent pricing</h2>
            <p className="text-sm text-foreground-muted">Pay monthly, cancel anytime. All prices in USD.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={cn(
                  'rounded-2xl border flex flex-col relative',
                  plan.highlight ? 'bg-foreground text-background border-foreground shadow-elevated' : 'bg-surface-elevated border-border'
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-accent text-white px-3 py-1 rounded-full whitespace-nowrap">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="p-6 pb-4">
                  <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-4', plan.highlight ? 'text-background/50' : 'text-foreground-muted')}>
                    {plan.label}
                  </p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={cn('text-4xl font-bold tracking-tight', plan.highlight ? 'text-background' : 'text-foreground')}>
                      ${plan.price}
                    </span>
                    <span className={cn('text-xs', plan.highlight ? 'text-background/50' : 'text-foreground-muted')}>/mo</span>
                  </div>
                  <p className={cn('text-xs', plan.highlight ? 'text-background/50' : 'text-foreground-muted')}>
                    {plan.credits.toLocaleString()} credits · {plan.desc}
                  </p>
                </div>

                <div className={cn('mx-6 h-px', plan.highlight ? 'bg-white/10' : 'bg-border')} />

                <ul className="p-6 pt-4 space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className={cn('flex items-start gap-2 text-xs', plan.highlight ? 'text-background/70' : 'text-foreground-secondary')}>
                      <Check size={11} className={cn('mt-0.5 shrink-0', plan.highlight ? 'text-background/50' : 'text-accent')} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="p-6 pt-0">
                  <button
                    onClick={() => setShowAuth(true)}
                    className={cn(
                      'w-full h-10 rounded-xl text-xs font-semibold transition-colors',
                      plan.highlight
                        ? 'bg-white text-foreground hover:bg-white/90'
                        : 'bg-foreground text-background hover:bg-foreground/90'
                    )}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-foreground-muted mt-8">
            Need more credits? Top up anytime —{' '}
            <strong className="text-foreground font-semibold">500 for $24</strong> or{' '}
            <strong className="text-foreground font-semibold">2,000 for $79</strong>.{' '}
            Larger teams?{' '}
            <a href="mailto:hello@archviz.ai" className="text-accent hover:underline">Contact us for Enterprise.</a>
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-border bg-surface-sunken py-20">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Common questions</h2>
          </div>

          <div className="divide-y divide-border-subtle">
            {FAQ.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-4 text-left"
                >
                  <span className="text-sm font-medium text-foreground">{item.q}</span>
                  <ChevronDown
                    size={14}
                    className={cn('text-foreground-muted shrink-0 transition-transform duration-200', openFaq === i && 'rotate-180')}
                  />
                </button>
                {openFaq === i && (
                  <p className="text-xs text-foreground-muted leading-relaxed pb-4">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="border-t border-border py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">Get started today</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Your next render is<br />30 seconds away.
          </h2>
          <p className="text-sm text-foreground-muted mb-8">20 free credits on signup. No credit card required.</p>
          <button
            onClick={() => setShowAuth(true)}
            className="inline-flex items-center gap-2 h-11 px-8 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 transition-colors"
          >
            Create free account <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-sm font-bold text-foreground">ArchViz</span>
            <span className="text-sm font-normal text-foreground-muted"> AI Studio</span>
            <p className="text-[10px] text-foreground-muted mt-1">© {new Date().getFullYear()} ArchViz AI Studio</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {NAV_LINKS.map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-xs text-foreground-muted hover:text-foreground transition-colors">
                {label}
              </button>
            ))}
            <a href="mailto:hello@archviz.ai" className="text-xs text-foreground-muted hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="text-xs text-foreground-muted hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-xs text-foreground-muted hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {/* ── AUTH MODAL ──────────────────────────────────────────────────────── */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-surface-elevated border border-border rounded-2xl shadow-elevated overflow-hidden">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
            >
              <X size={15} />
            </button>

            <div className="px-7 pt-7 pb-5 border-b border-border">
              <span className="text-sm font-bold text-foreground">ArchViz</span>
              <span className="text-sm font-normal text-foreground-muted"> AI Studio</span>
            </div>

            <div className="px-7 py-6">
              <LoginForm />
            </div>

            <div className="px-7 pb-6 text-center">
              <p className="text-[10px] text-foreground-muted">
                By continuing you agree to our{' '}
                <a href="#" className="underline hover:text-foreground transition-colors">Terms</a> and{' '}
                <a href="#" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
