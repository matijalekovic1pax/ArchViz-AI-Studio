/**
 * PDF Parser Service
 * Parses PDF documents to extract text and rebuilds with translations
 * Uses pdfjs-dist for extraction and pdf-lib for modification
 *
 * NOTE: PDF text replacement has inherent limitations.
 * The approach: cover original text with white rectangles and overlay translated text.
 * This may cause minor layout differences, especially with non-Latin fonts.
 */


import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';

// Set up the worker - use local worker from node_modules
// @ts-ignore - Vite will resolve this correctly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = pdfjsWorker;

import { PDFDocument, rgb, PDFFont } from 'pdf-lib';
import * as fontkit from 'fontkit';

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

export interface LineGroup {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  items: PdfTextItem[];
}

export interface PdfParseResult {
  segments: TextSegment[];
  pdfBytes: Uint8Array;
  originalDataUrl: string; // Store original dataUrl for pdf-lib
  pageTextItems: Map<number, PdfTextItem[]>;
  pageLines: Map<number, LineGroup[]>; // NEW: Grouped lines per page
}

/**
 * Convert data URL to ArrayBuffer
 */
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid data URL format. Expected: data:application/pdf;base64,...');
  }

  const base64 = base64Match[1].trim(); // Remove any whitespace

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Validate PDF header
    const header = String.fromCharCode.apply(null, Array.from(bytes.slice(0, 5)));
    if (!header.startsWith('%PDF-')) {
      console.error('Invalid PDF header. First 20 bytes:', Array.from(bytes.slice(0, 20)));
      throw new Error('Invalid PDF file: Missing PDF header. The file may be corrupted.');
    }

    return bytes.buffer;
  } catch (error) {
    if (error instanceof Error && error.message.includes('PDF header')) {
      throw error;
    }
    throw new Error('Failed to decode base64 PDF data: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Group text items into lines using spatial thresholds
 * Based on research: Y-overlap threshold 0.8, X-gap thresholds 0.15/0.6
 */
function groupTextItemsIntoLines(items: PdfTextItem[]): LineGroup[] {
  if (items.length === 0) return [];

  // Sort by Y coordinate (vertical position)
  const sorted = [...items].sort((a, b) => a.transform[5] - b.transform[5]);

  const lines: LineGroup[] = [];
  let currentLineItems: PdfTextItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const currentItem = sorted[i];
    const lastItem = currentLineItems[currentLineItems.length - 1];

    // Calculate Y-axis overlap
    const currentY = currentItem.transform[5];
    const currentHeight = currentItem.height;
    const lastY = lastItem.transform[5];
    const lastHeight = lastItem.height;

    // Calculate overlap as proportion (1.0 = perfect overlap)
    const minY = Math.max(currentY, lastY);
    const maxY = Math.min(currentY + currentHeight, lastY + lastHeight);
    const overlap = Math.max(0, maxY - minY);
    const avgHeight = (currentHeight + lastHeight) / 2;
    const overlapRatio = overlap / avgHeight;

    // If Y-overlap > 0.8, items are on the same line
    if (overlapRatio > 0.8) {
      currentLineItems.push(currentItem);
    } else {
      // Process completed line
      lines.push(createLineFromItems(currentLineItems));
      currentLineItems = [currentItem];
    }
  }

  // Process final line
  if (currentLineItems.length > 0) {
    lines.push(createLineFromItems(currentLineItems));
  }

  return lines;
}

/**
 * Create a LineGroup from text items, merging text with proper spacing
 */
function createLineFromItems(items: PdfTextItem[]): LineGroup {
  // Sort items left to right (by X coordinate)
  const sorted = [...items].sort((a, b) => a.transform[4] - b.transform[4]);

  // Build text with proper spacing detection
  let text = '';
  let prevX = 0;
  let prevWidth = 0;
  const avgHeight = sorted.reduce((sum, item) => sum + item.height, 0) / sorted.length;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const currentX = item.transform[4];

    if (i > 0) {
      // Calculate gap between previous item and current item
      const gap = currentX - (prevX + prevWidth);
      const gapRatio = gap / avgHeight;

      // X-axis gap thresholds from research:
      // < 0.15 × height: no space (characters in same word)
      // 0.15-0.6 × height: add space (word boundary)
      // > 0.6 × height: large gap (keep for now as single space)
      if (gapRatio > 0.15) {
        text += ' ';
      }
    }

    text += item.str;
    prevX = currentX;
    prevWidth = item.width;
  }

  // Calculate line bounding box
  const firstItem = sorted[0];
  const lastItem = sorted[sorted.length - 1];

  return {
    text: text.trim(),
    x: firstItem.transform[4],
    y: firstItem.transform[5],
    width: (lastItem.transform[4] + lastItem.width) - firstItem.transform[4],
    height: avgHeight,
    fontSize: Math.abs(firstItem.transform[0]) || 12,
    items: sorted
  };
}

/**
 * Parse a PDF file from a data URL
 */
export async function parsePdf(dataUrl: string): Promise<PdfParseResult> {
  console.log('📄 Parsing PDF, dataUrl length:', dataUrl.length);
  console.log('📄 DataUrl starts with:', dataUrl.substring(0, 50));

  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  const bytes = new Uint8Array(arrayBuffer);

  console.log('📄 PDF bytes length:', bytes.length);
  console.log('📄 First 10 bytes:', Array.from(bytes.slice(0, 10)));

  // Load with pdfjs for text extraction
  const loadingTask = getDocument({ data: bytes });
  let pdfJsDoc: PDFDocumentProxy;
  try {
    pdfJsDoc = await loadingTask.promise;
    console.log('📄 PDF loaded successfully, pages:', pdfJsDoc.numPages);
  } catch (error) {
    console.error('📄 Failed to load PDF with PDF.js:', error);
    throw new Error(
      'Failed to parse PDF document: ' +
        (error instanceof Error ? error.message : 'Unknown error') +
        '. The PDF file may be corrupted or password-protected.'
    );
  }

  const segments: TextSegment[] = [];
  const pageTextItems = new Map<number, PdfTextItem[]>();
  const pageLines = new Map<number, LineGroup[]>();

  // Process each page
  for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
    const page = await pdfJsDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PdfTextItem[] = [];

    // Collect all text items for the page
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
    }

    // Group items into lines using spatial thresholds
    const lines = groupTextItemsIntoLines(items);
    console.log(`📄 Page ${pageNum}: ${items.length} items → ${lines.length} lines`);

    // Create segments from lines (not individual items)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      segments.push({
        id: `pdf-${pageNum}-line-${lineIndex}`,
        text: line.text,
        pageIndex: pageNum - 1, // 0-indexed for pdf-lib
        itemIndex: lineIndex,
        transform: [line.fontSize, 0, 0, line.fontSize, line.x, line.y],
        width: line.width,
        height: line.height,
        context: 'paragraph',
      });
    }

    pageTextItems.set(pageNum - 1, items);
    pageLines.set(pageNum - 1, lines);
  }

  return { segments, pdfBytes: bytes, originalDataUrl: dataUrl, pageTextItems, pageLines };
}

/**
 * Rebuild a PDF file with translated text
 */
export async function rebuildPdf(
  parseResult: PdfParseResult,
  translations: Map<string, string>
): Promise<string> {
  console.log('📄 Rebuilding PDF with', translations.size, 'translations');
  const { originalDataUrl } = parseResult;

  // Reload PDF bytes specifically for pdf-lib from the original dataUrl
  // This ensures pdf-lib gets fresh, properly formatted bytes
  console.log('📄 Reloading PDF from originalDataUrl for pdf-lib...');
  const arrayBuffer = dataUrlToArrayBuffer(originalDataUrl);
  const pdfBytes = new Uint8Array(arrayBuffer);
  console.log('📄 Reloaded PDF bytes length:', pdfBytes.length);
  console.log('📄 First 10 bytes:', Array.from(pdfBytes.slice(0, 10)));

  // Load the PDF with pdf-lib
  console.log('📄 Loading PDF with pdf-lib...');
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Register fontkit to enable custom font embedding (required for Unicode fonts)
  // @ts-ignore - fontkit types don't perfectly match pdf-lib expectations but work at runtime
  pdfDoc.registerFontkit(fontkit);
  console.log('📄 Fontkit registered for custom font support');

  const pages = pdfDoc.getPages();
  console.log('📄 PDF loaded,', pages.length, 'pages');

  // Embed Unicode-compatible font for international character support
  console.log('📄 Embedding Unicode font for multilingual support...');

  // Noto Sans supports ALL Unicode characters: Latin, Cyrillic, Greek, Arabic, Chinese, Japanese, Korean, etc.
  let unicodeFont: PDFFont;
  try {
    // Try sources in order: local bundled font → CDN fallbacks
    const fontSources = [
      { url: '/fonts/NotoSans-Regular.ttf', description: 'local bundled font' },
      { url: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/notosans/NotoSans-Regular.ttf', description: 'jsDelivr CDN' },
      { url: 'https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjc5a7dv.woff2', description: 'Google Fonts CDN' }
    ];

    let fontLoaded = false;
    let lastError: Error | null = null;

    for (const source of fontSources) {
      try {
        console.log(`📄 Loading Noto Sans from ${source.description}...`);
        const fontResponse = await fetch(source.url);
        if (!fontResponse.ok) {
          throw new Error(`HTTP ${fontResponse.status}`);
        }
        const fontBytes = await fontResponse.arrayBuffer();

        if (fontBytes.byteLength < 1000) {
          throw new Error(`Invalid font file (too small: ${fontBytes.byteLength} bytes)`);
        }

        console.log(`📄 Font loaded successfully, size: ${(fontBytes.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // Embed font without subsetting (subsetting has compatibility issues in browser)
        // This embeds the full font, resulting in larger PDF but ensuring compatibility
        console.log(`📄 Embedding font (full, no subsetting)...`);
        unicodeFont = await pdfDoc.embedFont(fontBytes);
        console.log(`✅ Unicode font embedded successfully from ${source.description}`);
        fontLoaded = true;
        break;
      } catch (error) {
        console.warn(`⚠️ Failed to load from ${source.description}:`, error instanceof Error ? error.message : error);
        lastError = error as Error;
        continue;
      }
    }

    if (!fontLoaded) {
      throw new Error(
        'Failed to load Unicode font from all sources. ' +
        'Last error: ' + (lastError?.message || 'Unknown error')
      );
    }
  } catch (fontError) {
    console.error('❌ CRITICAL: Failed to embed Unicode font:', fontError);
    throw new Error(
      'Cannot translate PDF with international characters. ' +
      'Unicode font loading failed. Please ensure the font file exists at public/fonts/NotoSans-Regular.ttf ' +
      'or check your internet connection for CDN access. ' +
      'Error: ' + (fontError instanceof Error ? fontError.message : 'Unknown error')
    );
  }
  console.log('📄 Fonts embedded');

  // Process each page using line-based approach
  const { pageLines } = parseResult;
  console.log('📄 Processing', pageLines.size, 'pages with line-based rendering');

  for (const [pageIndex, lines] of pageLines.entries()) {
    const page = pages[pageIndex];
    if (!page) continue;

    console.log(`📄 Page ${pageIndex + 1}: ${lines.length} lines`);

    // Apply translations line by line
    let appliedCount = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const segmentId = `pdf-${pageIndex + 1}-line-${lineIndex}`;
      const translation = translations.get(segmentId);

      if (translation === undefined) continue;

      appliedCount++;

      // Get line position and dimensions
      const x = line.x;
      const y = line.y;
      const fontSize = line.fontSize;

      // Cover entire line area with white rectangle
      // Add padding to ensure complete coverage
      const rectWidth = line.width + 4;
      const rectHeight = line.height + 4;

      page.drawRectangle({
        x: x - 2,
        y: y - 2,
        width: rectWidth,
        height: rectHeight,
        color: rgb(1, 1, 1), // White
      });

      // Draw translated text at line start position with original font size
      page.drawText(translation, {
        x,
        y,
        size: fontSize,
        font: unicodeFont,
        color: rgb(0, 0, 0), // Black
      });
    }

    console.log(`📄 Page ${pageIndex + 1}: Applied ${appliedCount} line translations`);
  }

  // Save the modified PDF
  console.log('📄 Saving modified PDF...');
  const outputBytes = await pdfDoc.save();
  console.log('📄 PDF saved, size:', outputBytes.length, 'bytes');

  // Convert to base64 data URL
  console.log('📄 Converting to base64...');
  const base64 = bytesToBase64(outputBytes);
  console.log('📄 Base64 conversion complete, length:', base64.length);
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
