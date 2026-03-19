/**
 * Stripe price IDs — set these in .env.local after creating products in Stripe dashboard.
 * All prices in USD cents.
 */

export const STRIPE_PRICES = {
  starter:      import.meta.env.VITE_STRIPE_STARTER_PRICE_ID      as string | undefined,
  professional: import.meta.env.VITE_STRIPE_PROFESSIONAL_PRICE_ID as string | undefined,
  studio:       import.meta.env.VITE_STRIPE_STUDIO_PRICE_ID       as string | undefined,
  credits500:   import.meta.env.VITE_STRIPE_CREDITS_500_PRICE_ID  as string | undefined,
  credits2000:  import.meta.env.VITE_STRIPE_CREDITS_2000_PRICE_ID as string | undefined,
} as const;

export const PLAN_PRICES_USD = {
  starter:      29,
  professional: 79,
  studio:       199,
} as const;

export const PLAN_CREDITS = {
  starter:      600,
  professional: 2000,
  studio:       6000,
} as const;

export const PLAN_LABELS = {
  unsubscribed: 'Free Trial',
  starter:      'Starter',
  professional: 'Professional',
  studio:       'Studio',
  enterprise:   'Enterprise',
} as const;

/** Credit costs per generation mode */
export const CREDITS_PER_MODE: Record<string, number> = {
  'render-3d':           4,
  'render-cad':          4,
  'render-sketch':       4,
  'masterplan':          4,
  'visual-edit':         4,
  'exploded':            4,
  'section':             4,
  'multi-angle':         4,
  'headshot':            4,
  'generate-text':       4,
  'upscale':             3,
  'pdf-compression':     1,
  'img-to-cad':          4,
  'img-to-3d':           4,
  'document-translate':  8,
  'material-validation': 12,
  'video':               0, // video is pay-per-gen via Stripe
};

/** Modes available on the signup bonus (unsubscribed users) */
export const BONUS_MODES = ['render-3d', 'render-cad'] as const;

/** Modes requiring Professional or higher */
export const PROFESSIONAL_ONLY_MODES = [
  'img-to-cad',
  'img-to-3d',
  'document-translate',
  'material-validation',
  'pdf-compression',
] as const;

/** Video pricing — key format: `${provider}-${quality}-${duration}s` */
export const VIDEO_PRICES_CENTS: Record<string, number> = {
  'kling-standard-5s':  25,
  'kling-standard-10s': 50,
  'kling-pro-10s':      85,
  'veo-fast-5s':        95,
  'veo-standard-8s':    399,
};

export type UserPlan = 'unsubscribed' | 'starter' | 'professional';
export type OrgPlan  = 'studio' | 'enterprise';
