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
VITE_GOOGLE_CLIENT_ID=         # Google OAuth client ID (required for login)
VITE_ALLOWED_DOMAIN=           # Email domain allowed to sign in (e.g. company.com)
VITE_API_GATEWAY_URL=          # Cloudflare Worker gateway URL (default: http://localhost:8787)
VITE_CONVERTAPI_SECRET=        # ConvertAPI secret for document conversion (optional)
VITE_ILOVEPDF_PUBLIC_KEY=      # iLovePDF API key (optional)
```

## Architecture

**React + Vite + TypeScript** SPA. All vendor API calls (Gemini, video, etc.) go through a Cloudflare Worker gateway — no API secrets in the client bundle.

### Entry Point Flow
`index.html` → `index.tsx` → `App.tsx` → `AuthGate` (Google session check) → layout + mode-specific panels

### Auth Layer
- `components/auth/AuthGate.tsx` - Wraps the app; gates access behind Google Sign-In. Exposes `useAuth()` returning `{ user, isAuthenticated, login, logout }`.
- `lib/googleAuth.ts` - Google Identity Services integration. On login, exchanges the Google ID token with the gateway for a short-lived JWT. User profile (name/email/picture) stored in `sessionStorage`; JWT is **in-memory only**.
- `services/apiGateway.ts` - Holds the in-memory JWT and attaches it as a `Bearer` header on all gateway requests. Auto-calls `setOnSessionExpired` callback on 401.

### State Management
`store.tsx` - React Context + `useReducer` (not Zustand, despite the filename). Access via `useAppStore()` which returns `{ state, dispatch }`. `AppState` contains:
- `mode` - Current generation mode
- `uploadedImage` - Input image (base64)
- `isGenerating` - Loading state
- `history` - In-session generation history
- `workflow` - Mode-specific settings, typed per mode in `types.ts`
- `appAlert` - Global toast/banner alert

### Generation Modes
`generate-text`, `render-3d`, `scene-compose`, `render-cad`, `masterplan`, `visual-edit`, `exploded`, `section`, `render-sketch`, `multi-angle`, `upscale`, `img-to-cad`, `video`, `material-validation`, `document-translate`, `pdf-compression`, `headshot`

Authoritative list is the `GenerationMode` union in `types.ts`.

**Special rendering paths in `App.tsx`:**
- `material-validation` → `<MaterialValidationView />` (full-page custom UI)
- `document-translate` → `<DocumentTranslateView />` (full-page custom UI)
- `pdf-compression` → `<PdfCompressionView />` (full-page custom UI)
- `generate-text` → canvas view, but left sidebar is hidden
- All other modes → standard three-panel layout with `<ImageCanvas />`

### Key Data Flow
1. User uploads image or enters settings → dispatched to store
2. `engine/promptEngine.ts` (4000+ lines) generates specialized prompts based on mode + workflow settings
3. `hooks/useGeneration.ts` - central orchestrator: store state → prompt engine → API calls → result dispatch. Start here when tracing any generation end-to-end.
4. `services/apiGateway.ts` routes to the Cloudflare Worker gateway (attaches JWT, adds API keys server-side)
5. Results returned to store; `components/canvas/ImageCanvas.tsx` renders them (Three.js)

`TEXT_ONLY_MODES` (`material-validation`, `document-translate`) skip the image-upload requirement in `useGeneration.ts`. `pdf-compression` has its own separate code path (not via the prompt engine).

### Services Layer (`services/`)
- `geminiService.ts` - Gemini API client (routes through gateway)
- `apiGateway.ts` - JWT management + all gateway routing
- `videoGenerationService.ts`, `veoService.ts`, `klingService.ts` - Video generation (Veo2 + Kling)
- `documentTranslationService.ts`, `docxParserService.ts`, `docxRebuilderService.ts` - DOCX pipeline
- `xlsxParserService.ts`, `xlsxRebuilderService.ts` - Excel pipeline
- `pdfParser.ts`, `pdfConverterService.ts`, `ilovepdfService.ts` - PDF processing
- `materialValidationService.ts`, `materialValidationPipeline.ts` - Material validation workflow
- `cloudConvertService.ts`, `convertApiService.ts` - Alternative document conversion providers
- `translationService.ts` - Text translation (used by document-translate)

### UI Layout
Three-panel workspace:
- `components/panels/TopBar.tsx` - Mode selector and header
- `components/panels/left/LeftSidebar.tsx` - Mode-specific controls (delegates to `Left<Mode>Panel.tsx`)
- `components/panels/right/RightPanel.tsx` - Settings/adjustments (delegates to `<Mode>Panel.tsx` in `right/`)
- `components/panels/bottom/BottomPanel.tsx` - History and tools
- `components/canvas/ImageCanvas.tsx` - Three.js canvas (main viewport)
- `components/panels/mobile/MobilePanels.tsx` - Mobile-responsive panel layout

Each mode gets two panel components: `left/Left<Mode>Panel.tsx` and `right/<Mode>Panel.tsx`. `SharedLeftComponents.tsx` and `SharedRightComponents.tsx` contain reusable primitives.

### Deployment
Deployed to Cloudflare Workers with SPA fallback (`not_found_handling: "single-page-application"` in `wrangler.jsonc`).

### Path Alias
`@/` maps to the repository root (not `src/`), configured in `vite.config.ts` and `tsconfig.json`.

### External Infrastructure

**`cloudflare-worker/`** - Cloudflare Worker proxy for Google Vertex AI Veo video generation. Handles CORS and long-polling for async operations. Deploy with Wrangler.

**`pdf-converter-api/`** - Python Vercel serverless API for PDF/DOCX conversion. Uses PyPDF2, python-docx, reportlab, and proxies to iLovePDF API. 10-second timeout on free tier.

### Internationalization
i18next with browser language detection. Translation files in `locales/` (en, es, fr, zh).

### Keyboard Shortcuts
Defined in `App.tsx` via `ShortcutsListener`:
- `Cmd/Ctrl + Enter` - Trigger generation
- `Cmd/Ctrl + 1-9` - Switch between generation modes

### Adding a New Generation Mode
1. Add the mode string to `GenerationMode` union in `types.ts`
2. Add workflow settings type and initial state in `store.tsx`
3. Add prompt generation logic in `engine/promptEngine.ts`
4. Create `components/panels/left/Left<Mode>Panel.tsx` (inputs/controls)
5. Create `components/panels/right/<Mode>Panel.tsx` (output settings)
6. Register in `LeftSidebar.tsx` and `RightPanel.tsx` switch statements
7. Handle in `hooks/useGeneration.ts` if it needs special logic (e.g. `TEXT_ONLY_MODES` or custom view)

### Types
`types.ts` (2700+ lines) is the authoritative source for all TypeScript interfaces. Check here before creating new types.
