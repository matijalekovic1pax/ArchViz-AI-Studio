/**
 * ConvertAPI Service - PDF to DOCX conversion
 * All API calls go through the API gateway — no API keys in the client.
 */

import { convertDocxToPdf, convertHtmlToDocx, convertPdfToDocx } from './apiGateway';

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

/**
 * Convert DOCX to PDF via the API gateway
 */
export async function convertDocxToPdfWithConvertApi(
  docxDataUrl: string,
  onProgress?: (progress: ConvertApiProgress) => void
): Promise<string> {
  const base64Match = docxDataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid DOCX data URL');
  }

  const docxBase64 = base64Match[1];

  onProgress?.({ phase: 'uploading', percent: 20, message: 'Uploading Word document...' });

  const result = await convertDocxToPdf('document.docx', docxBase64);

  onProgress?.({ phase: 'converting', percent: 60, message: 'Converting Word document to PDF preview...' });

  if (!result.Files || result.Files.length === 0 || !result.Files[0].FileData) {
    throw new Error('ConvertAPI returned no PDF data');
  }

  onProgress?.({ phase: 'downloading', percent: 90, message: 'Processing page preview...' });

  const pdfBase64 = result.Files[0].FileData;
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

  onProgress?.({ phase: 'complete', percent: 100, message: 'Word preview ready!' });

  return pdfDataUrl;
}

/**
 * Converts an AI-authored HTML document to an editable Word document. The AI
 * controls the content and styling; ConvertAPI only produces the Word binary.
 */
export async function convertHtmlToDocxWithConvertApi(html: string): Promise<string> {
  if (!html.trim()) throw new Error('The document agent did not return HTML to convert.');
  const htmlBase64 = utf8ToBase64(html);
  const result = await convertHtmlToDocx('tender-cv.html', htmlBase64);

  if (!result.Files || result.Files.length === 0 || !result.Files[0].FileData) {
    throw new Error('ConvertAPI returned no Word document.');
  }

  return `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${result.Files[0].FileData}`;
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
