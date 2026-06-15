<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ArchViz AI Studio

ArchViz AI Studio is an authenticated architectural AI workspace for image generation, targeted visual editing, scene composition, CAD/sketch workflows, video, document translation, material validation, PDF compression, feedback reporting, and an embedded in-app assistant.

View the original AI Studio app: https://ai.studio/apps/drive/1dhq8Xt9KgeJIXv7KFA1LUBAnopRoSxxF

## Current feature set

The app exposes 18 active workflows:

- Generate from Text
- 3D Rendering
- Scene Compose
- CAD to Render
- Sketch to Render
- Masterplan
- Visual Edit
- Angle Change
- Exploded View
- Section Render
- Multi-Angle
- Upscale
- Image to CAD
- Headshot Studio
- Video Studio
- Material Validation
- Document Translate
- PDF Compression

The top bar includes an Image Model selector:

- Nano Banana Pro: primary model for new photorealistic architectural renderings, source-to-render transformations, color, HDR feel, tone, lighting, atmosphere, and render polish.
- ChatGPT Image Generation 2: OpenAI `gpt-image-2` path for specific edits to existing or already rendered images, stronger preservation, controlled masks/selections, object/material changes, and text-heavy images.

The embedded App Assistant can inspect the current mode, uploaded images, selections, history, and settings; answer workflow questions; correct wrong-feature usage; apply validated setup actions across the active feature; create and select custom style presets; replace structured feature lists such as Masterplan zones, Exploded View components, Section areas, and manual Multi-Angle points; place attached chat images into supported image/reference slots; place attached documents/PDFs into translation, validation, and compression workflows; clear or remove those uploaded references, workflow documents, and queue items later; import attached project JSON when explicitly requested; switch app language, image models, modes, panels, and tabs; open feedback, admin, and documentation surfaces; trigger Visual Edit AI auto-selection; trigger AI helpers for Masterplan zone detection, Exploded View component detection, and Section area detection; undo/redo selection and custom boundary changes; cancel active generation; reset the project when explicitly requested; sign out when explicitly requested; trigger final generation when inputs are ready; export the current project JSON; export Material Validation reports; download the current image as PNG or JPG at full or medium resolution; and start downloads for existing generated outputs.

Assistant action batches support up to 16 validated changes at once, so one assistant response can set workflow controls, route several image/file attachments, trigger an operation, and clean up references without losing earlier changes in the same batch. Live assistant model calls require `VITE_API_GATEWAY_URL` plus a signed-in gateway session that stores the app JWT in the browser. In gated test mode, the assistant exposes sanitized live-readiness diagnostics for the gateway URL and session expiry without exposing the token.

## Run locally

Prerequisites: Node.js and Wrangler for the Cloudflare gateway.

1. Install dependencies:
   `npm install`
2. Create `.env.local` for the frontend:
   ```bash
   VITE_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
   VITE_ALLOWED_DOMAIN="your-company-domain.com"
   VITE_API_GATEWAY_URL="http://localhost:8787"
   ```
3. Configure gateway secrets in `cloudflare-worker`:
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put ALLOWED_DOMAIN
   wrangler secret put GEMINI_API_KEY
   wrangler secret put OPENAI_API_KEY
   ```
   Optional gateway secrets include `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_PROJECT_ID`, Kling provider keys, `CONVERTAPI_SECRET`, `ILOVEPDF_PUBLIC_KEY`, and Appwrite feedback secrets.
   Use `npm run setup:appwrite-feedback` with `.env.appwrite` to create the Appwrite feedback database, collections, indexes, admin seed, and snapshot bucket before setting the Worker `APPWRITE_*` secrets.
4. Run the gateway:
   ```bash
   cd cloudflare-worker
   wrangler dev
   ```
5. Run the frontend from the repo root:
   ```bash
   npm run dev
   ```

## Documentation

- Product documentation and the documentation assistant live in `public/docs`.
- The in-app assistant knowledge and action integration live in `lib/appAssistantKnowledge.ts`, `lib/appAssistantActions.ts`, and `components/AppAssistant.tsx`. The action bridge combines curated enum/range descriptors with dynamic current-state descriptors so new feature settings can remain chatbot-settable without constantly hand-authoring every leaf path.
- `npm run verify:assistant` checks assistant action coverage, upload/download targets, helper events, batch-safe mutations, and mode-by-mode coverage for every settable workflow path.
- Gateway setup and vendor proxy behavior are documented in `cloudflare-worker/README.md`.
