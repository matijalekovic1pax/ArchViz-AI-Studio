# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run preview   # Preview production build
```

No test or lint scripts are configured.

## Environment Variables

Create a `.env.local` file with:
```
VITE_GEMINI_API_KEY=           # Google Gemini API key (required)
VITE_API_GATEWAY_URL=          # Cloudflare Worker URL (default: http://localhost:8787)
VITE_PDF_CONVERTER_API_URL=    # Vercel PDF converter API URL
VITE_VEO_PROXY_URL=            # Cloudflare Veo proxy URL
VITE_ILOVEPDF_PUBLIC_KEY=      # iLovePDF API key (optional)
```

## Architecture

**React + Vite + TypeScript** SPA with no backend (except two proxy services).

### Entry Point Flow
`index.html` → `index.tsx` → `App.tsx` (layout + keyboard shortcuts) → mode-specific panels

### State Management
`store.tsx` - Zustand store with dispatch-based reducer pattern. `AppState` contains:
- `mode` - Current generation mode (18 modes total)
- `uploadedImage` - Input image
- `isGenerating` - Loading state
- `history` - Generation history
- `workflow` - Mode-specific settings typed per mode

### Generation Modes
The app has 18 modes: `render-3d`, `render-cad`, `masterplan`, `visual-edit`, `exploded`, `section`, `render-sketch`, `multi-angle`, `upscale`, `img-to-cad`, `img-to-3d`, `video`, `material-validation`, `document-translate`, `pdf-compression`, `generate-text`, and more.

### Key Data Flow
1. User uploads image or enters settings → dispatched to Zustand store
2. `engine/promptEngine.ts` (4000+ lines) generates specialized prompts based on mode + settings
3. `services/apiGateway.ts` routes to appropriate external API (Gemini, Veo, Kling, etc.)
4. Results returned to store, rendered in `components/canvas/ImageCanvas.tsx` (Three.js, 94KB)

### Services Layer (`services/`)
- `geminiService.ts` - Google Gemini API client (image/text generation)
- `apiGateway.ts` - Central gateway with JWT auth
- `promptEngine.ts` is in `engine/` not `services/`
- `videoGenerationService.ts`, `veoService.ts`, `klingService.ts` - Video generation
- `documentTranslationService.ts`, `docxParserService.ts`, `docxRebuilderService.ts` - DOCX pipeline
- `xlsxParserService.ts`, `xlsxRebuilderService.ts` - Excel pipeline
- `pdfParser.ts`, `pdfConverterService.ts`, `ilovepdfService.ts` - PDF processing
- `materialValidationService.ts`, `materialValidationPipeline.ts` - Material validation workflow

### UI Layout
Three-panel workspace:
- `components/TopBar.tsx` - Mode selector and header
- `components/LeftSidebar.tsx` - Mode-specific controls (17 variations by mode)
- `components/RightPanel.tsx` - Settings/adjustments (17 variations by mode)
- `components/BottomPanel.tsx` - History and tools
- `components/canvas/ImageCanvas.tsx` - Three.js canvas (main viewport)

### Path Alias
`@/` maps to the repository root (configured in both `vite.config.ts` and `tsconfig.json`).

### External Infrastructure

**`cloudflare-worker/`** - Cloudflare Worker proxy for Google Vertex AI Veo video generation. Handles CORS, JWT auth, and long-polling for async operations. Deploy with Wrangler.

**`pdf-converter-api/`** - Python Vercel serverless API for PDF/DOCX conversion. Uses PyPDF2, python-docx, reportlab, and proxies to iLovePDF API. 10-second timeout on free tier.

### Internationalization
i18next with browser language detection. Translation files in `locales/` (en, es, fr). localStorage key: `i18nextLng`.

### Types
`types.ts` (2700+ lines) is the authoritative source for all TypeScript interfaces. Check here before creating new types.
