/**
 * PPTX Parser Service
 * Extracts editable DrawingML text from PowerPoint presentations while keeping
 * the original OOXML package available for structure-preserving rebuilds.
 */

import JSZip from 'jszip';
import type {
  DocumentMetadata,
  ParsedPptx,
  PptxTranslationTarget,
  TextSegment,
} from '../types';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_CHARS = 12000;

const MAX_FILE_SIZE_MB = 100;
const MAX_ZIP_ENTRIES = 2500;
const MAX_DECOMPRESSED_SIZE_MB = 300;
const MAX_COMPRESSION_RATIO = 150;

const TRANSLATABLE_PPTX_PREFIXES = [
  'ppt/slides/',
  'ppt/notesSlides/',
  'ppt/slideMasters/',
  'ppt/slideLayouts/',
  'ppt/charts/',
  'ppt/diagrams/',
];

/**
 * Parse a PPTX file from a data URL into paragraph-level translation segments.
 */
export async function parsePptx(dataUrl: string): Promise<ParsedPptx> {
  const bytes = dataUrlToBytes(dataUrl);

  if (bytes.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
  }

  const zip = await JSZip.loadAsync(bytes);
  validateZipArchive(zip, bytes.length);

  if (!zip.file('ppt/presentation.xml')) {
    throw new Error('Invalid PowerPoint file: missing presentation.xml.');
  }

  const xmlDocuments = new Map<string, Document>();
  const segments: TextSegment[] = [];
  const targetMap = new Map<string, PptxTranslationTarget>();
  let detectedTextCount = 0;

  const xmlPaths = Object.keys(zip.files)
    .filter((path) => isTranslatablePptxXmlPath(path, zip.files[path].dir))
    .sort(naturalZipPathSort);

  for (const xmlPath of xmlPaths) {
    const doc = await parseXmlFromZip(zip, xmlPath);
    if (!doc) continue;

    xmlDocuments.set(xmlPath, doc);

    const paragraphs = doc.getElementsByTagNameNS(A_NS, 'p');
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const textElements = getDrawingTextElements(paragraph);
      if (textElements.length === 0) continue;

      const text = textElements.map((el) => el.textContent || '').join('');
      if (text.trim().length === 0) continue;

      detectedTextCount++;

      const segmentId = `pptx-${xmlPath.replace(/[/.]/g, '-')}-para-${i}`;
      segments.push({
        id: segmentId,
        text,
        xmlPath,
        paragraphIndex: i,
        context: {
          location: 'body',
          styleInfo: describePptxLocation(xmlPath),
        },
        status: 'pending',
      });

      targetMap.set(segmentId, {
        xmlPath,
        textElements,
      });
    }

    if (xmlPath.startsWith('ppt/charts/')) {
      const chartValues = doc.getElementsByTagNameNS(C_NS, 'v');
      for (let i = 0; i < chartValues.length; i++) {
        const valueElement = chartValues[i];
        const text = valueElement.textContent || '';
        if (!isTranslatableChartString(valueElement, text)) continue;

        detectedTextCount++;

        const segmentId = `pptx-${xmlPath.replace(/[/.]/g, '-')}-chart-value-${i}`;
        segments.push({
          id: segmentId,
          text,
          xmlPath,
          paragraphIndex: i,
          context: {
            location: 'body',
            styleInfo: describePptxLocation(xmlPath),
          },
          status: 'pending',
        });

        targetMap.set(segmentId, {
          xmlPath,
          textElements: [valueElement],
        });
      }
    }
  }

  if (xmlPaths.length === 0) {
    throw new Error('No editable presentation XML parts found in PowerPoint file.');
  }

  return {
    zipInstance: zip,
    xmlDocuments,
    segments,
    targetMap,
    detectedTextCount,
    slideCount: countSlides(zip),
    metadata: calculateMetadata(segments),
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid data URL format');
  }

  const binary = atob(base64Match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isTranslatablePptxXmlPath(path: string, isDir?: boolean): boolean {
  if (isDir || !path.endsWith('.xml')) return false;
  return TRANSLATABLE_PPTX_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function parseXmlFromZip(zip: JSZip, path: string): Promise<Document | null> {
  const file = zip.file(path);
  if (!file) return null;

  const xml = await file.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }

  return doc;
}

function getDrawingTextElements(paragraph: Element): Element[] {
  const nodes = paragraph.getElementsByTagNameNS(A_NS, 't');
  const textElements: Element[] = [];

  for (let i = 0; i < nodes.length; i++) {
    textElements.push(nodes[i]);
  }

  return textElements;
}

function isTranslatableChartString(valueElement: Element, text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (!hasAncestorWithLocalName(valueElement, 'strCache') && !hasAncestorWithLocalName(valueElement, 'strLit')) {
    return false;
  }

  return /[A-Za-zÀ-ž\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\u0600-\u06FF]/.test(trimmed);
}

function hasAncestorWithLocalName(element: Element, localName: string): boolean {
  let current: Element | null = element.parentElement;
  while (current) {
    if (current.namespaceURI === C_NS && current.localName === localName) return true;
    current = current.parentElement;
  }
  return false;
}

function validateZipArchive(zip: JSZip, compressedSizeBytes: number): void {
  const entries = Object.keys(zip.files);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(
      `ZIP archive has too many entries (${entries.length} > ${MAX_ZIP_ENTRIES}). Possible zip bomb.`
    );
  }

  let estimatedDecompressedSize = 0;
  for (const filename of entries) {
    const file = zip.files[filename];
    if (file && (file as any)._data && (file as any)._data.uncompressedSize) {
      estimatedDecompressedSize += (file as any)._data.uncompressedSize;
    }
  }

  const maxDecompressedBytes = MAX_DECOMPRESSED_SIZE_MB * 1024 * 1024;
  if (estimatedDecompressedSize > maxDecompressedBytes) {
    throw new Error(
      `Decompressed size estimate (${Math.round(
        estimatedDecompressedSize / 1024 / 1024
      )}MB) exceeds limit (${MAX_DECOMPRESSED_SIZE_MB}MB).`
    );
  }

  if (compressedSizeBytes > 0 && estimatedDecompressedSize > 0) {
    const ratio = estimatedDecompressedSize / compressedSizeBytes;
    if (ratio > MAX_COMPRESSION_RATIO) {
      throw new Error(
        `Compression ratio (${Math.round(ratio)}) exceeds limit (${MAX_COMPRESSION_RATIO}). Possible zip bomb.`
      );
    }
  }
}

function countSlides(zip: JSZip): number {
  return Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).length;
}

function naturalZipPathSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function describePptxLocation(xmlPath: string): string {
  if (xmlPath.startsWith('ppt/slides/')) return `Slide ${extractNumber(xmlPath) || ''}`.trim();
  if (xmlPath.startsWith('ppt/notesSlides/')) return `Speaker notes ${extractNumber(xmlPath) || ''}`.trim();
  if (xmlPath.startsWith('ppt/slideMasters/')) return 'Slide master';
  if (xmlPath.startsWith('ppt/slideLayouts/')) return 'Slide layout';
  if (xmlPath.startsWith('ppt/charts/')) return 'Chart';
  if (xmlPath.startsWith('ppt/diagrams/')) return 'Diagram';
  return 'Presentation';
}

function extractNumber(value: string): string | null {
  const match = value.match(/(\d+)\.xml$/);
  return match?.[1] || null;
}

function calculateMetadata(segments: TextSegment[]): DocumentMetadata {
  const totalParagraphs = segments.length;
  const totalCharacters = segments.reduce((sum, s) => sum + s.text.length, 0);

  let estimatedBatches = 0;
  let batchChars = 0;
  let batchCount = 0;
  for (const seg of segments) {
    if (
      batchCount >= DEFAULT_BATCH_SIZE ||
      (batchChars + seg.text.length > DEFAULT_MAX_CHARS && batchCount > 0)
    ) {
      estimatedBatches++;
      batchChars = 0;
      batchCount = 0;
    }
    batchChars += seg.text.length;
    batchCount++;
  }
  if (batchCount > 0) estimatedBatches++;

  return { totalParagraphs, totalCharacters, estimatedBatches };
}

export function getPptxSummary(parseResult: ParsedPptx): {
  totalSegments: number;
  slideCount: number;
  totalCharacters: number;
} {
  return {
    totalSegments: parseResult.segments.length,
    slideCount: parseResult.slideCount,
    totalCharacters: parseResult.segments.reduce((sum, s) => sum + s.text.length, 0),
  };
}
