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
