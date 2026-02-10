/**
 * PDF Converter Service
 * Free, self-hosted PDF ↔ DOCX conversion using custom Vercel API
 * Auth: includes gateway JWT in requests so Vercel functions can verify identity
 */

import { getGatewayToken } from './apiGateway';

let customApiUrl: string | null = null;
let bypassToken: string | null = null;

/**
 * Initialize the PDF converter service with your custom API URL
 */
export function initPdfConverterService(apiUrl: string): void {
  if (!apiUrl) {
    throw new Error('PDF Converter API URL is required');
  }

  // Extract bypass token from URL if present
  try {
    const url = new URL(apiUrl);
    bypassToken = url.searchParams.get('x-vercel-protection-bypass');

    // Store base URL without query params
    url.search = '';
    customApiUrl = url.toString().replace(/\/$/, '');
  } catch {
    // Fallback if URL parsing fails
    customApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  }

  // Service initialized
}

/**
 * Check if the PDF converter service is initialized
 */
export function isPdfConverterInitialized(): boolean {
  return customApiUrl !== null;
}

/**
 * Get the configured API URL
 */
function getApiUrl(): string {
  if (!customApiUrl) {
    throw new Error('PDF Converter service not initialized. Call initPdfConverterService() first.');
  }
  return customApiUrl;
}

/**
 * Get headers for API requests (including JWT auth + bypass token if configured)
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add gateway JWT for Vercel function auth
  const token = getGatewayToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add Vercel bypass token as header if configured
  if (bypassToken) {
    headers['x-vercel-protection-bypass'] = bypassToken;
    headers['x-vercel-set-bypass-cookie'] = 'samesitenone';
  }

  return headers;
}

export interface ConversionProgress {
  phase: 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
}

export interface ConversionOptions {
  onProgress?: (progress: ConversionProgress) => void;
  abortSignal?: AbortSignal;
}

/**
 * Convert PDF to DOCX using custom API
 */
export async function convertPdfToDocx(
  pdfDataUrl: string,
  options?: ConversionOptions
): Promise<string> {
  const apiUrl = getApiUrl();
  const { onProgress, abortSignal } = options || {};

  try {
    onProgress?.({
      phase: 'converting',
      progress: 10,
      message: 'Preparing PDF for conversion...'
    });

    // Extract base64 from data URL
    const base64Match = pdfDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid PDF data URL format');
    }
    const base64Data = base64Match[2];

    onProgress?.({
      phase: 'converting',
      progress: 30,
      message: 'Converting PDF to DOCX...'
    });

    // Call custom API
    const response = await fetch(`${apiUrl}/api/pdf-to-docx`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        pdf_base64: base64Data
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    onProgress?.({
      phase: 'downloading',
      progress: 80,
      message: 'Processing converted document...'
    });

    const result = await response.json();

    if (!result.success || !result.docx_base64) {
      throw new Error(result.error || 'Conversion failed');
    }

    // Convert to data URL
    const docxDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${result.docx_base64}`;

    onProgress?.({
      phase: 'complete',
      progress: 100,
      message: 'Conversion complete'
    });

    return docxDataUrl;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    onProgress?.({
      phase: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Conversion failed'
    });

    throw new Error(`Failed to convert PDF to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert DOCX to PDF using custom API
 */
export async function convertDocxToPdf(
  docxDataUrl: string,
  options?: ConversionOptions
): Promise<string> {
  const apiUrl = getApiUrl();
  const { onProgress, abortSignal } = options || {};

  try {
    onProgress?.({
      phase: 'converting',
      progress: 10,
      message: 'Preparing DOCX for conversion...'
    });

    // Extract base64 from data URL
    const base64Match = docxDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid DOCX data URL format');
    }
    const base64Data = base64Match[2];

    onProgress?.({
      phase: 'converting',
      progress: 30,
      message: 'Converting DOCX to PDF...'
    });

    // Call custom API
    const response = await fetch(`${apiUrl}/api/docx-to-pdf`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        docx_base64: base64Data
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    onProgress?.({
      phase: 'downloading',
      progress: 80,
      message: 'Processing converted document...'
    });

    const result = await response.json();

    if (!result.success || !result.pdf_base64) {
      throw new Error(result.error || 'Conversion failed');
    }

    // Convert to data URL
    const pdfDataUrl = `data:application/pdf;base64,${result.pdf_base64}`;

    onProgress?.({
      phase: 'complete',
      progress: 100,
      message: 'Conversion complete'
    });

    return pdfDataUrl;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    onProgress?.({
      phase: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Conversion failed'
    });

    throw new Error(`Failed to convert DOCX to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
