import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ArrowRight, Check, ChevronDown,
  Zap, Layers, FileText, Video, User,
  Globe, Building, Pencil,
} from 'lucide-react';
import { LoginForm } from '../auth/LoginPage';
import { PLAN_PRICES_USD, PLAN_CREDITS } from '../../lib/stripePrices';

// ── Design tokens (dark editorial theme) ──────────────────────────────────────
const BG        = '#09090A';
const SURFACE   = '#111113';
const ELEVATED  = '#18181B';
const BORDER    = 'rgba(255,255,255,0.07)';
const BORDER_HI = 'rgba(255,255,255,0.14)';
const ACCENT    = '#C9B99A';
const ACCENT_DIM = 'rgba(201,185,154,0.08)';
const TEXT      = '#EDEBE5';
const MUTED     = '#6B6A62';
const SERIF     = "'Cormorant Garamond', Georgia, serif";
const MONO      = "'JetBrains Mono', Consolas, monospace";

// ── Nav links ─────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { id: 'features',   label: 'Features' },
  { id: 'workflow',   label: 'How It Works' },
  { id: 'use-cases',  label: 'Use Cases' },
  { id: 'pricing',    label: 'Pricing' },
  { id: 'faq',        label: 'FAQ' },
];

// ── Feature tabs ──────────────────────────────────────────────────────────────
const FEATURE_TABS = [
  {
    id: 'renders', label: 'Renders', Icon: Layers,
    items: [
      { title: '3D Architectural Render', badge: '', desc: 'Photorealistic renders from sketches, floor plans, or reference photos. Any style, any material palette.' },
      { title: 'CAD to Render', badge: '', desc: 'Upload your CAD drawings and visualise design intent instantly. Iterate on finishes without re-modelling.' },
      { title: 'Masterplan Generator', badge: '', desc: 'Site plans and urban layouts generated from a single reference image or a written prompt.' },
      { title: 'Render Sketch', badge: '', desc: 'Turn pencil sketches and hand-drawn line art into polished architectural renders in seconds.' },
      { title: 'Multi-angle Views', badge: '', desc: 'Generate spatially-consistent renders from multiple viewpoints — elevation, section, perspective — in one session.' },
      { title: 'AI Upscale', badge: '', desc: '4× resolution upscaling with AI detail enhancement. Export at print or billboard resolution.' },
    ],
  },
  {
    id: 'editing', label: 'Editing', Icon: Pencil,
    items: [
      { title: 'Visual Edit', badge: '', desc: 'Erase, replace, and precisely modify specific elements in any architectural image using natural language.' },
      { title: 'Section View', badge: '', desc: 'Generate accurate cross-section cuts through any building elevation or rendered scene.' },
      { title: 'Exploded View', badge: '', desc: 'Structural and assembly diagrams generated from elevations and reference photographs.' },
      { title: 'img-to-CAD', badge: 'Pro+', desc: 'Convert photos and renders back into CAD-ready geometry. Export as DXF for downstream modelling.' },
      { title: 'img-to-3D', badge: 'Pro+', desc: 'Reconstruct spatial 3D models from 2D architectural images and photographs.' },
    ],
  },
  {
    id: 'documents', label: 'Documents', Icon: FileText,
    items: [
      { title: 'Document Translate', badge: 'Pro+', desc: 'Translate architectural specifications, tender documents, and reports across 50+ languages whilst preserving all formatting.' },
      { title: 'Material Validation', badge: 'Pro+', desc: 'AI-powered material schedule and Bill of Quantities validation for code compliance and accuracy checking.' },
      { title: 'PDF Compression', badge: 'Pro+', desc: 'Reduce PDF file size by up to 90% without perceptible quality loss. Batch-compatible.' },
    ],
  },
  {
    id: 'video', label: 'Video', Icon: Video,
    items: [
      { title: 'Kling 2.6', badge: 'Pay/gen', desc: '5–10 second architectural walkthroughs from a single still render. Fluid, realistic camera motion.' },
      { title: 'Veo 3.1', badge: 'Pay/gen', desc: "Cinema-quality video generation with Google's Veo 3.1 model. Up to 8 seconds of photorealistic output." },
      { title: 'Pay-per-generation', badge: '', desc: 'Video is billed separately — not from your credit balance. Pay only when you generate. No commitment.' },
    ],
  },
  {
    id: 'headshots', label: 'Headshots', Icon: User,
    items: [
      { title: 'Professional Headshots', badge: '', desc: 'Polished, studio-quality headshots for your whole team — generated in minutes, not booked weeks in advance.' },
      { title: 'Role-aware Context', badge: '', desc: 'Architect, engineer, consultant — the AI tailors attire, environment, and tone to each professional role.' },
      { title: 'Batch Generation', badge: '', desc: 'Generate headshots for multiple team members in a single session with a consistent studio style.' },
    ],
  },
];

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Upload your file', desc: 'Drag in a sketch, floor plan, CAD export, photo, or PDF. We accept PNG, JPG, PDF, DOCX, XLSX, and more.' },
  { n: '02', title: 'Choose your mode', desc: 'Select from 18 generation modes — 3D render, masterplan, document translate, headshot, video, and more.' },
  { n: '03', title: 'Configure the output', desc: 'Set style, materials, camera angle, language, or quality level — each mode has intelligent defaults.' },
  { n: '04', title: 'Download your result', desc: 'AI processes your file in under 30 seconds. Download high-resolution output or iterate with one click.' },
];

// ── Use cases ─────────────────────────────────────────────────────────────────
const USE_CASES = [
  {
    Icon: User,
    persona: 'Solo Practitioner',
    headline: 'From sketch to client presentation in minutes.',
    desc: 'Cut the time between design intent and client approval. Generate photorealistic renders during the meeting — not after it.',
    points: ['600 credits / month on Starter', 'All core render modes included', 'Headshot generator for your profile'],
    plan: 'Starter',
    featured: false,
  },
  {
    Icon: Building,
    persona: 'Architecture Studio',
    headline: 'Team credits, shared history, multiple seats.',
    desc: 'Run your whole practice on a single shared credit pool. Invite team members, track usage, and manage billing in one place.',
    points: ['Up to 5 seats on Studio plan', 'Shared 6,000 credit pool', 'Admin dashboard + usage log'],
    plan: 'Studio',
    featured: true,
  },
  {
    Icon: Globe,
    persona: 'Developer / Real Estate',
    headline: 'Marketing visuals from planning drawings.',
    desc: 'Turn bare planning submissions and site layouts into compelling marketing renders before construction even begins.',
    points: ['Masterplan generator', 'img-to-3D reconstruction', 'Document translate for international projects'],
    plan: 'Professional',
    featured: false,
  },
];

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter', label: 'Starter',
    price: PLAN_PRICES_USD.starter, credits: PLAN_CREDITS.starter,
    desc: 'For solo architects and independent practitioners.',
    features: [
      `${PLAN_CREDITS.starter} credits / month`,
      'All core render modes',
      'Headshot generator',
      'Video generation (pay-per-gen)',
      'Email support',
    ],
    highlight: false, cta: 'Start with Starter',
  },
  {
    id: 'professional', label: 'Professional',
    price: PLAN_PRICES_USD.professional, credits: PLAN_CREDITS.professional,
    desc: 'For practices that need the full toolkit.',
    features: [
      `${PLAN_CREDITS.professional} credits / month`,
      'Everything in Starter',
      'img-to-CAD & img-to-3D',
      'Document translate (50+ languages)',
      'Material validation & BoQ checking',
      'PDF compression',
      '50% credit rollover each month',
    ],
    highlight: true, cta: 'Start with Professional',
  },
  {
    id: 'studio', label: 'Studio',
    price: 199, credits: PLAN_CREDITS.studio,
    desc: 'For teams sharing a single credit pool.',
    features: [
      `${PLAN_CREDITS.studio} credits / month`,
      'Everything in Professional',
      'Up to 5 team seats',
      'Shared credit pool',
      'Team admin dashboard',
      'Priority support',
    ],
    highlight: false, cta: 'Start with Studio',
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'What are credits and how are they used?',
    a: '1 credit = $0.05 USD. Each generation deducts credits based on the mode — most renders cost 4 credits (~$0.20). Upscaling costs 3, PDF compression costs 1. Credits are included in your monthly plan and reset each billing period.',
  },
  {
    q: 'Do unused credits roll over to the next month?',
    a: 'On Professional and Studio plans, up to 50% of unused credits carry over to the next billing period. On Starter, credits reset each month.',
  },
  {
    q: 'What file formats can I upload?',
    a: 'We accept PNG, JPG, WEBP for images, PDF for documents and plans, DOCX for Word documents, and XLSX for spreadsheets. Maximum file size is 20 MB per file.',
  },
  {
    q: 'How is video generation charged?',
    a: "Video is billed separately from your credit balance — it's pay-per-generation via Stripe. Prices range from $0.25 (Kling 5s) to $3.99 (Veo 8s) per video. No subscription required.",
  },
  {
    q: 'Can I use ArchViz AI Studio for commercial projects?',
    a: 'Yes. All generated images, documents, and videos are yours to use commercially without restriction. There are no royalty fees or licensing limitations on your output.',
  },
  {
    q: 'How accurate are the AI renders?',
    a: 'Render quality scales with input quality. Clear, well-lit floor plans and elevations consistently produce photorealistic output. The AI follows your material and style instructions closely. For final-stage visuals, we recommend using high-resolution reference images.',
  },
  {
    q: 'Can I add team members to my account?',
    a: 'Team features are available on the Studio plan, which includes up to 5 seats sharing a single credit pool. For larger teams or custom usage, contact us for Enterprise pricing.',
  },
];

// ── Stat strip ────────────────────────────────────────────────────────────────
const STATS = [
  { value: '18', label: 'generation modes' },
  { value: '< 30s', label: 'avg. render time' },
  { value: '50+', label: 'document languages' },
  { value: '$0.05', label: 'per credit' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared style helpers
// ─────────────────────────────────────────────────────────────────────────────
const sectionHeader = (eyebrow: string, heading: string, sub?: string, centered = false) => (
  <div style={{ marginBottom: 72, textAlign: centered ? 'center' : 'left' }}>
    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.22em', color: ACCENT, marginBottom: 14 }}>
      {eyebrow}
    </p>
    <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 5vw, 58px)', fontWeight: 600, letterSpacing: '-0.02em', color: TEXT, lineHeight: 1.05, marginBottom: sub ? 16 : 0, maxWidth: centered ? 560 : 520, margin: centered ? '0 auto' : undefined }}>
      {heading}
    </h2>
    {sub && <p style={{ fontSize: 15, color: MUTED, marginTop: 16, maxWidth: 480, margin: centered ? '16px auto 0' : '16px 0 0' }}>{sub}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [activeTab, setActiveTab] = useState('renders');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Override body overflow-hidden so the page can scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflow = prev || 'hidden'; };
  }, []);

  // Scroll-based nav state
  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 40);
      const ids = NAV_LINKS.map(l => l.id);
      let current = '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 80) current = id;
      }
      setActiveSection(current);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const currentTab = FEATURE_TABS.find(t => t.id === activeTab) ?? FEATURE_TABS[0];

  // ── Shared button styles ────────────────────────────────────────────────────
  const btnPrimary = {
    backgroundColor: ACCENT, color: '#09090A',
    border: 'none', cursor: 'pointer', fontWeight: 700,
    borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8,
    transition: 'opacity 0.15s',
  } as React.CSSProperties;

  const btnGhost = {
    background: 'transparent', color: TEXT,
    border: `1px solid ${BORDER}`, cursor: 'pointer', fontWeight: 600,
    borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8,
    transition: 'border-color 0.15s',
  } as React.CSSProperties;

  return (
    <div style={{ backgroundColor: BG, color: TEXT, minHeight: '100vh', overflowX: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ════════════════════════════════════════════════════════════════
          NAVIGATION
      ════════════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 64,
        backgroundColor: scrolled ? 'rgba(9,9,10,0.92)' : 'transparent',
        borderBottom: `1px solid ${scrolled ? BORDER : 'transparent'}`,
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        transition: 'background-color 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Wordmark */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: TEXT, letterSpacing: '-0.01em' }}>ArchViz</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Studio</span>
          </button>

          {/* Center nav — hidden on small screens */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className="hidden md:flex">
            {NAV_LINKS.map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)} style={{
                background: activeSection === id ? ELEVATED : 'none',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                padding: '7px 16px', borderRadius: 8,
                color: activeSection === id ? TEXT : MUTED,
                transition: 'color 0.15s, background 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowAuth(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: MUTED, padding: '7px 14px' }}>
              Sign in
            </button>
            <button onClick={() => setShowAuth(true)} style={{ ...btnPrimary, fontSize: 13, height: 38, padding: '0 18px', borderRadius: 10 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Get started <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════ */}
      <section id="hero" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 64, overflow: 'hidden' }}>

        {/* Architectural blueprint grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
          <defs>
            <pattern id="bp-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke={ACCENT} strokeWidth="0.4" opacity="0.15" />
            </pattern>
            <pattern id="bp-grid-lg" width="240" height="240" patternUnits="userSpaceOnUse">
              <path d="M 240 0 L 0 0 0 240" fill="none" stroke={ACCENT} strokeWidth="0.6" opacity="0.08" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bp-grid)" />
          <rect width="100%" height="100%" fill="url(#bp-grid-lg)" />
        </svg>

        {/* Radial warm glow center */}
        <div style={{ position: 'absolute', top: '35%', left: '45%', transform: 'translate(-50%,-50%)', width: 900, height: 700, background: `radial-gradient(ellipse, rgba(201,185,154,0.045) 0%, transparent 65%)`, pointerEvents: 'none' }} />

        {/* Corner measurement marks */}
        <div style={{ position: 'absolute', top: 80, left: 32, width: 24, height: 24, borderLeft: `1px solid ${ACCENT}`, borderTop: `1px solid ${ACCENT}`, opacity: 0.25 }} />
        <div style={{ position: 'absolute', bottom: 40, right: 32, width: 24, height: 24, borderRight: `1px solid ${ACCENT}`, borderBottom: `1px solid ${ACCENT}`, opacity: 0.25 }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px', position: 'relative', zIndex: 1, width: '100%' }}>
          <div style={{ maxWidth: 800 }}>

            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
              <div style={{ width: 36, height: 1, backgroundColor: ACCENT, opacity: 0.7 }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.22em', color: ACCENT }}>
                Architecture Visualisation AI Studio
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(52px, 8.5vw, 104px)', fontWeight: 500, lineHeight: 0.97, letterSpacing: '-0.025em', color: TEXT, marginBottom: 0 }}>
              Turn your<br />
              drawings into<br />
              <em style={{ fontStyle: 'italic', color: ACCENT }}>renders.</em>
            </h1>

            {/* Sub-headline */}
            <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.72, maxWidth: 500, marginTop: 36, marginBottom: 48 }}>
              Upload a sketch, floor plan, or CAD file. Choose from 18 AI generation modes.
              Download a photorealistic render in under 30 seconds — no 3D software required.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 80 }}>
              <button onClick={() => setShowAuth(true)} style={{ ...btnPrimary, fontSize: 14, height: 52, padding: '0 28px', borderRadius: 12 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Zap size={15} /> Start free — 20 credits
              </button>
              <button onClick={() => scrollTo('pricing')} style={{ ...btnGhost, fontSize: 14, height: 52, padding: '0 28px', borderRadius: 12 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = BORDER_HI)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                View pricing
              </button>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 52px', paddingTop: 36, borderTop: `1px solid ${BORDER}` }}>
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em' }}>{value}</div>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════════════════════════════ */}
      <section id="features" style={{ paddingTop: 128, paddingBottom: 128, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          {sectionHeader('Capabilities', 'Every tool your practice needs', 'From early-stage concept to final presentation — all in one platform.')}

          {/* Tab bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 44 }}>
            {FEATURE_TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 20px', borderRadius: 10,
                  fontSize: 13, fontWeight: 600,
                  border: `1px solid ${active ? 'rgba(201,185,154,0.35)' : BORDER}`,
                  backgroundColor: active ? ACCENT_DIM : 'transparent',
                  color: active ? ACCENT : MUTED,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Feature grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 1, backgroundColor: BORDER,
            borderRadius: 18, overflow: 'hidden',
            border: `1px solid ${BORDER}`,
          }}>
            {currentTab.items.map(item => (
              <div key={item.title} style={{ backgroundColor: ELEVATED, padding: '30px 30px', transition: 'background-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1F1F23')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = ELEVATED)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{item.title}</p>
                  {item.badge && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ACCENT, backgroundColor: ACCENT_DIM, border: `1px solid rgba(201,185,154,0.2)`, padding: '2px 7px', borderRadius: 20 }}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════════════════════ */}
      <section id="workflow" style={{ paddingTop: 128, paddingBottom: 128, borderTop: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          {sectionHeader('Workflow', 'Four steps.\u00A0Thirty seconds.', 'From file upload to downloadable output — no learning curve.')}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 48 }}>
            {STEPS.map(({ n, title, desc }, i) => (
              <div key={n}>
                {/* Step number + vertical rule */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: '0.08em' }}>{n}</span>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 1, backgroundColor: BORDER }} className="hidden lg:block" />
                  )}
                </div>
                <div style={{ width: 1, height: 28, backgroundColor: BORDER, marginBottom: 18 }} />
                <p style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 10, lineHeight: 1.3 }}>{title}</p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.68 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          USE CASES
      ════════════════════════════════════════════════════════════════ */}
      <section id="use-cases" style={{ paddingTop: 128, paddingBottom: 128, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          {sectionHeader("Who it's for", 'Built for every scale of practice')}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {USE_CASES.map(({ Icon, persona, headline, desc, points, plan, featured }) => (
              <div key={persona} style={{
                backgroundColor: featured ? ACCENT_DIM : ELEVATED,
                border: `1px solid ${featured ? 'rgba(201,185,154,0.22)' : BORDER}`,
                borderRadius: 20, padding: '36px 32px',
                display: 'flex', flexDirection: 'column', gap: 22,
              }}>
                {/* Icon + plan badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: featured ? 'rgba(201,185,154,0.12)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color: ACCENT }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: featured ? ACCENT : MUTED, border: `1px solid ${featured ? 'rgba(201,185,154,0.3)' : BORDER}`, padding: '4px 11px', borderRadius: 20 }}>
                    {plan}
                  </span>
                </div>

                {/* Text */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: MUTED, marginBottom: 10 }}>{persona}</p>
                  <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: TEXT, lineHeight: 1.2, marginBottom: 14 }}>{headline}</p>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.68 }}>{desc}</p>
                </div>

                {/* Points */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {points.map(pt => (
                    <li key={pt} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#8A8A7E' }}>
                      <Check size={12} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} /> {pt}
                    </li>
                  ))}
                </ul>

                <button onClick={() => setShowAuth(true)} style={{
                  ...btnPrimary,
                  width: '100%', height: 44, borderRadius: 10, fontSize: 13,
                  justifyContent: 'center', marginTop: 'auto',
                  backgroundColor: featured ? ACCENT : 'transparent',
                  color: featured ? '#09090A' : TEXT,
                  border: `1px solid ${featured ? ACCENT : BORDER}`,
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Get started <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          PRICING
      ════════════════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ paddingTop: 128, paddingBottom: 128, borderTop: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center' }}>
            {sectionHeader('Pricing', 'Simple, transparent pricing', 'Pay monthly, cancel anytime. All prices in USD.', true)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, maxWidth: 1040, margin: '0 auto' }}>
            {PLANS.map(plan => (
              <div key={plan.id} style={{
                backgroundColor: plan.highlight ? ACCENT_DIM : ELEVATED,
                border: `1px solid ${plan.highlight ? 'rgba(201,185,154,0.28)' : BORDER}`,
                borderRadius: 20, display: 'flex', flexDirection: 'column', position: 'relative',
              }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', backgroundColor: ACCENT, color: '#09090A', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '5px 15px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    Most popular
                  </div>
                )}

                {/* Price header */}
                <div style={{ padding: '36px 32px 24px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: MUTED, marginBottom: 20 }}>
                    {plan.label}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 60, fontWeight: 500, color: TEXT, lineHeight: 1, letterSpacing: '-0.02em' }}>${plan.price}</span>
                    <span style={{ fontSize: 13, color: MUTED }}>/mo</span>
                  </div>
                  <p style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{plan.credits.toLocaleString()} credits included</p>
                  <p style={{ fontSize: 12, color: MUTED }}>{plan.desc}</p>
                </div>

                <div style={{ height: 1, backgroundColor: BORDER, margin: '0 32px' }} />

                <ul style={{ padding: '24px 32px', margin: 0, listStyle: 'none', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#8A8A7E' }}>
                      <Check size={12} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} /> {f}
                    </li>
                  ))}
                </ul>

                <div style={{ padding: '0 32px 36px' }}>
                  <button onClick={() => setShowAuth(true)} style={{
                    width: '100%', height: 48, borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${plan.highlight ? ACCENT : BORDER}`,
                    backgroundColor: plan.highlight ? ACCENT : 'transparent',
                    color: plan.highlight ? '#09090A' : TEXT,
                    transition: 'opacity 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add-on credits */}
          <p style={{ textAlign: 'center', marginTop: 48, fontSize: 13, color: MUTED }}>
            Need more credits? Top up anytime —{' '}
            <strong style={{ color: TEXT }}>500 credits for $24</strong> or{' '}
            <strong style={{ color: TEXT }}>2,000 credits for $79</strong>.{' '}
            Need more seats?{' '}
            <a href="mailto:hello@archviz.ai" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Contact us for Enterprise →</a>
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FAQ
      ════════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ paddingTop: 128, paddingBottom: 128, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center' }}>
            {sectionHeader('FAQ', 'Common questions', undefined, true)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{
                backgroundColor: openFaq === i ? ELEVATED : 'transparent',
                border: `1px solid ${openFaq === i ? BORDER_HI : 'transparent'}`,
                borderRadius: 12, overflow: 'hidden', transition: 'background-color 0.2s, border-color 0.2s',
              }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', gap: 16,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: TEXT, textAlign: 'left', lineHeight: 1.4 }}>{item.q}</span>
                  <ChevronDown size={16} style={{ color: MUTED, flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 22px 20px' }}>
                    <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.72 }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FINAL CTA
      ════════════════════════════════════════════════════════════════ */}
      <section style={{ paddingTop: 128, paddingBottom: 128, borderTop: `1px solid ${BORDER}`, backgroundColor: SURFACE, position: 'relative', overflow: 'hidden' }}>
        {/* Subtle grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.03 }} aria-hidden="true">
          <defs><pattern id="cta-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 48 0 L 0 0 0 48" fill="none" stroke={ACCENT} strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#cta-grid)" />
        </svg>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.22em', color: ACCENT, marginBottom: 20 }}>
            Get started today
          </p>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(42px, 7vw, 84px)', fontWeight: 500, letterSpacing: '-0.025em', color: TEXT, lineHeight: 0.97, marginBottom: 28 }}>
            Your next render<br />is <em style={{ fontStyle: 'italic', color: ACCENT }}>30 seconds away.</em>
          </h2>
          <p style={{ fontSize: 15, color: MUTED, marginBottom: 52, lineHeight: 1.6 }}>
            20 free credits on signup. No credit card required. Cancel your plan anytime.
          </p>
          <button onClick={() => setShowAuth(true)} style={{ ...btnPrimary, fontSize: 15, height: 56, padding: '0 36px', borderRadius: 14 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Create free account <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '36px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: TEXT }}>ArchViz</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Studio</span>
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>© {new Date().getFullYear()} ArchViz AI Studio · Architecture Visualisation AI</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px', alignItems: 'center' }}>
            {NAV_LINKS.map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MUTED, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
              >
                {label}
              </button>
            ))}
            <a href="mailto:hello@archviz.ai" style={{ fontSize: 12, color: MUTED, textDecoration: 'none' }}>Contact</a>
            <a href="#" style={{ fontSize: 12, color: MUTED, textDecoration: 'none' }}>Privacy</a>
            <a href="#" style={{ fontSize: 12, color: MUTED, textDecoration: 'none' }}>Terms</a>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════════════════════════════════════════
          AUTH MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showAuth && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}>
          <div style={{
            position: 'relative', width: '100%', maxWidth: 440,
            backgroundColor: '#FAFAF8',
            border: '1px solid #E5E5E0',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 48px 140px rgba(0,0,0,0.55)',
          }}>
            {/* Close */}
            <button onClick={() => setShowAuth(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: '1px solid #E5E5E0', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8A8A8A' }}>
              <X size={15} />
            </button>

            {/* Modal header */}
            <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #E5E5E0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: '#1A1A1A' }}>ArchViz</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Studio</span>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '24px 32px 28px' }}>
              <LoginForm />
            </div>

            {/* Legal */}
            <div style={{ padding: '0 32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#8A8A8A' }}>
                By continuing you agree to our{' '}
                <a href="#" style={{ textDecoration: 'underline', color: '#8A8A8A' }}>Terms</a> and{' '}
                <a href="#" style={{ textDecoration: 'underline', color: '#8A8A8A' }}>Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
