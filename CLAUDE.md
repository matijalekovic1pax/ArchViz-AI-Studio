# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run preview   # Build + run via Wrangler (Cloudflare Worker locally)
npm run deploy    # Build + deploy to Cloudflare Workers
```

No test or lint scripts are configured.

## Environment Variables

Create a `.env.local` file with:
```
VITE_GEMINI_API_KEY=                      # Google Gemini API key (required)
VITE_API_GATEWAY_URL=                     # Cloudflare Worker URL (default: http://localhost:8787)
VITE_PDF_CONVERTER_API_URL=               # Vercel PDF converter API URL
VITE_VEO_PROXY_URL=                       # Cloudflare Veo proxy URL
VITE_ILOVEPDF_PUBLIC_KEY=                 # iLovePDF API key (optional)
SUPABASE_URL=                             # Supabase project URL
SUPABASE_ANON_KEY=                        # Supabase anonymous key
VITE_STRIPE_STARTER_PRICE_ID=             # Stripe price ID for Starter plan
VITE_STRIPE_PROFESSIONAL_PRICE_ID=        # Stripe price ID for Professional plan
VITE_STRIPE_STUDIO_PRICE_ID=              # Stripe price ID for Studio (org) plan
VITE_STRIPE_CREDITS_500_PRICE_ID=         # Stripe price ID for 500 credit top-up
VITE_STRIPE_CREDITS_2000_PRICE_ID=        # Stripe price ID for 2000 credit top-up
```

## Architecture

**React + Vite + TypeScript** SPA with no backend (except two proxy services).

### Entry Point Flow
`index.html` → `index.tsx` → `App.tsx` → `AuthGate` (Supabase session check) → layout + mode-specific panels

### Auth & Billing Layer
- `components/auth/AuthGate.tsx` - Wraps the app; gates access behind Supabase auth. Exposes `useAuth()` hook with `user`, `session`, `plan`, `credits`, `org`.
- `components/auth/LoginPage.tsx` - Login/signup UI
- `components/landing/LandingPage.tsx` - Public landing page (shown when not authenticated)
- `components/billing/BillingPage.tsx` - Subscription management via Stripe
- `components/billing/TeamDashboard.tsx` - Org/team management
- `components/billing/UpgradeModal.tsx` - Upsell modal triggered when credits run out or gated mode is accessed
- `components/admin/AdminPanel.tsx` - Superadmin controls (role: 'superadmin')
- `lib/stripePrices.ts` - Plan tiers, credit costs per mode, video pricing. **Check here before hardcoding any pricing.**
- `lib/supabaseClient.ts` - Supabase client + full `Database` type definitions for all tables.
- `services/generationStorageService.ts` - Persists generation history to Supabase.

### Credit System
Each generation deducts credits from `CREDITS_PER_MODE` in `lib/stripePrices.ts`. Plans: `unsubscribed` (free trial, bonus modes only), `starter` (600 cr/mo), `professional` (2000 cr/mo), `studio` (6000 cr/mo, org). Video is pay-per-generation via Stripe (not credits). `PROFESSIONAL_ONLY_MODES` lists modes requiring Professional+.

### State Management
`store.tsx` - Zustand store with dispatch-based reducer pattern. `AppState` contains:
- `mode` - Current generation mode (17 modes total)
- `uploadedImage` - Input image
- `isGenerating` - Loading state
- `history` - Generation history
- `workflow` - Mode-specific settings typed per mode

### Generation Modes
`render-3d`, `render-cad`, `masterplan`, `visual-edit`, `exploded`, `section`, `render-sketch`, `multi-angle`, `upscale`, `img-to-cad`, `img-to-3d`, `video`, `material-validation`, `document-translate`, `pdf-compression`, `generate-text`, `headshot`

### Key Data Flow
1. User uploads image or enters settings → dispatched to Zustand store
2. `engine/promptEngine.ts` (4000+ lines) generates specialized prompts based on mode + settings
3. `services/apiGateway.ts` routes to Cloudflare Worker gateway (adds API keys server-side, verifies Supabase JWT)
4. Results returned to store, rendered in `components/canvas/ImageCanvas.tsx` (Three.js, 94KB)
5. `services/generationStorageService.ts` persists result to Supabase

### Services Layer (`services/`)
- `geminiService.ts` - Google Gemini API client (image/text generation)
- `apiGateway.ts` - Central gateway with Supabase JWT auth; all vendor calls go through here
- `videoGenerationService.ts`, `veoService.ts`, `klingService.ts` - Video generation (Veo2 + Kling)
- `documentTranslationService.ts`, `docxParserService.ts`, `docxRebuilderService.ts` - DOCX pipeline
- `xlsxParserService.ts`, `xlsxRebuilderService.ts` - Excel pipeline
- `pdfParser.ts`, `pdfConverterService.ts`, `ilovepdfService.ts` - PDF processing
- `materialValidationService.ts`, `materialValidationPipeline.ts` - Material validation workflow
- `cloudConvertService.ts`, `convertApiService.ts` - Alternative document conversion providers
- `translationService.ts` - Text translation (used by document-translate mode)

### UI Layout
Three-panel workspace:
- `components/panels/TopBar.tsx` - Mode selector and header
- `components/panels/left/LeftSidebar.tsx` - Mode-specific controls
- `components/panels/right/RightPanel.tsx` - Settings/adjustments
- `components/panels/bottom/BottomPanel.tsx` - History and tools
- `components/canvas/ImageCanvas.tsx` - Three.js canvas (main viewport)
- `components/panels/mobile/MobilePanels.tsx` - Mobile-responsive panel layout

### Path Alias
`@/` maps to the repository root (configured in both `vite.config.ts` and `tsconfig.json`).

### External Infrastructure

**`cloudflare-worker/`** - Cloudflare Worker proxy for Google Vertex AI Veo video generation. Handles CORS, JWT auth, and long-polling for async operations. Deploy with Wrangler.

**`pdf-converter-api/`** - Python Vercel serverless API for PDF/DOCX conversion. Uses PyPDF2, python-docx, reportlab, and proxies to iLovePDF API. 10-second timeout on free tier.

### Internationalization
i18next with browser language detection. Translation files in `locales/` (en, es, fr). localStorage key: `i18nextLng`.

### Types
`types.ts` (2700+ lines) is the authoritative source for all TypeScript interfaces. Check here before creating new types. Supabase table types are in `lib/supabaseClient.ts`.
