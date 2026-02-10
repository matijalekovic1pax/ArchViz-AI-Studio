/**
 * DOCX Parser Service
 * Parses Word documents into text segments with structural context.
 * Includes zip-bomb protection, style extraction, and legal section detection.
 *
 * Also contains the paragraph text replacement algorithm used by the rebuilder,
 * including hyperlink-aware replacement and proportional distribution.
 */

import JSZip from 'jszip';
import type {
  TextSegment,
  SegmentContext,
  ParsedDocx,
  ParsedLegalDocx,
  LegalSection,
  DocumentMetadata,
} from '../types';

// Re-export types used by other modules
export type { TextSegment, ParsedDocx, ParsedLegalDocx };

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const HYPERLINK_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Zip-bomb protection constants
const MAX_ZIP_ENTRIES = 500;
const MAX_DECOMPRESSED_SIZE_MB = 100;
const MAX_COMPRESSION_RATIO = 100;

// Batching defaults for metadata estimation
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_CHARS = 12000;

export interface DocxParseSettings {
  translateHeaders: boolean;
  translateFootnotes: boolean;
}

// ============================================================================
// Zip-bomb Protection
// ============================================================================

function validateZipArchive(zip: JSZip, compressedSizeBytes: number): void {
  const entries = Object.keys(zip.files);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP archive has too many entries (${entries.length} > ${MAX_ZIP_ENTRIES}). Possible zip bomb.`);
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
      `Decompressed size estimate (${Math.round(estimatedDecompressedSize / 1024 / 1024)}MB) exceeds limit (${MAX_DECOMPRESSED_SIZE_MB}MB).`
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

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a DOCX file from a data URL into segments with structural context.
 */
export async function parseDocx(
  dataUrl: string,
  settings: DocxParseSettings = { translateHeaders: true, translateFootnotes: true }
): Promise<ParsedLegalDocx> {
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

  const zip = await JSZip.loadAsync(bytes);

  // Step 1: Zip-bomb protection
  validateZipArchive(zip, bytes.length);

  const segments: TextSegment[] = [];
  const xmlDocuments = new Map<string, Document>();

  // Step 2: Choose XML files to parse
  const filesToParse: Array<{ path: string; location: SegmentContext['location'] }> = [
    { path: 'word/document.xml', location: 'body' },
  ];

  if (settings.translateHeaders) {
    for (const filename of Object.keys(zip.files)) {
      if (filename.match(/^word\/header\d*\.xml$/)) {
        filesToParse.push({ path: filename, location: 'header' });
      }
      if (filename.match(/^word\/footer\d*\.xml$/)) {
        filesToParse.push({ path: filename, location: 'footer' });
      }
    }
  }

  if (settings.translateFootnotes) {
    for (const filename of Object.keys(zip.files)) {
      if (filename === 'word/footnotes.xml') {
        filesToParse.push({ path: filename, location: 'footnote' });
      }
      if (filename === 'word/endnotes.xml') {
        filesToParse.push({ path: filename, location: 'footnote' });
      }
    }
  }

  // Step 3 & 4: Parse XML and extract segments
  for (const { path, location } of filesToParse) {
    const file = zip.file(path);
    if (!file) continue;

    const xmlString = await file.async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) continue;

    xmlDocuments.set(path, doc);
    extractParagraphSegments(doc, path, location, segments);
  }

  // Step 5: Legal section detection
  const sections = detectLegalSections(segments);

  // Step 6: Metadata
  const metadata = calculateMetadata(segments);

  return { zipInstance: zip, xmlDocuments, segments, metadata, sections };
}

// ============================================================================
// Segment Extraction
// ============================================================================

function extractParagraphSegments(
  doc: Document,
  xmlPath: string,
  location: SegmentContext['location'],
  segments: TextSegment[]
): void {
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // Concatenate all <w:t> text nodes
    const textElements = para.getElementsByTagNameNS(W_NS, 't');
    let text = '';
    for (let j = 0; j < textElements.length; j++) {
      text += textElements[j].textContent || '';
    }

    if (text.trim().length === 0) continue;

    // Detect table-cell context
    let actualLocation = location;
    let node: Element | null = para.parentElement;
    while (node) {
      if (node.localName === 'tc') {
        actualLocation = 'table-cell';
        break;
      }
      node = node.parentElement;
    }

    // Extract style info
    let styleInfo: string | undefined;
    const pPr = para.getElementsByTagNameNS(W_NS, 'pPr')[0];
    if (pPr) {
      const pStyle = pPr.getElementsByTagNameNS(W_NS, 'pStyle')[0];
      if (pStyle) {
        styleInfo = pStyle.getAttributeNS(W_NS, 'val') || pStyle.getAttribute('w:val') || undefined;
      }
    }

    segments.push({
      id: `docx-${xmlPath.replace(/[\/\.]/g, '-')}-para-${i}`,
      text,
      xmlPath,
      paragraphIndex: i,
      context: { location: actualLocation, styleInfo },
      status: 'pending',
    });
  }
}

// ============================================================================
// Legal Section Detection
// ============================================================================

function detectLegalSections(segments: TextSegment[]): LegalSection[] {
  const sections: LegalSection[] = [];
  const headingPattern = /^(?:(?:Article|Section|Chapter|Part)\s+\d+|(?:\d+[\.\)])\s|\b[IVXLCDM]+[\.\)]\s)/i;
  const headingStyles = ['Heading1', 'Heading2', 'Heading3', 'Title', 'Subtitle'];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const style = seg.context.styleInfo || '';
    const text = seg.text.trim();
    let level = 0;

    if (headingStyles.some((h) => style.includes(h))) {
      if (style.includes('Heading1') || style.includes('Title')) level = 1;
      else if (style.includes('Heading2') || style.includes('Subtitle')) level = 2;
      else level = 3;
    } else if (headingPattern.test(text)) {
      level = 2;
    } else if (text.length > 0 && text.length < 120 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
      level = 1;
    }

    if (level > 0) {
      // Close previous section at same or higher level
      if (sections.length > 0) {
        sections[sections.length - 1].endIndex = i - 1;
      }
      sections.push({ title: text, startIndex: i, endIndex: segments.length - 1, level });
    }
  }

  return sections;
}

// ============================================================================
// Metadata
// ============================================================================

function calculateMetadata(segments: TextSegment[]): DocumentMetadata {
  const totalParagraphs = segments.length;
  const totalCharacters = segments.reduce((sum, s) => sum + s.text.length, 0);

  // Simulate batching to estimate batch count
  let estimatedBatches = 0;
  let batchChars = 0;
  let batchCount = 0;
  for (const seg of segments) {
    if (batchCount >= DEFAULT_BATCH_SIZE || (batchChars + seg.text.length > DEFAULT_MAX_CHARS && batchCount > 0)) {
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

// ============================================================================
// Text Content Helper
// ============================================================================

/**
 * Sets textContent of a <w:t> element and ensures xml:space="preserve" for non-empty text.
 */
export function setTextContent(wt: Element, text: string): void {
  wt.textContent = text;
  if (text.length > 0) {
    wt.setAttribute('xml:space', 'preserve');
  }
}

// ============================================================================
// Paragraph Text Replacement — Decision Tree
// ============================================================================

/**
 * Replace paragraph text with translated text, preserving formatting.
 *
 * Decision tree:
 * 1. No <w:t> → return
 * 2. Single <w:t> → direct replace
 * 3. Has <w:hyperlink> → hyperlink-aware replacement
 * 4. forceSimple → simple replacement
 * 5. Letter-spacing or many single-char runs → simple replacement
 * 6. No formatting → simple replacement
 * 7. Otherwise → proportional distribution
 */
export function replaceParagraphText(
  paragraph: Element,
  translatedText: string,
  forceSimple: boolean = false
): void {
  const textElements = paragraph.getElementsByTagNameNS(W_NS, 't');
  if (textElements.length === 0) return;

  // Single <w:t> — direct replace
  if (textElements.length === 1) {
    setTextContent(textElements[0], translatedText);
    return;
  }

  // Check for hyperlinks
  const hyperlinks = paragraph.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'hyperlink'
  );
  // Also check the other namespace for hyperlinks
  const hyperlinksDirect = paragraph.querySelectorAll('w\\:hyperlink, hyperlink');
  const hasHyperlinks = hyperlinks.length > 0 || hyperlinksDirect.length > 0;

  // Check with the relationship namespace used in OOXML for hyperlinks
  let hyperlinkElements: Element[] = [];
  for (let i = 0; i < paragraph.children.length; i++) {
    const child = paragraph.children[i];
    if (child.localName === 'hyperlink') {
      hyperlinkElements.push(child);
    }
  }

  if (hyperlinkElements.length > 0) {
    replaceWithHyperlinkAwareness(paragraph, translatedText, hyperlinkElements);
    return;
  }

  // Force simple replacement for headers, footers, footnotes, table cells
  if (forceSimple) {
    simpleReplacement(textElements, translatedText);
    return;
  }

  // Check for letter-spacing or many single-char runs
  if (hasLetterSpacingOrShortRuns(paragraph, textElements)) {
    simpleReplacement(textElements, translatedText);
    return;
  }

  // Check if any run has formatting
  if (!hasAnyFormatting(paragraph)) {
    simpleReplacement(textElements, translatedText);
    return;
  }

  // Proportional distribution across formatted runs
  proportionalDistribution(textElements, translatedText);
}

// ============================================================================
// Simple Replacement
// ============================================================================

function simpleReplacement(textElements: HTMLCollectionOf<Element>, translatedText: string): void {
  setTextContent(textElements[0], translatedText);
  for (let i = 1; i < textElements.length; i++) {
    setTextContent(textElements[i], '');
  }
}

// ============================================================================
// Hyperlink-Aware Replacement
// ============================================================================

interface ContentZone {
  type: 'text' | 'hyperlink';
  textElements: Element[];
  originalText: string;
  assignedText?: string;
}

function buildContentZones(paragraph: Element, hyperlinkElements: Element[]): ContentZone[] {
  const zones: ContentZone[] = [];
  const hyperlinkSet = new Set(hyperlinkElements);
  let currentTextZone: ContentZone | null = null;

  for (let i = 0; i < paragraph.children.length; i++) {
    const child = paragraph.children[i];

    if (hyperlinkSet.has(child)) {
      // Flush current text zone
      if (currentTextZone && currentTextZone.textElements.length > 0) {
        zones.push(currentTextZone);
        currentTextZone = null;
      }

      // Build hyperlink zone
      const textEls = child.getElementsByTagNameNS(W_NS, 't');
      const els: Element[] = [];
      let text = '';
      for (let j = 0; j < textEls.length; j++) {
        els.push(textEls[j]);
        text += textEls[j].textContent || '';
      }
      zones.push({ type: 'hyperlink', textElements: els, originalText: text });
    } else if (child.localName === 'r' && child.namespaceURI === W_NS) {
      // Regular run — add to text zone
      if (!currentTextZone) {
        currentTextZone = { type: 'text', textElements: [], originalText: '' };
      }
      const textEls = child.getElementsByTagNameNS(W_NS, 't');
      for (let j = 0; j < textEls.length; j++) {
        currentTextZone.textElements.push(textEls[j]);
        currentTextZone.originalText += textEls[j].textContent || '';
      }
    }
    // Ignore non-text nodes (pPr, bookmarks, proofErr, etc.)
  }

  if (currentTextZone && currentTextZone.textElements.length > 0) {
    zones.push(currentTextZone);
  }

  return zones;
}

function splitTranslatedTextByZones(zones: ContentZone[], translatedText: string): void {
  const hyperlinkZones = zones.filter((z) => z.type === 'hyperlink');

  // Try to find each hyperlink's original text in the translation
  let searchStart = 0;
  const matchPositions: Array<{ zone: ContentZone; start: number; end: number }> = [];

  for (const hz of hyperlinkZones) {
    const idx = translatedText.indexOf(hz.originalText, searchStart);
    if (idx >= 0) {
      matchPositions.push({ zone: hz, start: idx, end: idx + hz.originalText.length });
      searchStart = idx + hz.originalText.length;
    }
  }

  if (matchPositions.length === 0) {
    // No hyperlinks matched — fallback to proportional distribution across all zones
    const totalOrigLen = zones.reduce((s, z) => s + z.originalText.length, 0);
    if (totalOrigLen === 0) {
      if (zones.length > 0) zones[0].assignedText = translatedText;
      return;
    }

    let remaining = translatedText;
    let remainingOrigLen = totalOrigLen;
    for (let i = 0; i < zones.length; i++) {
      if (i === zones.length - 1) {
        zones[i].assignedText = remaining;
      } else {
        const proportion = zones[i].originalText.length / remainingOrigLen;
        const targetLen = Math.round(remaining.length * proportion);
        zones[i].assignedText = remaining.substring(0, targetLen);
        remaining = remaining.substring(targetLen);
        remainingOrigLen -= zones[i].originalText.length;
      }
    }
    return;
  }

  // Build segments: text before first hyperlink, hyperlinks, text between, text after last
  let pos = 0;
  let textZoneIdx = 0;

  for (const match of matchPositions) {
    // Text before this hyperlink
    const textBefore = translatedText.substring(pos, match.start);
    // Assign to text zones that come before this hyperlink
    while (textZoneIdx < zones.length && zones[textZoneIdx] !== match.zone) {
      if (zones[textZoneIdx].type === 'text' && zones[textZoneIdx].assignedText === undefined) {
        zones[textZoneIdx].assignedText = textBefore;
        break;
      }
      textZoneIdx++;
    }
    // If no text zone got it, find the nearest text zone
    if (textBefore.length > 0) {
      const unassignedText = zones.find(
        (z) => z.type === 'text' && z.assignedText === undefined
      );
      if (unassignedText) {
        unassignedText.assignedText = (unassignedText.assignedText || '') + textBefore;
      }
    }

    // Hyperlink keeps its original text
    match.zone.assignedText = match.zone.originalText;
    pos = match.end;
  }

  // Text after last hyperlink
  const textAfter = translatedText.substring(pos);
  if (textAfter.length > 0) {
    // Find last text zone or append to last zone
    const lastTextZone = [...zones].reverse().find((z) => z.type === 'text');
    if (lastTextZone) {
      lastTextZone.assignedText = (lastTextZone.assignedText || '') + textAfter;
    }
  }

  // Unmatched hyperlink zones keep original text
  for (const hz of hyperlinkZones) {
    if (hz.assignedText === undefined) {
      hz.assignedText = hz.originalText;
    }
  }

  // Unmatched text zones get empty string
  for (const z of zones) {
    if (z.assignedText === undefined) {
      z.assignedText = '';
    }
  }
}

function replaceWithHyperlinkAwareness(
  paragraph: Element,
  translatedText: string,
  hyperlinkElements: Element[]
): void {
  const zones = buildContentZones(paragraph, hyperlinkElements);
  if (zones.length === 0) return;

  splitTranslatedTextByZones(zones, translatedText);

  // Write back
  for (const zone of zones) {
    const text = zone.assignedText ?? zone.originalText;
    if (zone.textElements.length > 0) {
      setTextContent(zone.textElements[0], text);
      for (let i = 1; i < zone.textElements.length; i++) {
        setTextContent(zone.textElements[i], '');
      }
    }
  }
}

// ============================================================================
// Letter-Spacing & Short-Run Detection
// ============================================================================

function hasLetterSpacingOrShortRuns(
  paragraph: Element,
  textElements: HTMLCollectionOf<Element>
): boolean {
  let singleCharRunCount = 0;
  const runs = paragraph.getElementsByTagNameNS(W_NS, 'r');

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];

    // Check for letter-spacing
    const rPr = run.getElementsByTagNameNS(W_NS, 'rPr')[0];
    if (rPr) {
      const spacing = rPr.getElementsByTagNameNS(W_NS, 'spacing')[0];
      if (spacing) {
        const val = spacing.getAttributeNS(W_NS, 'val') || spacing.getAttribute('w:val');
        if (val && val !== '0') return true;
      }
    }

    // Check for single-char runs
    const runTextEls = run.getElementsByTagNameNS(W_NS, 't');
    for (let j = 0; j < runTextEls.length; j++) {
      const content = runTextEls[j].textContent || '';
      if (content.length === 1) singleCharRunCount++;
    }
  }

  const totalTextElements = textElements.length;
  return singleCharRunCount >= 3 && singleCharRunCount > 0.3 * totalTextElements;
}

// ============================================================================
// Formatting Detection
// ============================================================================

const FORMATTING_TAGS = [
  'b', 'i', 'u', 'strike', 'color', 'highlight', 'sz', 'rFonts',
  'vertAlign', 'caps', 'shd', 'outline', 'shadow', 'emboss', 'imprint',
  'dstrike', 'smallCaps', 'vanish',
];

function runHasFormatting(run: Element): boolean {
  const rPr = run.getElementsByTagNameNS(W_NS, 'rPr')[0];
  if (!rPr) return false;

  for (const tag of FORMATTING_TAGS) {
    const els = rPr.getElementsByTagNameNS(W_NS, tag);
    if (els.length > 0) return true;
  }
  return false;
}

function hasAnyFormatting(paragraph: Element): boolean {
  const runs = paragraph.getElementsByTagNameNS(W_NS, 'r');
  for (let i = 0; i < runs.length; i++) {
    if (runHasFormatting(runs[i])) return true;
  }
  return false;
}

// ============================================================================
// Proportional Distribution
// ============================================================================

function proportionalDistribution(
  textElements: HTMLCollectionOf<Element>,
  translatedText: string
): void {
  // Gather original lengths
  const originalLengths: number[] = [];
  for (let i = 0; i < textElements.length; i++) {
    originalLengths.push((textElements[i].textContent || '').length);
  }

  const totalOriginalLength = originalLengths.reduce((a, b) => a + b, 0);

  if (totalOriginalLength === 0) {
    simpleReplacement(textElements, translatedText);
    return;
  }

  let remainingText = translatedText;
  let remainingOriginalLength = totalOriginalLength;

  for (let i = 0; i < textElements.length; i++) {
    if (i === textElements.length - 1) {
      // Last run gets all remaining text
      setTextContent(textElements[i], remainingText);
    } else {
      const proportion = originalLengths[i] / remainingOriginalLength;
      let targetLength = Math.round(remainingText.length * proportion);

      // Try to shift break to nearest space within ±10 characters
      targetLength = findNearestSpaceBreak(remainingText, targetLength, 10);

      const chunk = remainingText.substring(0, targetLength);
      setTextContent(textElements[i], chunk);

      remainingText = remainingText.substring(targetLength);
      remainingOriginalLength -= originalLengths[i];

      if (remainingOriginalLength <= 0) {
        // Clear remaining text elements
        for (let j = i + 1; j < textElements.length; j++) {
          setTextContent(textElements[j], '');
        }
        return;
      }
    }
  }
}

function findNearestSpaceBreak(text: string, targetPos: number, range: number): number {
  if (targetPos <= 0) return 0;
  if (targetPos >= text.length) return text.length;

  const start = Math.max(0, targetPos - range);
  const end = Math.min(text.length, targetPos + range);

  let bestPos = targetPos;
  let bestDist = range + 1;

  for (let i = start; i <= end; i++) {
    if (text[i] === ' ') {
      const dist = Math.abs(i - targetPos);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = i + 1; // Break after the space
      }
    }
  }

  return bestPos;
}

// ============================================================================
// Document Summary (kept for backward compat)
// ============================================================================

export function getDocumentSummary(parseResult: ParsedDocx): {
  totalSegments: number;
  paragraphCount: number;
  tableCellCount: number;
  headerCount: number;
  footerCount: number;
  footnoteCount: number;
  totalCharacters: number;
} {
  const { segments } = parseResult;

  return {
    totalSegments: segments.length,
    paragraphCount: segments.filter((s) => s.context.location === 'body').length,
    tableCellCount: segments.filter((s) => s.context.location === 'table-cell').length,
    headerCount: segments.filter((s) => s.context.location === 'header').length,
    footerCount: segments.filter((s) => s.context.location === 'footer').length,
    footnoteCount: segments.filter((s) => s.context.location === 'footnote').length,
    totalCharacters: segments.reduce((sum, s) => sum + s.text.length, 0),
  };
}
