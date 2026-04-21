import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  PlayCircle,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { LoginForm } from '../auth/LoginPage';
import { CREDITS_PER_MODE, PLAN_CREDITS, PLAN_PRICES_USD, VIDEO_PRICES_CENTS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

type PublicRoute = 'home' | 'pricing' | 'terms';

type Plan = {
  id: 'starter' | 'professional' | 'studio';
  label: string;
  price: number;
  credits: number;
  tagline: string;
  highlight?: boolean;
  features: string[];
};

const NAV_ITEMS: Array<{ label: string; route: PublicRoute }> = [
  { label: 'Home', route: 'home' },
  { label: 'Pricing', route: 'pricing' },
  { label: 'Terms', route: 'terms' },
];

const FEATURE_COLUMNS = [
  {
    title: 'Generate',
    subtitle: 'From concept to polished outputs',
    icon: Sparkles,
    items: [
      '3D Render, CAD to Render, Masterplan, and Sketch to Render',
      'Consistent multi-angle generation and AI upscale for delivery assets',
      'Fast iterations with style, material, and camera control',
    ],
  },
  {
    title: 'Edit',
    subtitle: 'Precise control after generation',
    icon: Wand2,
    items: [
      'Visual Edit for object-level removal, replacement, and enhancement',
      'Exploded and Section views for technical communication',
      'Headshot mode for team profile assets in the same visual system',
    ],
  },
  {
    title: 'Deliver',
    subtitle: 'Production-ready outputs',
    icon: FileText,
    items: [
      'Document Translate and PDF Compression for project handoff',
      'Material Validation for schedule and compliance checks',
      'Video generation via Kling and Veo, billed pay-per-generation',
    ],
  },
];

const WORKFLOW_STEPS = [
  {
    title: 'Upload source',
    description: 'Bring in sketches, CAD exports, plans, renders, or documents.',
  },
  {
    title: 'Choose mode',
    description: 'Pick the exact workflow for rendering, editing, translation, or video.',
  },
  {
    title: 'Tune output',
    description: 'Set materials, style, camera, language, and output quality.',
  },
  {
    title: 'Generate and iterate',
    description: 'Download, refine, and regenerate in seconds from the same workspace.',
  },
];

type ModePricingKey = keyof typeof CREDITS_PER_MODE;

type WorkflowGroup = {
  title: string;
  description: string;
  items: Array<{
    mode: ModePricingKey;
    label: string;
    summary: string;
    useCase: string;
  }>;
};

const WORKFLOW_GROUPS: WorkflowGroup[] = [
  {
    title: 'Design Generation',
    description: 'Core creation modes for turning references, sketches, and planning input into client-ready visuals.',
    items: [
      {
        mode: 'generate-text',
        label: 'Generate',
        summary: 'Draft visual concepts and prompt foundations before image production.',
        useCase: 'Early concept alignment with clients and internal design reviews.',
      },
      {
        mode: 'render-3d',
        label: '3D to Render',
        summary: 'Convert 3D model views into polished photoreal imagery with controlled lighting and material intent.',
        useCase: 'Fast marketing and competition visuals from existing model geometry.',
      },
      {
        mode: 'render-cad',
        label: 'CAD to Render',
        summary: 'Transform technical plans, sections, and elevations into styled perspective outputs.',
        useCase: 'Upgrade drawing-heavy deliverables into presentation visuals.',
      },
      {
        mode: 'render-sketch',
        label: 'Sketch to Render',
        summary: 'Translate hand-drawn or conceptual sketches into realistic design imagery.',
        useCase: 'Concept storytelling before full BIM/CAD development.',
      },
      {
        mode: 'masterplan',
        label: 'Masterplans',
        summary: 'Generate large-scale site and zoning visuals with boundary and context controls.',
        useCase: 'Urban design pitches, planning submissions, and early-stage massing studies.',
      },
    ],
  },
  {
    title: 'Refinement and Technical Views',
    description: 'Precision workflows for iteration, post-production, consistency, and technical communication.',
    items: [
      {
        mode: 'visual-edit',
        label: 'Visual Editor',
        summary: 'Apply targeted object edits, material swaps, background updates, and in-place cleanup.',
        useCase: 'Revision cycles without re-running full scene generation.',
      },
      {
        mode: 'exploded',
        label: 'Exploded Views',
        summary: 'Create exploded compositions and animation-ready separations for assemblies and systems.',
        useCase: 'Construction logic communication and technical coordination.',
      },
      {
        mode: 'section',
        label: 'Render to Section',
        summary: 'Build section visuals with cut controls, hatch strategy, line weight, and reveal options.',
        useCase: 'Section diagrams and presentation-grade technical storytelling.',
      },
      {
        mode: 'multi-angle',
        label: 'Multi-Angle',
        summary: 'Generate consistent viewpoints while preserving style, lighting, and design identity.',
        useCase: 'Client decks requiring coherent perspectives of the same proposal.',
      },
      {
        mode: 'upscale',
        label: 'Image Upscaler',
        summary: 'Increase resolution and detail for print, boards, and close-in review.',
        useCase: 'Final delivery assets that need sharper output quality.',
      },
    ],
  },
  {
    title: 'Conversion and Project Delivery',
    description: 'Production workflows that connect visuals with documentation, translation, and validation tasks.',
    items: [
      {
        mode: 'img-to-cad',
        label: 'Image to CAD',
        summary: 'Vectorize raster references toward CAD-ready linework outputs.',
        useCase: 'Move scan-based references into drafting and documentation pipelines.',
      },
      {
        mode: 'img-to-3d',
        label: 'Image to 3D',
        summary: 'Generate and preview 3D model outputs from still imagery.',
        useCase: 'Rapid 3D ideation from references before detailed modeling.',
      },
      {
        mode: 'document-translate',
        label: 'Doc Translator',
        summary: 'Translate PDF, DOCX, and XLSX project files while preserving structure.',
        useCase: 'Cross-border collaboration across consultants, clients, and vendors.',
      },
      {
        mode: 'material-validation',
        label: 'Material Validation',
        summary: 'Cross-check BoQ and specification documents against extracted material data.',
        useCase: 'Pre-handoff QA for procurement and technical compliance.',
      },
      {
        mode: 'pdf-compression',
        label: 'PDF Compressor',
        summary: 'Batch-compress heavy PDF packs with configurable quality preferences.',
        useCase: 'Submit-ready document bundles for email, portals, and approvals.',
      },
    ],
  },
  {
    title: 'Brand and Media Output',
    description: 'Presentation-facing workflows for motion content and polished team assets.',
    items: [
      {
        mode: 'video',
        label: 'Video Studio',
        summary: 'Generate short-form architectural motion using Kling and Veo pipelines.',
        useCase: 'Social clips, hero banners, and narrative walkthrough teasers.',
      },
      {
        mode: 'headshot',
        label: 'Headshot Studio',
        summary: 'Create consistent professional headshots from one to three reference angles.',
        useCase: 'Unified team profile imagery for websites and proposal decks.',
      },
    ],
  },
];

const USE_CASE_PLAYBOOK = [
  {
    title: 'Concept Sprint to Client Deck',
    summary: 'Move from rough idea to presentation-ready stills in one session.',
    sequence: ['Generate', 'Sketch to Render', 'Multi-Angle', 'Image Upscaler'],
  },
  {
    title: 'Technical Narrative for Design Reviews',
    summary: 'Pair expressive renders with explanatory technical graphics.',
    sequence: ['3D to Render', 'Exploded Views', 'Render to Section', 'Visual Editor'],
  },
  {
    title: 'International Bid and Handoff Package',
    summary: 'Prepare visuals and translated documentation for distributed teams.',
    sequence: ['CAD to Render', 'Doc Translator', 'Material Validation', 'PDF Compressor'],
  },
  {
    title: 'Campaign-Ready Launch Assets',
    summary: 'Build promotional stills, motion, and team identity from one workspace.',
    sequence: ['3D to Render', 'Video Studio', 'Headshot Studio', 'Image Upscaler'],
  },
];

const PLATFORM_PILLARS = [
  {
    title: 'Prompt and History Control',
    points: [
      'The bottom panel keeps generated prompts editable so teams can refine or reuse creative direction.',
      'History thumbnails let you instantly reload previous outputs and continue iteration without re-uploading.',
      'Mode-specific timeline, legend, and edit stack views surface context exactly where decisions happen.',
    ],
  },
  {
    title: 'Commercial Billing Clarity',
    points: [
      'Each workflow has an explicit credit cost, visible before generation.',
      'Video is handled separately as pay-per-generation through Stripe.',
      'Teams can top up credits and monitor usage without leaving the product workspace.',
    ],
  },
  {
    title: 'Team-Ready Operations',
    points: [
      'Studio organizations use shared credit pools and seat limits for coordinated output.',
      'Owner/admin roles can manage members, invitations, and subscription controls.',
      'Generation history is persisted per account for cross-session continuity.',
    ],
  },
];

const FILE_COMPATIBILITY = [
  {
    feature: 'Document Translate',
    formats: ['PDF', 'DOCX', 'XLSX'],
    support: 'PDF, DOCX, XLSX input with translated output rebuilt in matching office-friendly formats.',
  },
  {
    feature: 'Material Validation',
    formats: ['PDF', 'CSV', 'XLS', 'XLSX'],
    support: 'PDF, CSV, XLS, and XLSX uploads for BoQ/spec cross-checking and discrepancy reporting.',
  },
  {
    feature: 'PDF Compression',
    formats: ['PDF', 'Batch'],
    support: 'Batch queue support for up to 20 PDFs per compression run.',
  },
  {
    feature: 'Image Pipelines',
    formats: ['Images', 'History'],
    support: 'Reference images flow across generation, editing, multi-angle, and upscaling workflows.',
  },
  {
    feature: 'Video Delivery',
    formats: ['Kling', 'Veo', 'MP4'],
    support: 'Kling and Veo generation with downloadable MP4 outputs.',
  },
];

function formatModeCost(mode: ModePricingKey): string {
  if (mode === 'video') return 'Pay per generation';
  const credits = CREDITS_PER_MODE[mode];
  return `${credits} ${credits === 1 ? 'credit' : 'credits'} per run`;
}

const FAQ_ITEMS = [
  {
    q: 'How do credits work?',
    a: 'Credits are consumed per generation mode. Most render modes are 4 credits per run, upscale is 3, and PDF compression is 1.',
  },
  {
    q: 'Is video included in monthly credits?',
    a: 'No. Video is billed separately by generation through Stripe, so you pay only when you run video jobs.',
  },
  {
    q: 'Can outputs be used commercially?',
    a: 'Yes. Generated outputs are intended for commercial architectural and marketing workflows.',
  },
  {
    q: 'Do teams share usage?',
    a: 'Studio plan supports shared credits and team seats with role-based management in the dashboard.',
  },
  {
    q: 'Which files are supported for delivery workflows?',
    a: 'Document Translate supports PDF, DOCX, and XLSX. Material Validation supports PDF, CSV, XLS, and XLSX. PDF Compression supports batch PDF queues.',
  },
  {
    q: 'Is generation history saved between sessions?',
    a: 'Yes. Generated outputs are stored with account history so teams can resume work, reload assets, and continue iteration later.',
  },
  {
    q: 'Can I use ArchViz AI Studio for both marketing and technical deliverables?',
    a: 'Yes. The product includes visualization modes for client-facing imagery and technical modes such as sections, exploded views, material validation, and document translation.',
  },
];

const PLANS: Plan[] = [
  {
    id: 'starter',
    label: 'Starter',
    price: PLAN_PRICES_USD.starter,
    credits: PLAN_CREDITS.starter,
    tagline: 'For independent architects and small studios.',
    features: [
      `${PLAN_CREDITS.starter} credits per month`,
      'Core image generation modes',
      'Headshot mode included',
      'Video pay-per-generation enabled',
      'Email support',
    ],
  },
  {
    id: 'professional',
    label: 'Professional',
    price: PLAN_PRICES_USD.professional,
    credits: PLAN_CREDITS.professional,
    tagline: 'For teams needing full production workflows.',
    highlight: true,
    features: [
      `${PLAN_CREDITS.professional} credits per month`,
      'Everything in Starter',
      'img-to-CAD and img-to-3D',
      'Document Translate and Material Validation',
      'PDF Compression and advanced workflows',
      '50% monthly rollover',
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    price: PLAN_PRICES_USD.studio,
    credits: PLAN_CREDITS.studio,
    tagline: 'For commercial teams sharing one workspace.',
    features: [
      `${PLAN_CREDITS.studio} credits per month`,
      'Everything in Professional',
      'Up to 5 team seats',
      'Shared credit pool',
      'Team admin controls',
      'Priority support',
    ],
  },
];

const TERMS_SECTIONS: Array<{ id: string; title: string; paragraphs: string[] }> = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    paragraphs: [
      'By accessing or using ArchViz AI Studio, you agree to these Terms of Service. If you do not agree, do not use the service.',
      'You represent that you have authority to accept these terms on your own behalf or on behalf of the entity you represent.',
    ],
  },
  {
    id: 'accounts',
    title: '2. Accounts and Eligibility',
    paragraphs: [
      'You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.',
      'You must provide accurate registration and billing details and keep them current.',
    ],
  },
  {
    id: 'billing',
    title: '3. Subscriptions, Credits, and Billing',
    paragraphs: [
      'Paid plans are billed in advance on a recurring monthly cycle unless otherwise agreed in writing.',
      'Credits are consumed according to active mode pricing. Video generations are billed separately on a pay-per-generation basis.',
      'Fees are non-refundable except where required by law or explicitly stated by ArchViz AI Studio.',
    ],
  },
  {
    id: 'use',
    title: '4. Acceptable Use',
    paragraphs: [
      'You may not use the service for unlawful, abusive, or deceptive activities, including infringement of third-party rights.',
      'You may not attempt to reverse engineer, disrupt, overload, or bypass security controls of the platform.',
    ],
  },
  {
    id: 'content',
    title: '5. Content and Intellectual Property',
    paragraphs: [
      'You retain ownership of the source files and materials you submit to the service.',
      'Subject to these Terms and applicable law, outputs generated for your account are licensed to you for commercial use.',
      'You grant ArchViz AI Studio a limited right to process submitted content solely to operate, secure, and improve the service.',
    ],
  },
  {
    id: 'privacy',
    title: '6. Privacy and Data Handling',
    paragraphs: [
      'We process personal and project data to provide account access, generation workflows, billing, and support operations.',
      'You are responsible for ensuring you have rights and permissions for any content you upload or process through the platform.',
    ],
  },
  {
    id: 'availability',
    title: '7. Service Availability and Changes',
    paragraphs: [
      'We may update, change, or discontinue features at any time to improve reliability, performance, or security.',
      'We do not guarantee uninterrupted availability and are not liable for downtime caused by third-party infrastructure providers.',
    ],
  },
  {
    id: 'liability',
    title: '8. Disclaimer and Limitation of Liability',
    paragraphs: [
      'The service is provided on an “as is” and “as available” basis without warranties of any kind, express or implied.',
      'To the maximum extent permitted by law, ArchViz AI Studio is not liable for indirect, incidental, special, consequential, or punitive damages.',
    ],
  },
  {
    id: 'termination',
    title: '9. Termination',
    paragraphs: [
      'You may stop using the service at any time. We may suspend or terminate access for material breach, abuse, or unlawful use.',
      'Sections that by nature should survive termination remain in effect, including payment, liability, and intellectual property terms.',
    ],
  },
  {
    id: 'law',
    title: '10. Governing Law and Contact',
    paragraphs: [
      'These terms are governed by the laws applicable in the jurisdiction where ArchViz AI Studio operates, without regard to conflict of law rules.',
      'For legal and account questions, contact hello@archviz.ai.',
    ],
  },
];

function routeFromPath(pathname: string): PublicRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/pricing') return 'pricing';
  if (normalizedPath === '/terms') return 'terms';
  return 'home';
}

function pathFromRoute(route: PublicRoute): string {
  if (route === 'pricing') return '/pricing';
  if (route === 'terms') return '/terms';
  return '/';
}

function Brand() {
  return (
    <span className="text-sm font-bold tracking-tight text-foreground">
      ArchViz <span className="font-normal text-foreground-muted">AI Studio</span>
    </span>
  );
}

type SiteHeaderProps = {
  route: PublicRoute;
  scrolled: boolean;
  onNavigate: (route: PublicRoute) => void;
  onOpenAuth: () => void;
};

function SiteHeader({ route, scrolled, onNavigate, onOpenAuth }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-all duration-300',
        scrolled
          ? 'bg-background/90 backdrop-blur-lg border-border shadow-subtle'
          : 'bg-background/70 backdrop-blur-sm border-border/60'
      )}
    >
      <div className="max-w-6xl mx-auto h-16 px-5 sm:px-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center hover:opacity-85 transition-opacity"
          aria-label="Go to homepage"
        >
          <Brand />
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.route}
              href={pathFromRoute(item.route)}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.route);
              }}
              className={cn(
                'px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors',
                route === item.route
                  ? 'text-foreground bg-surface-sunken'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-sunken'
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAuth}
            className="h-9 px-3.5 text-xs font-semibold text-foreground-muted hover:text-foreground transition-colors"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onOpenAuth}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
          >
            Start free
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}

type SiteFooterProps = {
  onNavigate: (route: PublicRoute) => void;
};

function SiteFooter({ onNavigate }: SiteFooterProps) {
  return (
    <footer className="border-t border-border bg-surface-sunken/50">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Brand />
          <p className="mt-2 text-xs text-foreground-muted max-w-sm">
            Commercial AI workspace for architecture teams: generate, edit, and deliver visual assets faster.
          </p>
          <p className="mt-3 text-[11px] text-foreground-muted">© {new Date().getFullYear()} ArchViz AI Studio</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('home');
            }}
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Home
          </a>
          <a
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('pricing');
            }}
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Pricing
          </a>
          <a
            href="/terms"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('terms');
            }}
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Terms
          </a>
          <a href="mailto:hello@archviz.ai" className="text-foreground-muted hover:text-foreground transition-colors">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

type HomePageProps = {
  heroReady: boolean;
  scrollY: number;
  onNavigatePricing: () => void;
  onOpenAuth: () => void;
  openFaq: number | null;
  setOpenFaq: (value: number | null) => void;
};

function HomePage({
  heroReady,
  scrollY,
  onNavigatePricing,
  onOpenAuth,
  openFaq,
  setOpenFaq,
}: HomePageProps) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(22,163,74,0.16),transparent_44%),radial-gradient(circle_at_76%_22%,rgba(26,26,26,0.09),transparent_36%),linear-gradient(to_bottom,#fafaf8,#f5f5f3)]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{ transform: `translateY(${Math.min(scrollY * 0.08, 36)}px)` }}
          aria-hidden
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#d8d8d2" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-grid)" />
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-16 lg:pt-24 lg:pb-20">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-end">
            <div
              className={cn(
                'transition-all duration-700 ease-out',
                heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-5">Commercial Edition</p>
              <h1
                className="text-[46px] leading-[0.96] sm:text-[66px] lg:text-[78px] text-foreground tracking-tight"
                style={{ fontFamily: 'Cormorant Garamond, serif' }}
              >
                Architecture AI,
                <br />
                built for
                <span className="italic text-accent"> real delivery.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm sm:text-base text-foreground-secondary leading-relaxed">
                ArchViz AI Studio turns sketches, CAD files, reference renders, and documents into production-ready
                visuals. One workspace for generation, refinement, translation, validation, and client-facing output.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="h-11 px-6 rounded-xl bg-foreground text-background text-sm font-semibold inline-flex items-center gap-2 hover:bg-foreground/90 transition-colors"
                >
                  Create free account
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={onNavigatePricing}
                  className="h-11 px-6 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-sunken transition-colors"
                >
                  View plans
                </button>
              </div>

              <div className="mt-10 pt-6 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  ['18+', 'workflows'],
                  ['< 30s', 'avg output cycle'],
                  ['50+', 'language coverage'],
                  ['3', 'commercial plans'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="text-2xl font-semibold text-foreground">{value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-foreground-muted mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={cn(
                'transition-all duration-700 delay-150 ease-out',
                heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <div className="rounded-2xl border border-border bg-surface-elevated shadow-elevated overflow-hidden">
                <div className="h-11 border-b border-border bg-background flex items-center px-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">Studio Session</div>
                  <div className="ml-auto flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-surface-sunken" />
                    <span className="h-2 w-2 rounded-full bg-surface-sunken" />
                    <span className="h-2 w-2 rounded-full bg-surface-sunken" />
                  </div>
                </div>

                <div className="grid grid-cols-[56px_1fr_140px] min-h-[340px]">
                  <div className="border-r border-border bg-background p-2.5 flex flex-col gap-2">
                    {['bg-foreground', 'bg-surface-sunken', 'bg-surface-sunken', 'bg-surface-sunken', 'bg-surface-sunken'].map(
                      (clazz, index) => (
                        <span key={index} className={cn('h-8 w-8 rounded-lg', clazz)} />
                      )
                    )}
                  </div>

                  <div className="p-4 bg-background-secondary relative overflow-hidden">
                    <div className="absolute inset-4 rounded-xl border border-border bg-[linear-gradient(135deg,#e8e8e2_0%,#f2f2ed_45%,#ecece7_100%)]" />
                    <div className="absolute inset-8 rounded-lg border border-white/60 bg-white/35 backdrop-blur-sm" />
                    <div className="absolute bottom-8 left-8 right-8 h-12 rounded-lg border border-white/70 bg-white/45 flex items-center px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Prompt · Camera · Materials</span>
                    </div>
                  </div>

                  <div className="border-l border-border bg-background p-3 flex flex-col gap-3">
                    <div className="space-y-1.5">
                      <div className="h-2 w-14 rounded-full bg-surface-sunken" />
                      <div className="h-7 rounded-lg bg-surface-sunken" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 w-16 rounded-full bg-surface-sunken" />
                      <div className="h-7 rounded-lg bg-surface-sunken" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 w-12 rounded-full bg-surface-sunken" />
                      <div className="h-7 rounded-lg bg-surface-sunken" />
                    </div>
                    <button className="mt-auto h-9 rounded-lg bg-foreground text-background text-[11px] font-semibold inline-flex items-center justify-center gap-1.5">
                      Generate
                      <Sparkles size={12} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2.5 text-[11px]">
                {[
                  ['3D Render', 'Photoreal output'],
                  ['Visual Edit', 'Targeted refinement'],
                  ['Video', 'Walkthrough clips'],
                ].map(([title, subtitle]) => (
                  <div key={title} className="rounded-xl border border-border bg-surface-elevated px-3 py-2.5">
                    <p className="font-semibold text-foreground leading-tight">{title}</p>
                    <p className="text-foreground-muted mt-1">{subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="mb-8 sm:mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Platform</p>
            <h2 className="mt-3 text-3xl sm:text-[38px] leading-tight tracking-tight text-foreground font-semibold">
              One product surface, full project lifecycle.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 border border-border rounded-2xl overflow-hidden bg-surface-elevated">
            {FEATURE_COLUMNS.map((column, index) => {
              const Icon = column.icon;
              return (
                <div
                  key={column.title}
                  className={cn(
                    'p-6 sm:p-7',
                    index < FEATURE_COLUMNS.length - 1 && 'md:border-r border-border',
                    index > 0 && 'border-t md:border-t-0 border-border'
                  )}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-8 w-8 rounded-lg bg-surface-sunken inline-flex items-center justify-center text-foreground-muted">
                      <Icon size={14} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">{column.title}</p>
                      <p className="text-sm font-semibold text-foreground">{column.subtitle}</p>
                    </div>
                  </div>

                  <ul className="space-y-3 text-sm text-foreground-secondary leading-relaxed">
                    {column.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface-sunken/35 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="mb-8 sm:mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Workflow Library</p>
            <h3 className="mt-3 text-3xl sm:text-[38px] leading-tight tracking-tight text-foreground font-semibold max-w-4xl">
              Every mode in the app, mapped to what it does and when to use it.
            </h3>
            <p className="mt-4 text-sm sm:text-base text-foreground-secondary max-w-3xl leading-relaxed">
              ArchViz AI Studio is organized as specialized workflows, not one generic generator. Teams can select the
              exact mode for concept creation, technical output, document handling, or media delivery.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {[
              [`${Object.keys(CREDITS_PER_MODE).length}`, 'workflows in the commercial app'],
              [`${WORKFLOW_GROUPS.length}`, 'workflow families'],
              ['2', 'billing models (credits + pay-per-gen)'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-border bg-surface-elevated px-4 py-3">
                <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-foreground-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            {WORKFLOW_GROUPS.map((group, groupIndex) => (
              <article key={group.title} className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-2xl" aria-hidden />
                <div className="relative px-5 py-5 sm:px-6 sm:py-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                    <div className="flex items-start gap-3">
                      <span className="h-8 w-8 shrink-0 rounded-lg border border-border bg-background inline-flex items-center justify-center text-[10px] font-semibold tracking-wider text-foreground-muted">
                        {String(groupIndex + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-lg font-semibold tracking-tight text-foreground">{group.title}</p>
                        <p className="mt-1 text-sm text-foreground-secondary max-w-3xl leading-relaxed">{group.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.items.map((item) => (
                      <article
                        key={item.mode}
                        className="group rounded-xl border border-border bg-background/75 backdrop-blur-sm p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:border-foreground/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-tight">{item.label}</p>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground-muted whitespace-nowrap">
                            {formatModeCost(item.mode)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-foreground-secondary leading-relaxed">{item.summary}</p>
                        <div className="mt-4 pt-3 border-t border-border">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-foreground-muted">Best for</p>
                          <p className="mt-1.5 text-xs text-foreground-secondary leading-relaxed">{item.useCase}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface-sunken/45 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">How It Works</p>
              <h3 className="mt-3 text-2xl sm:text-[34px] text-foreground font-semibold tracking-tight">Fast by default. Precise when needed.</h3>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-10 px-4 rounded-lg border border-border text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-surface-sunken transition-colors inline-flex items-center gap-1.5"
            >
              Try it now
              <PlayCircle size={13} />
            </button>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border bg-background p-5">
                <p className="text-[11px] uppercase tracking-widest text-accent font-semibold">0{index + 1}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-2 text-sm text-foreground-muted leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="mb-8 sm:mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Studio Use Cases</p>
            <h3 className="mt-3 text-3xl sm:text-[38px] leading-tight tracking-tight text-foreground font-semibold max-w-4xl">
              Practical workflows teams run from kickoff to final handoff.
            </h3>
          </div>

          <div className="space-y-4">
            {USE_CASE_PLAYBOOK.map((item, index) => (
              <article
                key={item.title}
                className="rounded-2xl border border-border bg-[linear-gradient(150deg,#ffffff_0%,#f5f5f1_85%)] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <span className="h-8 w-8 shrink-0 rounded-full border border-border bg-background inline-flex items-center justify-center text-[10px] font-semibold tracking-wider text-foreground-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-[220px]">
                    <h4 className="text-lg font-semibold tracking-tight text-foreground">{item.title}</h4>
                    <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">{item.summary}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {item.sequence.map((step, stepIndex) => (
                    <React.Fragment key={`${item.title}-${step}`}>
                      <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                        {step}
                      </span>
                      {stepIndex < item.sequence.length - 1 && (
                        <ChevronRight size={12} className="text-foreground-muted" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface-sunken/40 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-5 lg:gap-6">
          <article className="rounded-2xl border border-border bg-surface-elevated p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Workspace Operations</p>
            <h3 className="mt-3 text-2xl sm:text-[32px] leading-tight tracking-tight text-foreground font-semibold">
              Built for commercial teams, not one-off demos.
            </h3>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {PLATFORM_PILLARS.map((pillar) => (
                <div key={pillar.title} className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">{pillar.title}</p>
                  <ul className="mt-3 space-y-2">
                    {pillar.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-xs text-foreground-secondary leading-relaxed">
                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface-elevated p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Compatibility</p>
            <h3 className="mt-3 text-2xl sm:text-[30px] leading-tight tracking-tight text-foreground font-semibold">
              Inputs and outputs by workflow.
            </h3>
            <div className="mt-5 divide-y divide-border">
              {FILE_COMPATIBILITY.map((row) => (
                <div key={row.feature} className="py-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">{row.feature}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.formats.map((format) => (
                      <span
                        key={`${row.feature}-${format}`}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground-muted"
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-sm text-foreground-secondary leading-relaxed">{row.support}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="border-b border-border py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="rounded-2xl border border-border bg-[linear-gradient(160deg,#ffffff_0%,#f4f4f0_100%)] p-6 sm:p-8 lg:p-10">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-10 items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Commercial Plans</p>
                <h3 className="mt-3 text-3xl sm:text-[38px] tracking-tight text-foreground font-semibold">Pricing that scales from solo to studio.</h3>
                <p className="mt-4 text-sm sm:text-base text-foreground-secondary max-w-2xl leading-relaxed">
                  Pick monthly credits for images and documents, then add video generation when needed. Clear unit economics,
                  no hidden fees.
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigatePricing}
                className="h-11 px-6 rounded-xl bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors"
              >
                See full pricing
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="mt-8 grid sm:grid-cols-3 gap-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    'rounded-xl border px-4 py-4',
                    plan.highlight
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-surface-elevated'
                  )}
                >
                  <p className={cn('text-[10px] uppercase tracking-widest font-semibold', plan.highlight ? 'text-background/70' : 'text-foreground-muted')}>
                    {plan.label}
                  </p>
                  <p className={cn('mt-1 text-2xl font-semibold', plan.highlight ? 'text-background' : 'text-foreground')}>
                    ${plan.price}
                    <span className={cn('text-xs font-medium ml-1', plan.highlight ? 'text-background/70' : 'text-foreground-muted')}>
                      /mo
                    </span>
                  </p>
                  <p className={cn('mt-1 text-xs', plan.highlight ? 'text-background/70' : 'text-foreground-muted')}>
                    {plan.credits.toLocaleString()} credits
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">FAQ</p>
            <h3 className="mt-3 text-3xl sm:text-[36px] text-foreground tracking-tight font-semibold">Before you start</h3>
          </div>

          <div className="divide-y divide-border border-y border-border bg-surface-elevated rounded-xl">
            {FAQ_ITEMS.map((item, index) => (
              <div key={item.q} className="px-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full py-4 text-left flex items-start justify-between gap-4"
                >
                  <span className="text-sm font-medium text-foreground">{item.q}</span>
                  <span className="text-xs text-foreground-muted mt-1">{openFaq === index ? '−' : '+'}</span>
                </button>
                {openFaq === index && <p className="pb-4 text-sm text-foreground-muted leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

type PricingPageProps = {
  onOpenAuth: () => void;
  onNavigateHome: () => void;
};

function PricingPage({ onOpenAuth, onNavigateHome }: PricingPageProps) {
  return (
    <>
      <section className="border-b border-border bg-[radial-gradient(circle_at_22%_10%,rgba(22,163,74,0.18),transparent_38%),linear-gradient(to_bottom,#fafaf8,#f5f5f3)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Pricing & Plans</p>
          <h1 className="mt-3 text-4xl sm:text-[54px] leading-[1.02] tracking-tight text-foreground font-semibold max-w-4xl">
            Predictable monthly credits for teams shipping architectural visuals.
          </h1>
          <p className="mt-5 max-w-2xl text-sm sm:text-base text-foreground-secondary leading-relaxed">
            Choose the plan that fits your output volume. Image and document workflows consume credits, while video is
            billed separately by generation.
          </p>
        </div>
      </section>

      <section className="border-b border-border py-14 sm:py-16 bg-background">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={cn(
                  'rounded-2xl border p-6 flex flex-col',
                  plan.highlight
                    ? 'border-foreground bg-foreground text-background shadow-elevated'
                    : 'border-border bg-surface-elevated'
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', plan.highlight ? 'text-background/65' : 'text-foreground-muted')}>
                      {plan.label}
                    </p>
                    <p className={cn('mt-2 text-4xl font-semibold tracking-tight', plan.highlight ? 'text-background' : 'text-foreground')}>
                      ${plan.price}
                      <span className={cn('text-xs font-medium ml-1', plan.highlight ? 'text-background/65' : 'text-foreground-muted')}>
                        /month
                      </span>
                    </p>
                    <p className={cn('mt-2 text-sm', plan.highlight ? 'text-background/75' : 'text-foreground-secondary')}>
                      {plan.tagline}
                    </p>
                  </div>
                  {plan.highlight && (
                    <span className="h-7 px-3 rounded-full bg-accent text-white text-[10px] font-semibold uppercase tracking-wider inline-flex items-center">
                      Most Popular
                    </span>
                  )}
                </div>

                <p className={cn('text-sm mb-5', plan.highlight ? 'text-background/75' : 'text-foreground-muted')}>
                  {plan.credits.toLocaleString()} credits included each month.
                </p>

                <ul className="space-y-2.5 text-sm flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className={cn('flex items-start gap-2', plan.highlight ? 'text-background/85' : 'text-foreground-secondary')}>
                      <Check size={14} className={cn('mt-0.5 shrink-0', plan.highlight ? 'text-background/75' : 'text-accent')} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onOpenAuth}
                  className={cn(
                    'mt-6 h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors',
                    plan.highlight
                      ? 'bg-background text-foreground hover:bg-background/90'
                      : 'bg-foreground text-background hover:bg-foreground/90'
                  )}
                >
                  Start {plan.label}
                  <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14 sm:py-16 bg-surface-sunken/45">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-border bg-surface-elevated p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Credit Guide</h2>
            <div className="space-y-3 text-sm text-foreground-secondary">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                <span>Standard image generation modes</span>
                <strong className="text-foreground">4 credits</strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                <span>Upscale</span>
                <strong className="text-foreground">3 credits</strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                <span>PDF compression</span>
                <strong className="text-foreground">1 credit</strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                <span>Document translate</span>
                <strong className="text-foreground">8 credits</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Material validation</span>
                <strong className="text-foreground">12 credits</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Video (Pay Per Generation)</h2>
            <div className="space-y-3 text-sm text-foreground-secondary">
              {[
                ['kling-standard-5s', 'Kling Standard 5s'],
                ['kling-standard-10s', 'Kling Standard 10s'],
                ['kling-pro-10s', 'Kling Pro 10s'],
                ['veo-fast-5s', 'Veo Fast 5s'],
                ['veo-standard-8s', 'Veo Standard 8s'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-b-0 last:pb-0">
                  <span>{label}</span>
                  <strong className="text-foreground">${((VIDEO_PRICES_CENTS[key] ?? 0) / 100).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 text-center">
          <h3 className="text-3xl sm:text-[40px] tracking-tight text-foreground font-semibold">Need a faster pilot for your team?</h3>
          <p className="mt-4 text-sm sm:text-base text-foreground-secondary max-w-2xl mx-auto leading-relaxed">
            Start with a commercial plan today and move your first client workflow through the platform in one afternoon.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-11 px-6 rounded-xl bg-foreground text-background text-sm font-semibold inline-flex items-center gap-2 hover:bg-foreground/90 transition-colors"
            >
              Create free account
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="h-11 px-6 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-sunken transition-colors"
            >
              Back to homepage
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function TermsPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(to_bottom,#fafaf8,#f4f4f0)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Legal</p>
          <h1 className="mt-3 text-4xl sm:text-[52px] tracking-tight leading-[1.03] text-foreground font-semibold">Terms of Service</h1>
          <p className="mt-4 text-sm sm:text-base text-foreground-secondary max-w-3xl leading-relaxed">
            These terms govern access to and use of ArchViz AI Studio for commercial and professional usage.
          </p>
          <p className="mt-3 text-xs text-foreground-muted">Last updated: April 21, 2026</p>
        </div>
      </section>

      <section className="py-12 sm:py-14">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-border bg-surface-elevated p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-3">Sections</p>
              <nav className="space-y-2">
                {TERMS_SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block text-sm text-foreground-muted hover:text-foreground transition-colors"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-8">
            {TERMS_SECTIONS.map((section) => (
              <article key={section.id} id={section.id} className="rounded-xl border border-border bg-surface-elevated p-5 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm text-foreground-secondary leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function LandingPage() {
  const [route, setRoute] = useState<PublicRoute>(() => routeFromPath(window.location.pathname));
  const [showAuth, setShowAuth] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const navigate = useCallback((nextRoute: PublicRoute) => {
    const targetPath = pathFromRoute(nextRoute);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow || 'hidden';
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(routeFromPath(window.location.pathname));
      window.scrollTo({ top: 0 });
    };

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      setScrollY(y);
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setHeroReady(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const content = useMemo(() => {
    if (route === 'pricing') {
      return <PricingPage onOpenAuth={() => setShowAuth(true)} onNavigateHome={() => navigate('home')} />;
    }
    if (route === 'terms') {
      return <TermsPage />;
    }
    return (
      <HomePage
        heroReady={heroReady}
        scrollY={scrollY}
        onNavigatePricing={() => navigate('pricing')}
        onOpenAuth={() => setShowAuth(true)}
        openFaq={openFaq}
        setOpenFaq={setOpenFaq}
      />
    );
  }, [route, heroReady, scrollY, openFaq, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SiteHeader route={route} scrolled={scrolled} onNavigate={navigate} onOpenAuth={() => setShowAuth(true)} />

      <main>{content}</main>

      <SiteFooter onNavigate={navigate} />

      {showAuth && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated shadow-elevated overflow-hidden relative">
            <button
              type="button"
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors inline-flex items-center justify-center"
              aria-label="Close sign in dialog"
            >
              <X size={15} />
            </button>

            <div className="px-7 pt-7 pb-5 border-b border-border">
              <Brand />
            </div>

            <div className="px-7 py-6">
              <LoginForm />
            </div>

            <div className="px-7 pb-6 text-center">
              <p className="text-[11px] text-foreground-muted">
                By continuing you agree to our{' '}
                <a
                  href="/terms"
                  onClick={(event) => {
                    event.preventDefault();
                    setShowAuth(false);
                    navigate('terms');
                  }}
                  className="underline hover:text-foreground transition-colors"
                >
                  Terms
                </a>{' '}
                and{' '}
                <a
                  href="/terms#privacy"
                  onClick={(event) => {
                    event.preventDefault();
                    setShowAuth(false);
                    navigate('terms');
                    setTimeout(() => {
                      document.getElementById('privacy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                  className="underline hover:text-foreground transition-colors"
                >
                  Privacy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
