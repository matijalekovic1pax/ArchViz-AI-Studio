# PDF Converter API

Free, self-hosted PDF ↔ DOCX conversion API for Vercel deployment, with iLovePDF proxy support.

## Features

### Free Custom Conversion (No API Keys)
- **PDF → DOCX**: Text extraction using `PyPDF2` (lightweight, fits Vercel limits)
- **DOCX → PDF**: Conversion using `python-docx` + `reportlab`
- **Free**: No API keys or usage limits
- **Unlimited**: No monthly caps

### iLovePDF Proxy (High Quality)
- **PDF → DOCX**: Professional-quality conversion via iLovePDF API
- **DOCX → PDF**: Perfect formatting preservation via iLovePDF API
- **CORS-bypass**: Server-side proxy avoids browser CORS issues
- **Easy**: Just add your iLovePDF public key

### Common Features
- **CORS-enabled**: Works from browser applications
- **Serverless**: Deploys to Vercel's serverless functions
- **Lightweight**: Under 250MB to fit Vercel's size limit

## Deployment Instructions

### 1. Prerequisites

- [Vercel account](https://vercel.com/signup) (free)
- [Vercel CLI](https://vercel.com/cli) installed: `npm install -g vercel`

### 2. Deploy to Vercel

```bash
# Navigate to the api folder
cd pdf-converter-api

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 3. Get Your API URL

After deployment, Vercel will provide a URL like:
```
https://your-project-name.vercel.app
```

### 4. Configure Your App

Add the API URL to your main app's `.env` file:

```env
VITE_PDF_CONVERTER_API_URL="https://your-project-name.vercel.app"
```

## API Endpoints

### Free Custom Conversion

#### POST /api/pdf-to-docx

Converts PDF to DOCX format (text extraction, lightweight).

**Request:**
```json
{
  "pdf_base64": "base64-encoded-pdf-content"
}
```

**Response:**
```json
{
  "success": true,
  "docx_base64": "base64-encoded-docx-content",
  "message": "PDF successfully converted to DOCX"
}
```

#### POST /api/docx-to-pdf

Converts DOCX to PDF format (basic rendering).

**Request:**
```json
{
  "docx_base64": "base64-encoded-docx-content"
}
```

**Response:**
```json
{
  "success": true,
  "pdf_base64": "base64-encoded-pdf-content",
  "message": "DOCX successfully converted to PDF"
}
```

### iLovePDF Proxy (High Quality)

#### POST /api/ilove-pdf-to-docx

Converts PDF to DOCX using iLovePDF API (professional quality).

**Request:**
```json
{
  "public_key": "your_ilovepdf_public_key",
  "pdf_base64": "base64-encoded-pdf-content"
}
```

**Response:**
```json
{
  "success": true,
  "docx_base64": "base64-encoded-docx-content (data URL)"
}
```

#### POST /api/ilove-docx-to-pdf

Converts DOCX to PDF using iLovePDF API (perfect formatting).

**Request:**
```json
{
  "public_key": "your_ilovepdf_public_key",
  "docx_base64": "base64-encoded-docx-content"
}
```

**Response:**
```json
{
  "success": true,
  "pdf_base64": "base64-encoded-pdf-content (data URL)"
}
```

> **Note:** The iLovePDF proxy requires a public key from [developer.ilovepdf.com](https://developer.ilovepdf.com). Set it in your app's .env as `VITE_ILOVEPDF_PUBLIC_KEY`.

## Error Handling

Errors return HTTP 500 with:
```json
{
  "success": false,
  "error": "Error message",
  "message": "Failed to convert file"
}
```

## Limitations

⚠️ **Important**: This is a lightweight, text-extraction approach optimized for Vercel's 250MB size limit.

### PDF → DOCX Conversion:
- ✅ **Works well for**: Text-heavy PDFs (articles, documents, reports)
- ✅ Preserves text content and basic paragraph structure
- ⚠️ **Limited**: Does not preserve complex layouts, images, tables, fonts, or colors
- ❌ **Won't work**: Scanned PDFs (images), heavily formatted documents, forms

### DOCX → PDF Conversion:
- ✅ **Works well for**: Simple text documents with paragraphs, headings, tables
- ⚠️ **Limited**: Basic formatting only (text, paragraphs, tables)
- ❌ **Not preserved**: Images, complex formatting, page layouts, advanced Word features

### Technical Limits:
- **File Size**: 4.5MB request limit (Vercel serverless functions)
- **Timeout**: 10 seconds execution time (Vercel free plan)
- **Best For**: Text-based document translation workflows

### When to Use CloudConvert Instead:
Use the paid CloudConvert option if you need:
- Perfect layout and formatting preservation
- Image and table preservation
- Professional-quality PDF output
- Complex document structures

## Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Install Vercel CLI
npm install -g vercel

# Run locally
vercel dev
```

Then test with:
```bash
curl -X POST http://localhost:3000/api/pdf-to-docx \
  -H "Content-Type: application/json" \
  -d '{"pdf_base64": "YOUR_BASE64_PDF"}'
```

## Quality Comparison

| Feature | Custom API (Free) | iLovePDF Proxy | CloudConvert (Paid) |
|---------|------------------|----------------|---------------------|
| **Cost** | FREE | FREE tier available | $0.01/minute |
| **PDF → DOCX** | ⭐⭐ Text extraction | ⭐⭐⭐⭐⭐ Perfect layout | ⭐⭐⭐⭐⭐ Perfect layout |
| **DOCX → PDF** | ⭐⭐⭐ Basic rendering | ⭐⭐⭐⭐⭐ Perfect output | ⭐⭐⭐⭐⭐ Perfect output |
| **Images** | ❌ Lost | ✅ Preserved | ✅ Preserved |
| **Tables** | ⚠️ Text only | ✅ Full formatting | ✅ Full formatting |
| **Fonts/Colors** | ❌ Reset to default | ✅ Preserved | ✅ Preserved |
| **Best For** | Text translation | Professional docs | Professional docs |
| **Limits** | None (unlimited) | Monthly quota | 500 min/month free |
| **Setup** | Just deploy | API key + deploy | API key only |

## Updating Your Deployment

```bash
# Make changes to your code
# Then redeploy
vercel --prod
```

## Cost

**100% Free** - Uses Vercel's free tier:
- Unlimited API calls
- 100GB bandwidth per month
- No credit card required

## Recommended Approach

**For Document Translation:**
1. Use this free API if your PDFs are text-heavy (articles, contracts, reports)
2. Upgrade to CloudConvert if you need perfect formatting (presentations, brochures, forms)

**Hybrid Option:**
- PDF → DOCX: Use this free API (text extraction is sufficient for translation)
- Translate the DOCX: Your main app handles this
- DOCX → PDF: Use CloudConvert only if you need perfect output quality
