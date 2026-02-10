/**
 * iLovePDF API Service - Direct API calls (no proxy needed)
 *
 * Converts PDF to DOCX using iLovePDF API directly from the browser.
 * Uses the same pattern as ilovepdfService.ts (compression).
 *
 * Flow: Authenticate → Start Task (pdfdocx) → Upload PDF → Process → Download DOCX
 */

const API_BASE = 'https://api.ilovepdf.com/v1';

export interface ILoveConversionProgress {
  phase: 'starting' | 'uploading' | 'processing' | 'downloading' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
}

export type ILoveProgressCallback = (progress: ILoveConversionProgress) => void;

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// Cached auth token (expires after 2 hours per iLovePDF docs)
let cachedToken: string | null = null;

/**
 * Authenticate with iLovePDF API and get JWT token
 */
async function authenticate(publicKey: string): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  console.log('[iLovePDF Convert] Authenticating...');

  const response = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKey }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`iLovePDF authentication failed: ${error}`);
  }

  const data = await response.json();
  cachedToken = data.token;
  console.log('[iLovePDF Convert] Authenticated');
  return data.token;
}

/**
 * Start a conversion task
 */
async function startTask(token: string, tool: string): Promise<{ server: string; task: string }> {
  console.log(`[iLovePDF Convert] Starting ${tool} task...`);

  const response = await fetch(`${API_BASE}/start/${tool}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    // Token might be expired, clear cache
    if (response.status === 401) {
      cachedToken = null;
    }
    const error = await response.text();
    throw new Error(`Failed to start task: ${error}`);
  }

  const data = await response.json();
  console.log(`[iLovePDF Convert] Task started: ${data.task}`);
  return { server: data.server, task: data.task };
}

/**
 * Upload file to task server
 */
async function uploadFile(
  server: string,
  task: string,
  token: string,
  fileBlob: Blob,
  filename: string
): Promise<string> {
  console.log('[iLovePDF Convert] Uploading file...');

  const formData = new FormData();
  formData.append('task', task);
  formData.append('file', fileBlob, filename);

  const response = await fetch(`https://${server}/v1/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file: ${error}`);
  }

  const data = await response.json();
  console.log('[iLovePDF Convert] File uploaded:', data.server_filename);
  return data.server_filename;
}

/**
 * Process the conversion task
 */
async function processTask(
  server: string,
  task: string,
  token: string,
  tool: string,
  serverFilename: string
): Promise<void> {
  console.log('[iLovePDF Convert] Processing...');

  const response = await fetch(`https://${server}/v1/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      tool,
      files: [{ server_filename: serverFilename, filename: serverFilename }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to process conversion: ${error}`);
  }

  console.log('[iLovePDF Convert] Processing complete');
}

/**
 * Download the converted file
 */
async function downloadFile(server: string, task: string, token: string): Promise<Blob> {
  console.log('[iLovePDF Convert] Downloading result...');

  const response = await fetch(`https://${server}/v1/download/${task}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to download file: ${error}`);
  }

  const blob = await response.blob();
  console.log('[iLovePDF Convert] Downloaded:', (blob.size / 1024).toFixed(1), 'KB');
  return blob;
}

/**
 * Convert a Blob to a data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract raw base64 data from a data URL, returning just the binary as a Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid data URL format');
  }
  const mimeType = base64Match[1];
  const base64 = base64Match[2];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Initialize the API (just validates config)
 */
export async function initializeILoveApi(): Promise<boolean> {
  const publicKey = import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;

  if (!publicKey) {
    console.error('iLovePDF API: No public key found in environment variables');
    return false;
  }

  console.log('iLovePDF API: Initialized successfully');
  return true;
}

/**
 * Check if iLove API is configured (only needs public key - no proxy required)
 */
export function isILoveApiConfigured(): boolean {
  return !!import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;
}

/**
 * Convert PDF to DOCX using iLovePDF API (direct, no proxy)
 */
export async function convertPdfToDocxWithILove(
  pdfDataUrl: string,
  onProgress?: ILoveProgressCallback
): Promise<string> {
  const publicKey = import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error('iLovePDF API not configured. Please set VITE_ILOVEPDF_PUBLIC_KEY in .env');
  }

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // Step 1: Authenticate
      onProgress?.({ phase: 'starting', progress: 5, message: 'Authenticating with iLovePDF...' });
      const token = await authenticate(publicKey);

      // Step 2: Start task
      onProgress?.({ phase: 'starting', progress: 15, message: 'Starting PDF to DOCX task...' });
      const { server, task } = await startTask(token, 'pdfdocx');

      // Step 3: Upload PDF
      onProgress?.({ phase: 'uploading', progress: 30, message: 'Uploading PDF...' });
      const pdfBlob = dataUrlToBlob(pdfDataUrl);
      const serverFilename = await uploadFile(server, task, token, pdfBlob, 'document.pdf');

      // Step 4: Process conversion
      onProgress?.({ phase: 'processing', progress: 55, message: 'Converting PDF to DOCX...' });
      await processTask(server, task, token, 'pdfdocx', serverFilename);

      // Step 5: Download DOCX
      onProgress?.({ phase: 'downloading', progress: 80, message: 'Downloading DOCX...' });
      const docxBlob = await downloadFile(server, task, token);

      // Step 6: Convert to data URL
      onProgress?.({ phase: 'downloading', progress: 95, message: 'Finalizing...' });
      const docxDataUrl = await blobToDataUrl(docxBlob);

      onProgress?.({ phase: 'complete', progress: 100, message: 'PDF converted to DOCX successfully!' });

      console.log('[iLovePDF Convert] PDF → DOCX complete');
      return docxDataUrl;

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

      // Clear token cache on auth errors
      if (error instanceof Error && error.message.includes('authentication')) {
        cachedToken = null;
      }

      console.warn(`[iLovePDF Convert] Attempt ${retries} failed, retrying...`, error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }

  throw new Error('Failed to convert PDF to DOCX after maximum retries');
}
