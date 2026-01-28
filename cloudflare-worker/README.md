# Veo Proxy Cloudflare Worker

This Cloudflare Worker acts as a proxy for Google Vertex AI's Veo video generation API, handling CORS and long-running operation polling.

## Setup

### 1. Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Update Configuration

Edit `wrangler.toml` and add your Cloudflare account ID:
- Go to https://dash.cloudflare.com
- Copy your Account ID from the dashboard
- Update the `account_id` field in `wrangler.toml`

### 4. Deploy the Worker

```bash
cd cloudflare-worker
wrangler deploy
```

After deployment, you'll get a worker URL like:
```
https://veo-proxy.your-subdomain.workers.dev
```

### 5. Update Your Frontend

Add the worker URL to your `.env` file:

```bash
VITE_VEO_PROXY_URL="https://veo-proxy.your-subdomain.workers.dev"
```

## Security Considerations

### Production Setup

1. **Restrict CORS Origins**

   In `veo-proxy.js`, change:
   ```javascript
   'Access-Control-Allow-Origin': '*'
   ```
   to:
   ```javascript
   'Access-Control-Allow-Origin': 'https://yourdomain.com'
   ```

2. **Use Worker Secrets** (Recommended)

   Instead of sending the access token from the frontend, store it as a Worker secret:

   ```bash
   wrangler secret put VERTEX_AI_TOKEN
   wrangler secret put GOOGLE_PROJECT_ID
   ```

   Then modify the worker to use these secrets instead of accepting them in the request body.

3. **Rate Limiting**

   Add rate limiting to prevent abuse:
   ```javascript
   // At the top of veo-proxy.js
   const RATE_LIMIT = 10; // requests per minute
   ```

## How It Works

1. Frontend sends video generation request to the Cloudflare Worker
2. Worker proxies the request to Vertex AI's `:predictLongRunning` endpoint
3. Worker polls the operation endpoint until the video is ready
4. Worker returns the video URL to the frontend

## Cost

- Cloudflare Workers Free Plan: 100,000 requests/day
- Most video generations will use 20-60 requests (1 initial + polling)
- Monitor usage in your Cloudflare dashboard

## Troubleshooting

### Error: "Missing projectId or accessToken"

Make sure you're sending both values from your frontend.

### Error: "Video generation timed out"

The worker polls for 3 minutes. If video generation takes longer:
1. Increase `MAX_POLL_ATTEMPTS` in the worker
2. Or use webhooks (requires additional setup)

### CORS errors

Check that CORS_HEADERS includes your domain in production.
