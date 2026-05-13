/**
 * iLovePDF API Service - PDF to DOCX conversion
 * All API calls go through the API gateway — no API keys in the client.
 *
 * Flow: Authenticate → Start Task (pdfdocx) → Upload PDF → Process → Download DOCX
 */

import {
  ilovepdfAuth,
  ilovepdfStart,
  ilovepdfUpload,
  ilovepdfProcess,
  ilovepdfDownload,
} from './apiGateway';

export interface ILoveConversionProgress {
  phase: 'starting' | 'uploading' | 'processing' | 'downloading' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
}

export type ILoveProgressCallback = (progress: ILoveConversionProgress) => void;

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

/**
 * Initialize the API (no-op — gateway handles auth)
 */
export async function initializeILoveApi(): Promise<boolean> {
  return true;
}

/**
 * Check if iLove API is configured (gateway manages secrets server-side)
 */
export function isILoveApiConfigured(): boolean {
  return true;
}

/**
 * Extract base64 data from a data URL
 */
function dataUrlToBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  return match[1];
}

function dataUrlToBlob(dataUrl: string, fallbackMimeType: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }

  const mimeType = match[1] || fallbackMimeType;
  const base64 = match[2].replace(/\s/g, '');
  const bytes = new Uint8Array(Math.floor((base64.length * 3) / 4));
  const chunkSize = 32768;
  let offset = 0;

  for (let start = 0; start < base64.length; start += chunkSize) {
    const binary = atob(base64.slice(start, start + chunkSize));
    for (let i = 0; i < binary.length; i++) {
      bytes[offset++] = binary.charCodeAt(i);
    }
  }

  return new Blob([bytes.subarray(0, offset)], { type: mimeType });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert PDF to DOCX using iLovePDF via the API gateway
 */
export async function convertPdfToDocxWithILove(
  pdfDataUrl: string,
  onProgress?: ILoveProgressCallback
): Promise<string> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // Step 1: Authenticate
      onProgress?.({ phase: 'starting', progress: 5, message: 'Authenticating with iLovePDF...' });
      const { token: ilovepdfToken } = await ilovepdfAuth();

      // Step 2: Start task
      onProgress?.({ phase: 'starting', progress: 15, message: 'Starting PDF to DOCX task...' });
      const { server, task } = await ilovepdfStart('pdfdocx', ilovepdfToken);

      // Step 3: Upload PDF
      onProgress?.({ phase: 'uploading', progress: 30, message: 'Uploading PDF...' });
      const fileData = dataUrlToBase64(pdfDataUrl);
      const { server_filename } = await ilovepdfUpload(server, task, ilovepdfToken, fileData, 'document.pdf');

      // Step 4: Process conversion
      onProgress?.({ phase: 'processing', progress: 55, message: 'Converting PDF to DOCX...' });
      await ilovepdfProcess(server, ilovepdfToken, {
        task,
        tool: 'pdfdocx',
        files: [{ server_filename, filename: server_filename }],
      });

      // Step 5: Download DOCX
      onProgress?.({ phase: 'downloading', progress: 80, message: 'Downloading DOCX...' });
      const docxBlob = await ilovepdfDownload(server, task, ilovepdfToken);

      // Step 6: Convert to data URL
      onProgress?.({ phase: 'downloading', progress: 95, message: 'Finalizing...' });
      const docxDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(docxBlob);
      });

      onProgress?.({ phase: 'complete', progress: 100, message: 'PDF converted to DOCX successfully!' });

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

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }

  throw new Error('Failed to convert PDF to DOCX after maximum retries');
}

/**
 * Convert DOCX to PDF using iLovePDF via the API gateway.
 * Uses direct vendor upload/download so large Word files avoid gateway body limits.
 */
export async function convertDocxToPdfWithILove(
  docxDataUrl: string,
  onProgress?: ILoveProgressCallback
): Promise<string> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      onProgress?.({ phase: 'starting', progress: 5, message: 'Preparing Word page preview...' });
      const { token: ilovepdfToken } = await ilovepdfAuth();

      onProgress?.({ phase: 'starting', progress: 15, message: 'Starting Word to PDF preview task...' });
      const { server, task } = await ilovepdfStart('officepdf', ilovepdfToken);

      onProgress?.({ phase: 'uploading', progress: 30, message: 'Uploading Word document...' });
      const docxBlob = dataUrlToBlob(
        docxDataUrl,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const { server_filename } = await ilovepdfUpload(server, task, ilovepdfToken, docxBlob, 'document.docx');

      onProgress?.({ phase: 'processing', progress: 55, message: 'Converting Word document to page preview...' });
      await ilovepdfProcess(server, ilovepdfToken, {
        task,
        tool: 'officepdf',
        files: [{ server_filename, filename: 'document.docx' }],
      });

      onProgress?.({ phase: 'downloading', progress: 80, message: 'Downloading page preview...' });
      const pdfBlob = await ilovepdfDownload(server, task, ilovepdfToken);

      onProgress?.({ phase: 'downloading', progress: 95, message: 'Finalizing page preview...' });
      const pdfDataUrl = await blobToDataUrl(pdfBlob);

      onProgress?.({ phase: 'complete', progress: 100, message: 'Word preview ready!' });

      return pdfDataUrl;
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

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }

  throw new Error('Failed to convert DOCX to PDF after maximum retries');
}
