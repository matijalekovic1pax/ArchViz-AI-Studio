# PDF Compression Setup

The app now uses **iLovePDF's professional compression service** for high-quality PDF compression that matches their website quality.

## Setup (5 minutes)

### 1. Get iLovePDF API Key (Free)

1. Go to https://developer.ilovepdf.com/
2. Click "Sign Up" (free account)
3. Verify your email
4. Go to Dashboard → API Keys
5. Copy your **Public Key**

**Free tier includes**: 250 compressions/month

### 2. Add API Key to Your Project

1. Open your `.env` file (or create one from `.env.example`)
2. Add this line:
   ```
   VITE_ILOVEPDF_PUBLIC_KEY=your-public-key-here
   ```
3. Replace `your-public-key-here` with your actual key
4. Restart your dev server (`npm run dev`)

### 3. That's It!

The app will now use iLovePDF's professional compression:
- ✅ **Text stays sharp and selectable** (no rasterization)
- ✅ **Better compression ratios** than client-side libraries
- ✅ **Same quality as iLovePDF website**

## Compression Levels

- **Light** → iLovePDF "Low compression" (gentle, preserves quality)
- **Balanced** → iLovePDF "Recommended" (good balance)
- **Aggressive** → iLovePDF "Extreme compression" (maximum reduction)

## Fallback

If iLovePDF is not configured, the app falls back to basic pdf-lib compression (limited capabilities).

## Troubleshooting

### "iLovePDF not configured" message in console?
- Check that your `.env` file has `VITE_ILOVEPDF_PUBLIC_KEY=...`
- Make sure you restarted the dev server after adding the key

### API key not working?
- Verify the key is correct in your iLovePDF dashboard
- Check you're using the **Public Key**, not the Secret Key

### Need more compression requests?
- Free tier: 250/month
- Paid plans available at https://developer.ilovepdf.com/pricing

## Security Note

The API key is exposed in the browser since this is a client-side app. iLovePDF's public key is designed for this use case. For production apps with high usage, consider setting up a backend proxy.
