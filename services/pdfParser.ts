/**
 * PDF Parser Service
 * Parses PDF documents to extract text and rebuilds with translations
 * Uses pdfjs-dist for extraction and pdf-lib for modification
 *
 * NOTE: PDF text replacement has inherent limitations.
 * The approach: cover original text with white rectangles and overlay translated text.
 * This may cause minor layout differences, especially with non-Latin fonts.
 */


import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker - use the CDN or local path
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';

export interface PdfTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
  height: number;
  fontName: string;
}

export interface TextSegment {
  id: string;
  text: string;
  pageIndex: number;
  itemIndex: number;
  transform: number[];
  width: number;
  height: number;
  context: 'paragraph';
}

export interface PdfParseResult {
  segments: TextSegment[];
  pdfBytes: Uint8Array;
  pageTextItems: Map<number, PdfTextItem[]>;
}

/**
 * Convert data URL to ArrayBuffer
 */
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid data URL format');
  }

  const base64 = base64Match[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Parse a PDF file from a data URL
 */
export async function parsePdf(dataUrl: string): Promise<PdfParseResult> {
  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  const bytes = new Uint8Array(arrayBuffer);

  // Load with pdfjs for text extraction
  const loadingTask = getDocument({ data: bytes });
  const pdfJsDoc = await loadingTask.promise;

  const segments: TextSegment[] = [];
  const pageTextItems = new Map<number, PdfTextItem[]>();

  // Process each page
  for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
    const page = await pdfJsDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PdfTextItem[] = [];

    for (const item of textContent.items) {
      // Skip non-text items
      if (!('str' in item) || !item.str.trim()) continue;

      const textItem: PdfTextItem = {
        str: item.str,
        transform: item.transform as number[],
        width: item.width,
        height: item.height || Math.abs(item.transform[0]),
        fontName: item.fontName,
      };
      items.push(textItem);

      segments.push({
        id: `pdf-${pageNum}-${items.length - 1}`,
        text: item.str,
        pageIndex: pageNum - 1, // 0-indexed for pdf-lib
        itemIndex: items.length - 1,
        transform: item.transform as number[],
        width: item.width,
        height: textItem.height,
        context: 'paragraph',
      });
    }

    pageTextItems.set(pageNum - 1, items);
  }

  return { segments, pdfBytes: bytes, pageTextItems };
}

/**
 * Rebuild a PDF file with translated text
 */
export async function rebuildPdf(
  parseResult: PdfParseResult,
  translations: Map<string, string>
): Promise<string> {
  const { pdfBytes, pageTextItems, segments } = parseResult;

  // Load the PDF with pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // Embed standard fonts
  // Note: For better international support, you might need to embed custom fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Group segments by page
  const segmentsByPage = new Map<number, TextSegment[]>();
  for (const segment of segments) {
    const existing = segmentsByPage.get(segment.pageIndex) || [];
    existing.push(segment);
    segmentsByPage.set(segment.pageIndex, existing);
  }

  // Process each page
  for (const [pageIndex, pageSegments] of segmentsByPage.entries()) {
    const page = pages[pageIndex];
    if (!page) continue;

    const items = pageTextItems.get(pageIndex);
    if (!items) continue;

    // Apply translations
    for (const segment of pageSegments) {
      const translation = translations.get(segment.id);
      if (translation === undefined) continue;

      const originalItem = items[segment.itemIndex];
      if (!originalItem) continue;

      // Get position and size from transform matrix
      // transform: [scaleX, skewX, skewY, scaleY, x, y]
      const x = originalItem.transform[4];
      const y = originalItem.transform[5];
      const fontSize = Math.abs(originalItem.transform[0]) || 12;

      // Calculate cover rectangle dimensions
      // Add some padding to ensure complete coverage
      const rectWidth = originalItem.width + 4;
      const rectHeight = fontSize + 4;

      // Draw white rectangle to cover original text
      page.drawRectangle({
        x: x - 2,
        y: y - 2,
        width: rectWidth,
        height: rectHeight,
        color: rgb(1, 1, 1), // White
      });

      // Draw translated text
      // Slightly reduce font size to help fit translated text
      const adjustedFontSize = Math.min(fontSize, fontSize * 0.95);

      page.drawText(translation, {
        x,
        y,
        size: adjustedFontSize,
        font: helvetica,
        color: rgb(0, 0, 0), // Black
      });
    }
  }

  // Save the modified PDF
  const outputBytes = await pdfDoc.save();

  // Convert to base64 data URL
  const base64 = bytesToBase64(outputBytes);
  return `data:application/pdf;base64,${base64}`;
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Get a summary of the PDF structure
 */
export function getPdfSummary(parseResult: PdfParseResult): {
  totalSegments: number;
  pageCount: number;
  totalCharacters: number;
} {
  const { segments, pageTextItems } = parseResult;

  return {
    totalSegments: segments.length,
    pageCount: pageTextItems.size,
    totalCharacters: segments.reduce((sum, s) => sum + s.text.length, 0),
  };
}
