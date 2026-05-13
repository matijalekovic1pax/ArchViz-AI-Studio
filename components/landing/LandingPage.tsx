import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Languages,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { LoginForm } from '../auth/LoginPage';
import { CREDITS_PER_MODE, PLAN_CREDITS, PLAN_PRICES_USD, VIDEO_PRICES_CENTS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

type PublicRoute = 'home' | 'pricing' | 'terms';
type FeatureKey = 'render' | 'styles' | 'documents' | 'teams';

type Plan = {
  id: 'starter' | 'professional' | 'studio';
  label: string;
  price: number;
  credits: number;
  tagline: string;
  bestFor: string;
  highlight?: boolean;
  features: string[];
};

type WorkflowMode = {
  mode: keyof typeof CREDITS_PER_MODE;
  label: string;
  summary: string;
};

const SCREENSHOTS = {
  render: '/landing/app-render-output.png',
  styles: '/landing/style-library.png',
  source: '/landing/source-wireframe.png',
} as const;

const NAV_ITEMS: Array<{ label: string; route: PublicRoute }> = [
  { label: 'Product', route: 'home' },
  { label: 'Pricing', route: 'pricing' },
  { label: 'Terms', route: 'terms' },
];

const HERO_STATS = [
  ['3D, CAD, sketch', 'project inputs'],
  ['18+', 'production workflows'],
  ['PDF, DOCX, XLSX', 'document support'],
  ['Kling + Veo', 'motion outputs'],
];

const PRODUCT_PILLARS = [
  {
    icon: Sparkles,
    title: 'Render from real project inputs',
    body: 'Upload Rhino views, CAD drawings, sketches, plans, or references and produce polished image options without rebuilding the scene in a separate render tool.',
  },
  {
    icon: Wand2,
    title: 'Edit visuals after generation',
    body: 'Refine materials, furniture, landscape, lighting, composition, and image quality with focused tools made for architecture review cycles.',
  },
  {
    icon: Languages,
    title: 'Deliver more than images',
    body: 'Translate documents, compress large PDFs, validate material schedules, and create short motion assets in the same account workflow.',
  },
];

const FEATURE_EXPLORER: Record<
  FeatureKey,
  {
    label: string;
    title: string;
    description: string;
    image?: string;
    imageLabel?: string;
    bullets: string[];
  }
> = {
  render: {
    label: 'Rendering',
    title: 'Move from source model to client image in one browser workspace.',
    description:
      'ArchViz Studio keeps the model view, style controls, generation mode, prompt, and final output close together so a team can iterate while the client direction is still fresh.',
    image: SCREENSHOTS.render,
    imageLabel: 'Rendered output inside the product workspace',
    bullets: ['3D to Render, CAD to Render, Sketch to Render, and Masterplan modes', 'Enhance, Stylize, Hybrid, Strict Realism, and Concept Push generation options', 'Download-ready visuals for proposals, listings, presentations, and review decks'],
  },
  styles: {
    label: 'Style Library',
    title: 'Sell options instead of a single interpretation.',
    description:
      'A dedicated style library lets users move between contemporary, cultural, commercial, residential, sustainable, and conceptual directions without losing the project context.',
    image: SCREENSHOTS.styles,
    imageLabel: 'The in-app style library with real product categories',
    bullets: ['Searchable style library with category filters', 'Reusable visual directions for repeat client work', 'Consistent previews across render, edit, and scene workflows'],
  },
  documents: {
    label: 'Documents',
    title: 'Keep delivery work in the same commercial service.',
    description:
      'The product is not just image generation. It supports the document and coordination tasks that often decide whether a studio can ship work on time.',
    bullets: ['Translate PDF, DOCX, and XLSX files for international handoffs', 'Validate BoQ and material schedules across PDF, CSV, XLS, and XLSX files', 'Compress large PDF packages before sending them to clients or contractors'],
  },
  teams: {
    label: 'Teams',
    title: 'Built for studios that pay, assign, review, and deliver together.',
    description:
      'Commercial accounts need credit visibility, member access, billing controls, and a clean sign-in path. The SaaS layer exposes those foundations without burying the product.',
    bullets: ['Monthly credit pools for image, document, validation, and utility workflows', 'Studio plans for shared access and team administration', 'Credit and video pricing shown before launch so users understand cost'],
  },
};

const WORKFLOW_GROUPS: Array<{
  title: string;
  description: string;
  modes: WorkflowMode[];
}> = [
  {
    title: 'Visual production',
    description: 'For concepts, proposals, marketing visuals, and fast option studies.',
    modes: [
      { mode: 'render-3d', label: '3D to Render', summary: 'Turn model views into polished architectural renders.' },
      { mode: 'render-cad', label: 'CAD to Render', summary: 'Transform linework into image directions for client review.' },
      { mode: 'render-sketch', label: 'Sketch to Render', summary: 'Develop early ideas into persuasive visual concepts.' },
      { mode: 'masterplan', label: 'Masterplan', summary: 'Present site plans with clearer atmosphere and context.' },
      { mode: 'scene-compose', label: 'Scene Compose', summary: 'Combine project references, backgrounds, and direction.' },
      { mode: 'multi-angle', label: 'Multi-angle', summary: 'Create consistent image sets from one visual direction.' },
    ],
  },
  {
    title: 'Refinement',
    description: 'For the detail changes that happen after the first promising output.',
    modes: [
      { mode: 'visual-edit', label: 'Visual Edit', summary: 'Replace, remove, or improve selected image areas.' },
      { mode: 'upscale', label: 'Upscale', summary: 'Increase output resolution for delivery and print use.' },
      { mode: 'exploded', label: 'Exploded View', summary: 'Create explanatory assembly visuals.' },
      { mode: 'section', label: 'Section View', summary: 'Generate readable cut-through presentation images.' },
      { mode: 'img-to-cad', label: 'Image to CAD', summary: 'Extract drawing-ready structure from visual references.' },
      { mode: 'img-to-3d', label: 'Image to 3D', summary: 'Move selected images toward 3D handoff.' },
    ],
  },
  {
    title: 'Commercial delivery',
    description: 'For files, checks, and motion assets that support paid client work.',
    modes: [
      { mode: 'document-translate', label: 'Document Translate', summary: 'Translate PDF, DOCX, and XLSX deliverables.' },
      { mode: 'material-validation', label: 'Material Validation', summary: 'Check schedules and specification files for mismatches.' },
      { mode: 'pdf-compression', label: 'PDF Compression', summary: 'Reduce bulky PDF packages before handoff.' },
      { mode: 'video', label: 'Video', summary: 'Generate short Kling or Veo motion outputs.' },
      { mode: 'generate-text', label: 'Generate', summary: 'Build prompt foundations and concept directions.' },
      { mode: 'headshot', label: 'Headshot', summary: 'Create team assets aligned with the studio brand.' },
    ],
  },
];

const PLANS: Plan[] = [
  {
    id: 'starter',
    label: 'Starter',
    price: PLAN_PRICES_USD.starter,
    credits: PLAN_CREDITS.starter,
    tagline: 'For freelancers and small proposal teams.',
    bestFor: 'Solo operators',
    features: ['600 monthly credits', 'Core rendering workflows', 'Visual edit and upscale', 'Credit history', 'Email support'],
  },
  {
    id: 'professional',
    label: 'Professional',
    price: PLAN_PRICES_USD.professional,
    credits: PLAN_CREDITS.professional,
    tagline: 'For studios shipping client visuals every week.',
    bestFor: 'Most architecture teams',
    highlight: true,
    features: ['2,000 monthly credits', 'Document translation', 'Material validation', 'Image to CAD and Image to 3D', 'Priority support'],
  },
  {
    id: 'studio',
    label: 'Studio',
    price: PLAN_PRICES_USD.studio,
    credits: PLAN_CREDITS.studio,
    tagline: 'For teams that need shared volume and billing control.',
    bestFor: 'Commercial production teams',
    features: ['6,000 shared credits', 'Team member management', 'Centralized billing', 'Production-ready workflows', 'Priority onboarding'],
  },
];

const VIDEO_PRICING = Object.entries(VIDEO_PRICES_CENTS).map(([key, cents]) => {
  const [provider, quality, duration] = key.split('-');
  return {
    label: `${provider.toUpperCase()} ${quality} ${duration}`,
    price: cents / 100,
  };
});

const FAQ_ITEMS = [
  {
    question: 'Can a customer use this without a rendering specialist?',
    answer:
      'Yes. The interface is designed around clear project inputs, generation modes, style selection, and downloadable outputs so non-specialist team members can produce strong first passes.',
  },
  {
    question: 'How do credits work?',
    answer:
      'Image, document, validation, compression, and utility workflows consume credits. The app displays costs before launch. Video jobs are priced separately by provider and duration.',
  },
  {
    question: 'Which files are supported?',
    answer:
      'Visual workflows use image-based project inputs and references. Document tools support PDF, DOCX, XLSX, CSV, and XLS depending on the workflow.',
  },
  {
    question: 'Is this only for concept renders?',
    answer:
      'No. Concept images are one workflow, but the service also handles edits, upscales, sections, exploded views, document translation, material validation, PDF compression, and video generation.',
  },
];

const TERMS_SECTIONS = [
  {
    id: 'service',
    title: '1. Service',
    paragraphs: [
      'ArchViz Studio provides AI-assisted rendering, visual editing, document processing, validation, compression, and video generation tools for architecture and design teams.',
      'Users are responsible for ensuring that uploaded project files, references, prompts, and generated outputs can be used for their intended client or commercial purpose.',
    ],
  },
  {
    id: 'accounts',
    title: '2. Accounts and billing',
    paragraphs: [
      'Paid plans include a recurring monthly credit allocation. Credits are consumed when eligible workflows are launched. Video jobs are billed separately where applicable.',
      'Organizations are responsible for managing account access, team members, payment details, and any usage initiated by invited users.',
    ],
  },
  {
    id: 'outputs',
    title: '3. Generated outputs',
    paragraphs: [
      'AI outputs may require professional review before being used in construction, permitting, procurement, marketing, or client delivery.',
      'ArchViz Studio does not guarantee that generated images, documents, or validation reports are free from omissions, hallucinations, or project-specific inaccuracies.',
    ],
  },
  {
    id: 'privacy',
    title: '4. Privacy and data',
    paragraphs: [
      'Uploaded files and generated assets are processed to provide the requested service. Account data, billing data, and generation history may be stored to operate the product.',
      'Do not upload confidential, regulated, or third-party restricted materials unless you have the required rights and approvals.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable use',
    paragraphs: [
      'Users may not use the service for unlawful content, misleading impersonation, credential theft, malware, or attempts to bypass platform limits and security controls.',
      'ArchViz Studio may suspend or restrict access when usage threatens service reliability, violates these terms, or creates legal or safety risk.',
    ],
  },
  {
    id: 'liability',
    title: '6. Limitation of liability',
    paragraphs: [
      'The service is provided on an as-available basis. To the maximum extent permitted by law, ArchViz Studio is not liable for indirect damages, lost profits, project delays, or downstream decisions made from generated outputs.',
      'These terms are a commercial placeholder and should be reviewed by legal counsel before public launch.',
    ],
  },
];

function routeFromPath(pathname: string): PublicRoute {
  if (pathname.startsWith('/pricing')) return 'pricing';
  if (pathname.startsWith('/terms')) return 'terms';
  return 'home';
}

function pathFromRoute(route: PublicRoute) {
  if (route === 'pricing') return '/pricing';
  if (route === 'terms') return '/terms';
  return '/';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function Brand({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const light = tone === 'light';

  return (
    <div className="flex items-center gap-3 select-none">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-subtle',
          light ? 'bg-white text-foreground' : 'bg-foreground text-surface-elevated'
        )}
      >
        <span className="text-sm font-bold leading-none">AV</span>
      </span>
      <span className="flex flex-col text-left">
        <span className={cn('text-sm font-bold leading-tight', light ? 'text-white' : 'text-foreground')}>ArchViz Studio</span>
        <span className={cn('text-[11px] leading-tight', light ? 'text-white/55' : 'text-foreground-muted')}>AI rendering service</span>
      </span>
    </div>
  );
}

function SiteHeader({
  route,
  scrolled,
  onNavigate,
  onOpenAuth,
}: {
  route: PublicRoute;
  scrolled: boolean;
  onNavigate: (route: PublicRoute) => void;
  onOpenAuth: () => void;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-all duration-300',
        scrolled ? 'border-border bg-background/92 shadow-subtle backdrop-blur-xl' : 'border-border/80 bg-background/86 backdrop-blur-lg'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <button type="button" onClick={() => onNavigate('home')} className="shrink-0" aria-label="Go to homepage">
          <Brand />
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.route}
              href={pathFromRoute(item.route)}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.route);
              }}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                route === item.route ? 'bg-surface-sunken text-foreground' : 'text-foreground-muted hover:bg-surface-sunken hover:text-foreground'
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
            className="hidden h-9 items-center rounded-lg px-3 text-sm font-semibold text-foreground-muted transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            Start now
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroSection({
  heroReady,
  onOpenAuth,
  onNavigatePricing,
}: {
  heroReady: boolean;
  onOpenAuth: () => void;
  onNavigatePricing: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-foreground text-white">
      <img
        src={SCREENSHOTS.render}
        alt="ArchViz Studio rendering workspace showing a client-ready interior render"
        className={cn(
          'absolute inset-0 h-full w-full object-cover object-center transition duration-700',
          heroReady ? 'scale-100 opacity-55' : 'scale-[1.03] opacity-0'
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/62 to-black/20" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="relative mx-auto flex min-h-[74svh] max-w-7xl flex-col justify-end px-5 pb-8 pt-24 sm:px-6 lg:min-h-[78svh] lg:pb-10">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md">
            <Sparkles size={14} />
            AI rendering, editing, and delivery for architecture teams
          </div>
          <h1 className="text-5xl font-semibold leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">ArchViz Studio</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/76 sm:text-lg">
            Create client-ready architectural visuals from real project files, then handle edits, translated documents, material checks,
            compressed PDFs, and short video outputs from the same commercial workspace.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
            >
              Start rendering
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={onNavigatePricing}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/25 bg-white/8 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/14"
            >
              View pricing
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/14 bg-white/14 sm:grid-cols-2 lg:grid-cols-4">
          {HERO_STATS.map(([value, label]) => (
            <div key={label} className="bg-black/28 px-4 py-4 backdrop-blur-md">
              <p className="text-sm font-semibold text-white">{value}</p>
              <p className="mt-1 text-xs text-white/58">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPillars() {
  return (
    <section className="bg-background py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {PRODUCT_PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-lg border border-border bg-surface-elevated p-5 shadow-subtle">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                  <Icon size={18} />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ScreenshotFrame({
  src,
  alt,
  label,
  caption,
  dark,
}: {
  src: string;
  alt: string;
  label: string;
  caption: string;
  dark?: boolean;
}) {
  return (
    <figure className={cn('overflow-hidden rounded-xl border shadow-elevated', dark ? 'border-white/12 bg-white/6' : 'border-border bg-surface-elevated')}>
      <div className={cn('flex items-center justify-between border-b px-4 py-3', dark ? 'border-white/12 text-white/75' : 'border-border text-foreground-muted')}>
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
        <span className={cn('h-2 w-2 rounded-full', dark ? 'bg-emerald-300' : 'bg-accent')} />
      </div>
      <img src={src} alt={alt} className="aspect-[16/9] w-full object-cover object-top" />
      <figcaption className={cn('px-4 py-3 text-sm leading-relaxed', dark ? 'text-white/68' : 'text-foreground-secondary')}>{caption}</figcaption>
    </figure>
  );
}

function SourceToRenderSection() {
  return (
    <section id="product" className="bg-surface-elevated py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Actual product flow</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              From source model to client presentation image.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground-secondary">
              A model view comes in, the user selects generation behavior and style direction, and the service produces a polished render that can be sent to a client.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ScreenshotFrame
              src={SCREENSHOTS.source}
              alt="ArchViz Studio source model view before rendering"
              label="Input"
              caption="A Rhino-style model view with source settings, style selection, and generation controls."
            />
            <ScreenshotFrame
              src={SCREENSHOTS.render}
              alt="ArchViz Studio generated interior render"
              label="Output"
              caption="A finished render previewed inside the same workspace and ready for export."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureExplorer() {
  const [active, setActive] = useState<FeatureKey>('render');
  const item = FEATURE_EXPLORER[active];

  return (
    <section className="bg-foreground py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Feature coverage</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">The commercial product has to show the breadth of the studio.</h2>
          <p className="mt-4 text-base leading-relaxed text-white/65">
            Customers should immediately understand that this is a paid service for visual production, project iteration, and delivery work.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
            {(Object.keys(FEATURE_EXPLORER) as FeatureKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors',
                  active === key ? 'border-white/20 bg-white text-foreground' : 'border-white/12 bg-white/6 text-white/68 hover:bg-white/10 hover:text-white'
                )}
              >
                {FEATURE_EXPLORER[key].label}
                <ArrowRight size={14} className={cn(active === key ? 'text-foreground' : 'text-white/35')} />
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              {item.image ? (
                <ScreenshotFrame src={item.image} alt={item.imageLabel || item.title} label={item.label} caption={item.imageLabel || item.title} dark />
              ) : (
                <div className="rounded-xl border border-white/12 bg-white/6 p-5 shadow-elevated">
                  <div className="rounded-lg border border-white/10 bg-black/24 p-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <span className="text-sm font-semibold text-white">Delivery queue</span>
                      <span className="rounded-full bg-emerald-300 px-2 py-1 text-[11px] font-semibold text-foreground">Ready</span>
                    </div>
                    {[
                      ['translated-specifications.docx', 'Document Translate'],
                      ['boq-validation-report.xlsx', 'Material Validation'],
                      ['client-presentation-compressed.pdf', 'PDF Compression'],
                      ['walkthrough-preview.mp4', 'Video'],
                    ].map(([file, mode]) => (
                      <div key={file} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-white">{file}</p>
                          <p className="mt-1 text-xs text-white/45">{mode}</p>
                        </div>
                        <Download size={15} className="text-white/45" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-2xl font-semibold leading-tight text-white">{item.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-white/66">{item.description}</p>
              <ul className="mt-6 space-y-3">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-relaxed text-white/76">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowGrid() {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">What customers can buy</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">A complete production menu, not a single render demo.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-foreground-secondary">
            Pricing and feature copy should make the service legible to firms comparing tools, budgets, and team workflows.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {WORKFLOW_GROUPS.map((group) => (
            <article key={group.title} className="rounded-lg border border-border bg-surface-elevated p-5 shadow-subtle">
              <h3 className="text-lg font-semibold text-foreground">{group.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{group.description}</p>
              <div className="mt-5 space-y-3">
                {group.modes.map((mode) => (
                  <div key={mode.label} className="rounded-lg border border-border bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{mode.label}</p>
                      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-foreground-muted">
                        {mode.mode === 'video' ? 'paid' : `${CREDITS_PER_MODE[mode.mode]} cr`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{mode.summary}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CustomerOutcomeSection() {
  const outcomes = [
    ['Proposal speed', 'Produce first-pass imagery while the commercial direction is still being discussed.'],
    ['Visual control', 'Use style categories, generation modes, targeted edits, and upscales to improve the exact output a client sees.'],
    ['Delivery support', 'Translate, validate, compress, and package project files without forcing the team into another service.'],
    ['Team economics', 'Credits, video pricing, plan levels, and shared studio access are visible before the customer commits.'],
  ];

  return (
    <section className="bg-surface-elevated py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Customer value</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">Built around the work clients actually pay for.</h2>
          <p className="mt-4 text-base leading-relaxed text-foreground-secondary">
            Upload project material, generate stronger visual options, edit them quickly, and deliver files the client can use.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {outcomes.map(([title, body]) => (
            <article key={title} className="rounded-lg border border-border bg-background p-5">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ onOpenAuth, onNavigatePricing }: { onOpenAuth: () => void; onNavigatePricing: () => void }) {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="overflow-hidden rounded-xl bg-foreground text-white shadow-elevated">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_420px] lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Ready for commercial use</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                Start producing client-ready architecture visuals today.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/66">
                Use real project inputs, select the right visual direction, refine the output, and deliver the files your client needs from one commercial workspace.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
                >
                  Start now
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={onNavigatePricing}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/18 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/8"
                >
                  Compare plans
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/6 p-4">
              {[
                ['Starter', `${PLAN_CREDITS.starter.toLocaleString()} credits`],
                ['Professional', `${PLAN_CREDITS.professional.toLocaleString()} credits`],
                ['Studio', `${PLAN_CREDITS.studio.toLocaleString()} shared credits`],
              ].map(([name, detail]) => (
                <div key={name} className="flex items-center justify-between border-b border-white/10 py-3 first:pt-0 last:border-0 last:pb-0">
                  <span className="text-sm font-semibold text-white">{name}</span>
                  <span className="text-sm text-white/55">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomePage({
  heroReady,
  onNavigatePricing,
  onOpenAuth,
}: {
  heroReady: boolean;
  onNavigatePricing: () => void;
  onOpenAuth: () => void;
}) {
  return (
    <>
      <HeroSection heroReady={heroReady} onOpenAuth={onOpenAuth} onNavigatePricing={onNavigatePricing} />
      <ProductPillars />
      <SourceToRenderSection />
      <FeatureExplorer />
      <WorkflowGrid />
      <CustomerOutcomeSection />
      <CTASection onOpenAuth={onOpenAuth} onNavigatePricing={onNavigatePricing} />
    </>
  );
}

function PlanCard({ plan, onOpenAuth }: { plan: Plan; onOpenAuth: () => void }) {
  return (
    <article
      className={cn(
        'relative flex flex-col rounded-xl border p-6 shadow-subtle',
        plan.highlight ? 'border-foreground bg-foreground text-white shadow-elevated' : 'border-border bg-surface-elevated text-foreground'
      )}
    >
      {plan.highlight && (
        <div className="absolute right-5 top-5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground">Recommended</div>
      )}
      <p className={cn('text-sm font-semibold', plan.highlight ? 'text-white/70' : 'text-foreground-muted')}>{plan.bestFor}</p>
      <h2 className="mt-3 text-2xl font-semibold">{plan.label}</h2>
      <p className={cn('mt-2 min-h-[44px] text-sm leading-relaxed', plan.highlight ? 'text-white/65' : 'text-foreground-secondary')}>{plan.tagline}</p>

      <div className="mt-6 flex items-end gap-2">
        <span className="text-4xl font-semibold">{formatCurrency(plan.price)}</span>
        <span className={cn('pb-1 text-sm', plan.highlight ? 'text-white/55' : 'text-foreground-muted')}>/month</span>
      </div>
      <p className={cn('mt-2 text-sm', plan.highlight ? 'text-white/65' : 'text-foreground-muted')}>
        {plan.credits.toLocaleString()} credits included
      </p>

      <button
        type="button"
        onClick={onOpenAuth}
        className={cn(
          'mt-6 inline-flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
          plan.highlight ? 'bg-white text-foreground hover:bg-white/90' : 'bg-foreground text-background hover:bg-foreground/90'
        )}
      >
        Choose {plan.label}
      </button>

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className={cn('flex gap-3 text-sm leading-relaxed', plan.highlight ? 'text-white/72' : 'text-foreground-secondary')}>
            <Check size={16} className={cn('mt-0.5 shrink-0', plan.highlight ? 'text-emerald-300' : 'text-accent')} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CreditEconomics() {
  const rows = [
    ['Most render and edit workflows', `${CREDITS_PER_MODE['render-3d']} credits/run`],
    ['Upscale', `${CREDITS_PER_MODE['upscale']} credits/run`],
    ['PDF Compression', `${CREDITS_PER_MODE['pdf-compression']} credit/run`],
    ['Document Translate', `${CREDITS_PER_MODE['document-translate']} credits/run`],
    ['Material Validation', `${CREDITS_PER_MODE['material-validation']} credits/run`],
  ];

  return (
    <section className="bg-surface-elevated py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Credit clarity</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">Customers can understand cost before they click generate.</h2>
          <p className="mt-4 text-base leading-relaxed text-foreground-secondary">
            The SaaS layer should make the commercial model obvious: monthly plans include credits, video is priced by provider, and high-cost workflows are clearly labeled.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-border bg-background p-5">
            <h3 className="text-lg font-semibold text-foreground">Workflow credits</h3>
            <div className="mt-4 space-y-3">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0">
                  <span className="text-foreground-secondary">{label}</span>
                  <span className="font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-border bg-background p-5">
            <h3 className="text-lg font-semibold text-foreground">Video pricing</h3>
            <div className="mt-4 space-y-3">
              {VIDEO_PRICING.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0">
                  <span className="text-foreground-secondary">{item.label}</span>
                  <span className="font-semibold text-foreground">{formatCurrency(item.price)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function PricingPage({ onOpenAuth, onNavigateHome }: { onOpenAuth: () => void; onNavigateHome: () => void }) {
  return (
    <>
      <section className="bg-foreground text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Pricing</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Plans for firms that need repeatable visual production.</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/66">
              Start with a monthly credit plan, add video generation when a project needs motion, and move to Studio when multiple people need shared access.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
              >
                Create account
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={onNavigateHome}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/18 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/8"
              >
                See product
              </button>
            </div>
          </div>
          <ScreenshotFrame
            src={SCREENSHOTS.styles}
            alt="ArchViz Studio style library used for pricing page product context"
            label="Product context"
            caption="Pricing is attached to a real workspace with rendering, style selection, documents, and delivery tools."
            dark
          />
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onOpenAuth={onOpenAuth} />
            ))}
          </div>
        </div>
      </section>

      <CreditEconomics />

      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Questions</p>
            <h2 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Common buying questions</h2>
          </div>
          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <details key={item.question} className="group rounded-lg border border-border bg-surface-elevated p-5 shadow-subtle" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-foreground">
                  {item.question}
                  <ChevronDown size={17} className="shrink-0 text-foreground-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function TermsPage() {
  return (
    <>
      <section className="bg-foreground text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Terms</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Terms of service for ArchViz Studio.</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/66">
            Plain-language commercial terms for customers using the rendering, document, validation, compression, and video tools.
          </p>
        </div>
      </section>

      <section className="bg-background py-14 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-border bg-surface-elevated p-4 shadow-subtle">
              <p className="mb-3 text-sm font-semibold text-foreground">Sections</p>
              <nav className="space-y-2">
                {TERMS_SECTIONS.map((section) => (
                  <a key={section.id} href={`#${section.id}`} className="block text-sm leading-relaxed text-foreground-muted transition-colors hover:text-foreground">
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-4">
            {TERMS_SECTIONS.map((section) => (
              <article key={section.id} id={section.id} className="rounded-lg border border-border bg-surface-elevated p-5 shadow-subtle sm:p-6">
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-foreground-secondary">
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

function SiteFooter({ onNavigate }: { onNavigate: (route: PublicRoute) => void }) {
  return (
    <footer className="border-t border-border bg-foreground text-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Brand tone="light" />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/66">
            AI rendering, visual editing, document processing, validation, and motion generation for architecture teams.
          </p>
          <p className="mt-4 text-xs text-white/45">Copyright {new Date().getFullYear()} ArchViz Studio</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.route}
              href={pathFromRoute(item.route)}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.route);
              }}
              className="text-white/58 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <a href="mailto:hello@archviz.ai" className="text-white/58 transition-colors hover:text-white">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const [route, setRoute] = useState<PublicRoute>(() => routeFromPath(window.location.pathname));
  const [showAuth, setShowAuth] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroReady, setHeroReady] = useState(false);

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
    const onScroll = () => setScrolled(window.scrollY > 8);

    window.addEventListener('popstate', onPopState);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setHeroReady(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const content = useMemo(() => {
    if (route === 'pricing') {
      return <PricingPage onOpenAuth={() => setShowAuth(true)} onNavigateHome={() => navigate('home')} />;
    }
    if (route === 'terms') {
      return <TermsPage />;
    }
    return <HomePage heroReady={heroReady} onNavigatePricing={() => navigate('pricing')} onOpenAuth={() => setShowAuth(true)} />;
  }, [route, heroReady, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SiteHeader route={route} scrolled={scrolled} onNavigate={navigate} onOpenAuth={() => setShowAuth(true)} />
      <main>{content}</main>
      <SiteFooter onNavigate={navigate} />

      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-elevated">
            <button
              type="button"
              onClick={() => setShowAuth(false)}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
              aria-label="Close sign in dialog"
            >
              <X size={15} />
            </button>

            <div className="border-b border-border px-7 pb-5 pt-7">
              <Brand />
            </div>

            <div className="px-7 py-6">
              <LoginForm />
            </div>

            <div className="px-7 pb-6 text-center">
              <p className="text-[11px] leading-relaxed text-foreground-muted">
                By continuing you agree to our{' '}
                <a
                  href="/terms"
                  onClick={(event) => {
                    event.preventDefault();
                    setShowAuth(false);
                    navigate('terms');
                  }}
                  className="underline transition-colors hover:text-foreground"
                >
                  Terms
                </a>{' '}
                and privacy terms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
