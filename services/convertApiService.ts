/**
 * ConvertAPI Service - PDF to DOCX conversion
 * https://www.convertapi.com/pdf-to-docx
 *
 * Setup:
 * 1. Sign up at https://www.convertapi.com/ (250 free conversions)
 * 2. Get your API secret from the dashboard
 * 3. Add to .env: VITE_CONVERTAPI_SECRET=your_secret
 */

const API_BASE = 'https://v2.convertapi.com';

export interface ConvertApiProgress {
  phase: 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
  percent: number;
  message: string;
}

/**
 * Check if ConvertAPI is configured
 */
export function isConvertApiConfigured(): boolean {
  // @ts-ignore - Vite env vars
  return !!import.meta.env.VITE_CONVERTAPI_SECRET;
}

/**
 * Convert PDF to DOCX using ConvertAPI
 */
export async function convertPdfToDocxWithConvertApi(
  pdfDataUrl: string,
  onProgress?: (progress: ConvertApiProgress) => void
): Promise<string> {
  // @ts-ignore - Vite env vars
  const secret = import.meta.env.VITE_CONVERTAPI_SECRET;

  if (!secret) {
    throw new Error('ConvertAPI not configured. Please set VITE_CONVERTAPI_SECRET in .env');
  }

  // Extract base64 from data URL
  const base64Match = pdfDataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid PDF data URL');
  }

  const pdfBase64 = base64Match[1];

  onProgress?.({ phase: 'uploading', percent: 20, message: 'Uploading PDF to ConvertAPI...' });

  console.log('[ConvertAPI] Converting PDF to DOCX...');

  const response = await fetch(`${API_BASE}/convert/pdf/to/docx?Secret=${secret}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Parameters: [
        {
          Name: 'File',
          FileValue: {
            Name: 'document.pdf',
            Data: pdfBase64,
          },
        },
      ],
    }),
  });

  onProgress?.({ phase: 'converting', percent: 60, message: 'Converting PDF to DOCX...' });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ConvertAPI] Error:', errorText);
    throw new Error(`ConvertAPI conversion failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.Files || data.Files.length === 0 || !data.Files[0].FileData) {
    throw new Error('ConvertAPI returned no file data');
  }

  onProgress?.({ phase: 'downloading', percent: 90, message: 'Processing converted file...' });

  const docxBase64 = data.Files[0].FileData;
  const docxDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}`;

  console.log(`[ConvertAPI] Conversion complete (${data.ConversionTime}s), file: ${data.Files[0].FileName}, size: ${data.Files[0].FileSize} bytes`);

  onProgress?.({ phase: 'complete', percent: 100, message: 'PDF converted to DOCX!' });

  return docxDataUrl;
}
