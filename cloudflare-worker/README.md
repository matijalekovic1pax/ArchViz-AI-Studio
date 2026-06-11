# ArchViz API Gateway

This Cloudflare Worker is the server-side gateway for ArchViz AI Studio. It keeps vendor secrets out of the browser, verifies Google sign-in, issues short-lived app JWTs, applies CORS and payload limits, and proxies all external AI/document services used by the frontend.

## What it handles

- Google ID token verification and app JWT issuance
- Gemini text/image requests, including the Regular Nano Banana image model path
- ChatGPT Image Generation 2 through OpenAI `gpt-image-2`
- Vertex AI Veo and Kling video generation/status endpoints
- ConvertAPI document conversion for PDF translation
- iLovePDF auth/process flows for PDF compression
- Feedback report and snapshot storage through Appwrite

## Frontend configuration

Set the gateway URL in the frontend `.env.local`:

```bash
VITE_API_GATEWAY_URL="http://localhost:8787"
VITE_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
VITE_ALLOWED_DOMAIN="your-company-domain.com"
```

For production, point `VITE_API_GATEWAY_URL` at the deployed Worker URL.

## Required Worker secrets

Run these from the `cloudflare-worker` directory:

```bash
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put ALLOWED_DOMAIN
wrangler secret put GEMINI_API_KEY
```

`JWT_SECRET` should be a strong random secret. `GOOGLE_CLIENT_ID` and `ALLOWED_DOMAIN` must match the frontend login configuration.

## Optional service secrets

Add only the services you plan to use:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
wrangler secret put GOOGLE_PROJECT_ID
wrangler secret put KLING_PIAPI_API_KEY
wrangler secret put KLING_ULAZAI_API_KEY
wrangler secret put KLING_WAVESPEEDAI_API_KEY
wrangler secret put CONVERTAPI_SECRET
wrangler secret put ILOVEPDF_PUBLIC_KEY
wrangler secret put APPWRITE_ENDPOINT
wrangler secret put APPWRITE_PROJECT_ID
wrangler secret put APPWRITE_API_KEY
wrangler secret put APPWRITE_DATABASE_ID
wrangler secret put APPWRITE_REPORTS_COLLECTION_ID
wrangler secret put APPWRITE_ACTIVITY_COLLECTION_ID
wrangler secret put APPWRITE_ADMINS_COLLECTION_ID
wrangler secret put APPWRITE_SNAPSHOTS_BUCKET_ID
```

`OPENAI_API_KEY` enables the ChatGPT Image Generation 2 option.

## Appwrite feedback backend

Feedback reports are written by the Worker using a server API key. The browser never talks to Appwrite directly.

1. Create an Appwrite server API key with database, collection, attribute, index, document, bucket, and file read/write scopes.
2. From the repo root, create a local `.env.appwrite` based on `.env.appwrite.example`.
3. Run the idempotent setup script:

```bash
npm run setup:appwrite-feedback
```

The script creates the `archviz_reports` database, `feedback_reports`, `feedback_activity`, and `feedback_admins` collections, the `feedback_snapshots` bucket, and the initial feedback admin email.

For production, set the matching `APPWRITE_*` values as Cloudflare Worker secrets from the `cloudflare-worker` directory. Vercel does not need the Appwrite API key because Vercel only serves the frontend bundle.

## Local development

```bash
cd cloudflare-worker
wrangler dev
```

The frontend defaults to `http://localhost:8787`, so `npm run dev` from the repo root can talk to the local gateway once the user is signed in.

The embedded App Assistant also calls the gateway for its live model responses. Its app-control bridge can be tested locally with the gated smoke tools, but real assistant chat responses require `VITE_API_GATEWAY_URL` and a valid signed-in app JWT session in the browser.

## Deployment

1. Add your Cloudflare account ID to `wrangler.toml` if needed.
2. Set the required secrets in the target environment.
3. Deploy:

```bash
cd cloudflare-worker
wrangler deploy
```

After deployment, update the frontend `VITE_API_GATEWAY_URL` to the Worker URL.

## Notes

- The Worker keeps the request body limit below Cloudflare's 100 MB Free/Pro cap so high-resolution image edits fail predictably before the edge limit.
- ChatGPT Image Generation 2 normalizes requested size/quality and can force an opaque output background for unsupported transparent-background requests.
- Vertex AI and video jobs may require repeated polling; the frontend handles progress and status checks through this gateway.
- Feedback snapshots are stored in Appwrite Storage when `APPWRITE_*` secrets are configured. Supabase remains as a legacy fallback only if Appwrite is not configured.
