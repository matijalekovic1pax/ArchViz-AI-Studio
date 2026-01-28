# Deploy to Cloudflare Workers (Recommended Free Alternative)

Cloudflare Workers is truly free (100k requests/day) and has no authentication/protection issues.

## Why Cloudflare Workers?

- ✅ **100% Free**: 100,000 requests per day
- ✅ **No Auth Issues**: Public by default
- ✅ **Fast**: Edge network
- ✅ **Simple**: One command deployment

## Quick Deploy

### 1. Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser for authentication.

### 3. Create Worker

```bash
cd pdf-converter-api
wrangler init pdf-converter --yes
```

### 4. Copy Worker Code

I'll provide the worker code in the next step.

### 5. Deploy

```bash
wrangler deploy
```

You'll get a URL like: `https://pdf-converter.your-subdomain.workers.dev`

## Note

Since Cloudflare Workers uses JavaScript/TypeScript (not Python), you'll need to use a different approach:
- Use `pdf-lib` for PDF operations (JavaScript)
- Use `docx` for DOCX operations (JavaScript)

**Trade-off**: Slightly less quality than Python libraries, but still works well for text-based PDFs.

**Alternative**: Keep using Vercel but with a bypass token (see Vercel dashboard for bypass token under Deployment Protection settings).
