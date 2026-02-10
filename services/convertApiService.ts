/**
 * ConvertAPI Service - PDF to DOCX conversion
 * All API calls go through the API gateway — no API keys in the client.
 */

import { convertPdfToDocx } from './apiGateway';

export interface ConvertApiProgress {
  phase: 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
  percent: number;
  message: string;
}

/**
 * Check if ConvertAPI is configured (gateway manages secrets server-side)
 */
export function isConvertApiConfigured(): boolean {
  return true;
}

/**
 * Convert PDF to DOCX via the API gateway
 */
export async function convertPdfToDocxWithConvertApi(
  pdfDataUrl: string,
  onProgress?: (progress: ConvertApiProgress) => void
): Promise<string> {
  // Extract base64 from data URL
  const base64Match = pdfDataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid PDF data URL');
  }

  const pdfBase64 = base64Match[1];

  onProgress?.({ phase: 'uploading', percent: 20, message: 'Uploading PDF...' });

  const result = await convertPdfToDocx('document.pdf', pdfBase64);

  onProgress?.({ phase: 'converting', percent: 60, message: 'Converting PDF to DOCX...' });

  if (!result.Files || result.Files.length === 0 || !result.Files[0].FileData) {
    throw new Error('ConvertAPI returned no file data');
  }

  onProgress?.({ phase: 'downloading', percent: 90, message: 'Processing converted file...' });

  const docxBase64 = result.Files[0].FileData;
  const docxDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}`;

  onProgress?.({ phase: 'complete', percent: 100, message: 'PDF converted to DOCX!' });

  return docxDataUrl;
}
