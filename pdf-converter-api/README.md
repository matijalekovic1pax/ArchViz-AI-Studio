# PDF Converter API

Free, self-hosted PDF ↔ DOCX conversion API for Vercel deployment.

## Features

- **PDF → DOCX**: Text extraction using `PyPDF2` (lightweight, fits Vercel limits)
- **DOCX → PDF**: Conversion using `python-docx` + `reportlab`
- **Free**: No API keys or usage limits
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

### POST /api/pdf-to-docx

Converts PDF to DOCX format.

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

### POST /api/docx-to-pdf

Converts DOCX to PDF format.

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

| Feature | Custom API (Free) | CloudConvert (Paid) |
|---------|------------------|---------------------|
| **Cost** | FREE | $0.01/minute |
| **PDF → DOCX** | ⭐⭐ Text extraction | ⭐⭐⭐⭐⭐ Perfect layout |
| **DOCX → PDF** | ⭐⭐⭐ Basic rendering | ⭐⭐⭐⭐⭐ Perfect output |
| **Images** | ❌ Lost | ✅ Preserved |
| **Tables** | ⚠️ Text only | ✅ Full formatting |
| **Fonts/Colors** | ❌ Reset to default | ✅ Preserved |
| **Best For** | Text translation | Professional docs |
| **Limits** | None | 500 min/month free |

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
