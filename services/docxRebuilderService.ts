/**
 * DOCX Rebuilder Service
 * Rebuilds a DOCX by injecting translated text while preserving formatting, hyperlinks, and layout.
 * Includes page-break cleanup and style normalization.
 */

import type { ParsedDocx, TextSegment } from '../types';
import { replaceParagraphText, setTextContent } from './docxParserService';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ============================================================================
// Main Rebuild
// ============================================================================

/**
 * Rebuild a DOCX file with translated text applied to each segment's paragraph.
 */
export async function rebuildDocx(
  parsedDocx: ParsedDocx,
  translations: Map<string, string>
): Promise<string> {
  const { zipInstance: zip, xmlDocuments, segments } = parsedDocx;

  // Step 1: Group segments by XML path
  const segmentsByPath = new Map<string, TextSegment[]>();
  for (const segment of segments) {
    const existing = segmentsByPath.get(segment.xmlPath) || [];
    existing.push(segment);
    segmentsByPath.set(segment.xmlPath, existing);
  }

  // Step 2: For each XML path, apply translations
  for (const [xmlPath, pathSegments] of segmentsByPath.entries()) {
    const doc = xmlDocuments.get(xmlPath);
    if (!doc) continue;

    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');

    for (const segment of pathSegments) {
      const translation = translations.get(segment.id);
      if (translation === undefined) continue;

      const paragraph = paragraphs[segment.paragraphIndex];
      if (!paragraph) continue;

      // Use simple replacement for header, footer, footnote, table-cell
      const useSimpleReplacement =
        segment.context.location === 'header' ||
        segment.context.location === 'footer' ||
        segment.context.location === 'footnote' ||
        segment.context.location === 'table-cell';

      replaceParagraphText(paragraph, translation, useSimpleReplacement);
    }

    // Step 3: Serialize updated XML
    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(doc);
    zip.file(xmlPath, newXmlString);
  }

  // Step 4: Always cleanup the main document
  const docXmlDoc = xmlDocuments.get('word/document.xml');
  if (docXmlDoc) {
    cleanupPageBreaks(docXmlDoc);
    const serializer = new XMLSerializer();
    zip.file('word/document.xml', serializer.serializeToString(docXmlDoc));
  }

  // Step 5: Cleanup styles and numbering
  await cleanupStylesInZip(zip);

  // Step 6: Generate output
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: DOCX_MIME,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// Page-Break Cleanup
// ============================================================================

function cleanupPageBreaks(doc: Document): void {
  // Remove all w:pageBreakBefore from paragraph properties
  removeAllElements(doc, W_NS, 'pageBreakBefore');

  // Remove all w:lastRenderedPageBreak
  removeAllElements(doc, W_NS, 'lastRenderedPageBreak');

  // Remove w:br with w:type="page" or "column"
  const breaks = doc.getElementsByTagNameNS(W_NS, 'br');
  const breaksToRemove: Element[] = [];
  for (let i = 0; i < breaks.length; i++) {
    const br = breaks[i];
    const brType = br.getAttributeNS(W_NS, 'type') || br.getAttribute('w:type');
    if (brType === 'page' || brType === 'column') {
      breaksToRemove.push(br);
    }
  }
  for (const br of breaksToRemove) {
    br.parentElement?.removeChild(br);
  }

  // Normalize section breaks
  normalizeSectionBreaks(doc);

  // Remove paragraph-level w:sectPr inside w:pPr
  const pPrs = doc.getElementsByTagNameNS(W_NS, 'pPr');
  for (let i = 0; i < pPrs.length; i++) {
    const sectPrs = pPrs[i].getElementsByTagNameNS(W_NS, 'sectPr');
    const toRemove: Element[] = [];
    for (let j = 0; j < sectPrs.length; j++) {
      toRemove.push(sectPrs[j]);
    }
    for (const el of toRemove) {
      el.parentElement?.removeChild(el);
    }
  }

  // Modify w:framePr with w:vAnchor="page" or w:hAnchor="page" to text/margin
  const framePrs = doc.getElementsByTagNameNS(W_NS, 'framePr');
  for (let i = 0; i < framePrs.length; i++) {
    const fp = framePrs[i];
    const vAnchor = fp.getAttributeNS(W_NS, 'vAnchor') || fp.getAttribute('w:vAnchor');
    const hAnchor = fp.getAttributeNS(W_NS, 'hAnchor') || fp.getAttribute('w:hAnchor');
    if (vAnchor === 'page') {
      if (fp.hasAttributeNS(W_NS, 'vAnchor')) fp.setAttributeNS(W_NS, 'w:vAnchor', 'text');
      else if (fp.hasAttribute('w:vAnchor')) fp.setAttribute('w:vAnchor', 'text');
    }
    if (hAnchor === 'page') {
      if (fp.hasAttributeNS(W_NS, 'hAnchor')) fp.setAttributeNS(W_NS, 'w:hAnchor', 'margin');
      else if (fp.hasAttribute('w:hAnchor')) fp.setAttribute('w:hAnchor', 'margin');
    }
  }

  // Disable w:widowControl
  const widowControls = doc.getElementsByTagNameNS(W_NS, 'widowControl');
  for (let i = 0; i < widowControls.length; i++) {
    const wc = widowControls[i];
    const val = wc.getAttributeNS(W_NS, 'val') || wc.getAttribute('w:val');
    if (val !== '0' && val !== 'false') {
      if (wc.hasAttributeNS(W_NS, 'val')) wc.setAttributeNS(W_NS, 'w:val', '0');
      else wc.setAttribute('w:val', '0');
    }
  }

  // Remove w:keepNext and w:keepLines
  removeAllElements(doc, W_NS, 'keepNext');
  removeAllElements(doc, W_NS, 'keepLines');

  // Cap paragraph spacing (before/after > 480 twips → clamp to 480)
  capParagraphSpacing(doc);

  // Remove excessive consecutive empty paragraphs
  removeExcessiveEmptyParagraphs(doc);
}

// ============================================================================
// Section Break Normalization
// ============================================================================

function normalizeSectionBreaks(doc: Document): void {
  const allSectPrs = doc.getElementsByTagNameNS(W_NS, 'sectPr');
  if (allSectPrs.length <= 1) return;

  // Find the final body-level sectPr (last one whose parent is w:body)
  let finalSectPr: Element | null = null;
  const nonFinalSectPrs: Element[] = [];

  for (let i = allSectPrs.length - 1; i >= 0; i--) {
    const sp = allSectPrs[i];
    const parentName = sp.parentElement?.localName;
    if (!finalSectPr && parentName === 'body') {
      finalSectPr = sp;
    } else {
      nonFinalSectPrs.push(sp);
    }
  }

  // Set all non-final sectPr to continuous
  for (const sp of nonFinalSectPrs) {
    let typeEl = sp.getElementsByTagNameNS(W_NS, 'type')[0];
    if (typeEl) {
      if (typeEl.hasAttributeNS(W_NS, 'val')) typeEl.setAttributeNS(W_NS, 'w:val', 'continuous');
      else typeEl.setAttribute('w:val', 'continuous');
    } else {
      // Insert <w:type w:val="continuous"/>
      typeEl = doc.createElementNS(W_NS, 'w:type');
      typeEl.setAttribute('w:val', 'continuous');
      sp.insertBefore(typeEl, sp.firstChild);
    }
  }
}

// ============================================================================
// Paragraph Spacing Cap
// ============================================================================

function capParagraphSpacing(doc: Document): void {
  const MAX_SPACING = 480; // twips
  const spacings = doc.getElementsByTagNameNS(W_NS, 'spacing');

  for (let i = 0; i < spacings.length; i++) {
    const sp = spacings[i];
    // Only process spacing inside pPr (paragraph properties)
    if (sp.parentElement?.localName !== 'pPr') continue;

    for (const attr of ['before', 'after']) {
      const nsVal = sp.getAttributeNS(W_NS, attr);
      const plainVal = sp.getAttribute(`w:${attr}`);
      const val = nsVal || plainVal;

      if (val) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > MAX_SPACING) {
          if (nsVal) sp.setAttributeNS(W_NS, `w:${attr}`, String(MAX_SPACING));
          else sp.setAttribute(`w:${attr}`, String(MAX_SPACING));
        }
      }
    }
  }
}

// ============================================================================
// Excessive Empty Paragraph Removal
// ============================================================================

function removeExcessiveEmptyParagraphs(doc: Document): void {
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return;

  const paragraphs = body.getElementsByTagNameNS(W_NS, 'p');
  let consecutiveEmpty = 0;
  const toRemove: Element[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    // Check if paragraph has any non-empty <w:t>
    const textEls = para.getElementsByTagNameNS(W_NS, 't');
    let hasText = false;
    for (let j = 0; j < textEls.length; j++) {
      if ((textEls[j].textContent || '').trim().length > 0) {
        hasText = true;
        break;
      }
    }

    if (!hasText) {
      consecutiveEmpty++;
      if (consecutiveEmpty > 1) {
        toRemove.push(para);
      } else {
        // First empty paragraph — remove spacing and pageBreakBefore
        const pPr = para.getElementsByTagNameNS(W_NS, 'pPr')[0];
        if (pPr) {
          const spacings = pPr.getElementsByTagNameNS(W_NS, 'spacing');
          for (let s = spacings.length - 1; s >= 0; s--) {
            spacings[s].parentElement?.removeChild(spacings[s]);
          }
          const pbbs = pPr.getElementsByTagNameNS(W_NS, 'pageBreakBefore');
          for (let p = pbbs.length - 1; p >= 0; p--) {
            pbbs[p].parentElement?.removeChild(pbbs[p]);
          }
        }
      }
    } else {
      consecutiveEmpty = 0;
    }
  }

  for (const el of toRemove) {
    el.parentElement?.removeChild(el);
  }
}

// ============================================================================
// Style & Numbering Cleanup
// ============================================================================

async function cleanupStylesInZip(zip: any): Promise<void> {
  const filesToClean = ['word/styles.xml', 'word/numbering.xml'];

  for (const path of filesToClean) {
    const file = zip.file(path);
    if (!file) continue;

    try {
      const xmlString = await file.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'application/xml');

      if (doc.querySelector('parsererror')) continue;

      cleanupStyles(doc);

      const serializer = new XMLSerializer();
      zip.file(path, serializer.serializeToString(doc));
    } catch {
      // Skip files that can't be processed
    }
  }
}

function cleanupStyles(doc: Document): void {
  removeAllElements(doc, W_NS, 'pageBreakBefore');
  removeAllElements(doc, W_NS, 'keepNext');
  removeAllElements(doc, W_NS, 'keepLines');
}

// ============================================================================
// Utility
// ============================================================================

function removeAllElements(doc: Document, ns: string, localName: string): void {
  const elements = doc.getElementsByTagNameNS(ns, localName);
  const toRemove: Element[] = [];
  for (let i = 0; i < elements.length; i++) {
    toRemove.push(elements[i]);
  }
  for (const el of toRemove) {
    el.parentElement?.removeChild(el);
  }
}
