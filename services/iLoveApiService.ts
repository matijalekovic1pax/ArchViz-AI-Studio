/**
 * iLovePDF API Service (via Proxy)
 *
 * Provides PDF to DOCX and DOCX to PDF conversion using iLovePDF API through our backend proxy.
 * The proxy is needed to avoid CORS issues when calling iLovePDF API from the browser.
 *
 * Proxy endpoints (deployed alongside pdf-converter-api):
 * - POST /api/ilove-pdf-to-docx - Convert PDF to DOCX
 * - POST /api/ilove-docx-to-pdf - Convert DOCX to PDF
 *
 * The proxy handles all the iLovePDF API complexity:
 * 1. Start a task (get task and server)
 * 2. Upload file
 * 3. Process the conversion
 * 4. Download the result
 */

export interface ILoveConversionProgress {
  phase: 'starting' | 'uploading' | 'processing' | 'downloading' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
}

export type ILoveProgressCallback = (progress: ILoveConversionProgress) => void;

// Rate limiting settings
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Get the proxy API base URL (same as pdf-converter-api)
 */
function getProxyApiUrl(): string | null {
  // Use the same base URL as the PDF converter API
  return import.meta.env.VITE_PDF_CONVERTER_API_URL || null;
}

/**
 * Initialize the API by validating the public key and proxy URL
 */
export async function initializeILoveApi(): Promise<boolean> {
  const publicKey = import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;
  const proxyUrl = getProxyApiUrl();

  if (!publicKey) {
    console.error('iLovePDF API: No public key found in environment variables');
    return false;
  }

  if (!proxyUrl) {
    console.error('iLovePDF API: No proxy URL configured. Please set VITE_PDF_CONVERTER_API_URL');
    return false;
  }

  console.log('iLovePDF API: Initialized successfully');
  return true;
}

/**
 * Check if iLove API is configured (requires both public key and proxy URL)
 */
export function isILoveApiConfigured(): boolean {
  const hasPublicKey = !!import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;
  const hasProxyUrl = !!getProxyApiUrl();
  return hasPublicKey && hasProxyUrl;
}


/**
 * Convert PDF to DOCX using iLovePDF API (via proxy)
 */
export async function convertPdfToDocxWithILove(
  pdfBase64: string,
  onProgress?: ILoveProgressCallback
): Promise<string> {
  const proxyUrl = getProxyApiUrl();
  const publicKey = import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;

  if (!proxyUrl || !publicKey) {
    throw new Error('iLovePDF API not configured. Please set VITE_ILOVEPDF_PUBLIC_KEY and VITE_PDF_CONVERTER_API_URL');
  }

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      onProgress?.({
        phase: 'starting',
        progress: 10,
        message: 'Starting PDF to DOCX conversion...',
      });

      onProgress?.({
        phase: 'uploading',
        progress: 30,
        message: 'Uploading PDF to iLovePDF...',
      });

      onProgress?.({
        phase: 'processing',
        progress: 60,
        message: 'Converting PDF to DOCX...',
      });

      // Call proxy API
      const response = await fetch(`${proxyUrl}/api/ilove-pdf-to-docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key: publicKey,
          pdf_base64: pdfBase64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.docx_base64) {
        throw new Error(data.error || 'Conversion failed');
      }

      onProgress?.({
        phase: 'downloading',
        progress: 90,
        message: 'Downloading converted DOCX...',
      });

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'PDF converted to DOCX successfully!',
      });

      return data.docx_base64;

    } catch (error) {
      retries++;

      if (retries >= MAX_RETRIES) {
        onProgress?.({
          phase: 'error',
          progress: 0,
          message: `Failed to convert PDF to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        throw error;
      }

      console.warn(`iLovePDF conversion attempt ${retries} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }

  throw new Error('Failed to convert PDF to DOCX after maximum retries');
}

/**
 * Convert DOCX to PDF using iLovePDF API (via proxy)
 */
export async function convertDocxToPdfWithILove(
  docxBase64: string,
  onProgress?: ILoveProgressCallback
): Promise<string> {
  const proxyUrl = getProxyApiUrl();
  const publicKey = import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;

  if (!proxyUrl || !publicKey) {
    throw new Error('iLovePDF API not configured. Please set VITE_ILOVEPDF_PUBLIC_KEY and VITE_PDF_CONVERTER_API_URL');
  }

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      onProgress?.({
        phase: 'starting',
        progress: 10,
        message: 'Starting DOCX to PDF conversion...',
      });

      onProgress?.({
        phase: 'uploading',
        progress: 30,
        message: 'Uploading DOCX to iLovePDF...',
      });

      onProgress?.({
        phase: 'processing',
        progress: 60,
        message: 'Converting DOCX to PDF...',
      });

      // Call proxy API
      const response = await fetch(`${proxyUrl}/api/ilove-docx-to-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key: publicKey,
          docx_base64: docxBase64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.pdf_base64) {
        throw new Error(data.error || 'Conversion failed');
      }

      onProgress?.({
        phase: 'downloading',
        progress: 90,
        message: 'Downloading converted PDF...',
      });

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'DOCX converted to PDF successfully!',
      });

      return data.pdf_base64;

    } catch (error) {
      retries++;

      if (retries >= MAX_RETRIES) {
        onProgress?.({
          phase: 'error',
          progress: 0,
          message: `Failed to convert DOCX to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        throw error;
      }

      console.warn(`iLovePDF conversion attempt ${retries} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }

  throw new Error('Failed to convert DOCX to PDF after maximum retries');
}
