/**
 * PPTX Rebuilder Service
 * Writes translated text back into DrawingML text runs while preserving the
 * original presentation package, media, layouts, animations, and relationships.
 */

import type { ParsedPptx } from '../types';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export interface RebuiltPptxResult {
  dataUrl: string;
  appliedCount: number;
  missingTargetCount: number;
}

/**
 * Rebuild a PPTX file with translated text applied to mapped text paragraphs.
 */
export async function rebuildPptx(
  parsedPptx: ParsedPptx,
  translations: Map<string, string>
): Promise<RebuiltPptxResult> {
  const { zipInstance: zip, xmlDocuments, targetMap } = parsedPptx;
  const touchedPaths = new Set<string>();

  let appliedCount = 0;
  let missingTargetCount = 0;

  for (const [segmentId, target] of targetMap.entries()) {
    const translation = translations.get(segmentId);
    if (translation === undefined) continue;

    const doc = xmlDocuments.get(target.xmlPath);
    if (!doc) {
      missingTargetCount++;
      continue;
    }

    if (!target.textElements.every((element) => element.ownerDocument === doc)) {
      missingTargetCount++;
      continue;
    }

    replaceTextAcrossRuns(target.textElements, translation);
    touchedPaths.add(target.xmlPath);
    appliedCount++;
  }

  const serializer = new XMLSerializer();
  for (const xmlPath of touchedPaths) {
    const doc = xmlDocuments.get(xmlPath);
    if (!doc) continue;
    zip.file(xmlPath, serializer.serializeToString(doc));
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: PPTX_MIME,
  });

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, appliedCount, missingTargetCount };
}

function replaceTextAcrossRuns(textElements: Element[], translatedText: string): void {
  if (textElements.length === 0) return;
  if (textElements.length === 1) {
    setRunTextPreservingWhitespace(textElements[0], translatedText);
    return;
  }

  const originalParts = textElements.map((element) => element.textContent || '');
  const translatedParts = splitTranslatedTextByOriginalRuns(translatedText, originalParts);

  textElements.forEach((element, index) => {
    setRunTextPreservingWhitespace(element, translatedParts[index] || '');
  });
}

function splitTranslatedTextByOriginalRuns(translatedText: string, originalParts: string[]): string[] {
  const parts = originalParts.map(() => '');
  if (translatedText.length === 0 || originalParts.length === 0) return parts;

  const totalOriginalLength = originalParts.reduce((sum, part) => sum + part.length, 0);
  if (totalOriginalLength === 0) {
    parts[0] = translatedText;
    return parts;
  }

  let translatedCursor = 0;
  let originalCursor = 0;

  for (let i = 0; i < originalParts.length - 1; i++) {
    originalCursor += originalParts[i].length;

    if (originalParts[i].length === 0) {
      parts[i] = '';
      continue;
    }

    const targetEnd = Math.round((originalCursor / totalOriginalLength) * translatedText.length);
    const boundary = findNearestTextBoundary(translatedText, targetEnd, translatedCursor);
    parts[i] = translatedText.slice(translatedCursor, boundary);
    translatedCursor = boundary;
  }

  parts[originalParts.length - 1] = translatedText.slice(translatedCursor);
  return parts;
}

function findNearestTextBoundary(text: string, targetEnd: number, minEnd: number): number {
  if (targetEnd <= minEnd) return minEnd;
  if (targetEnd >= text.length) return text.length;

  const searchRadius = 16;
  let bestIndex = targetEnd;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (
    let index = Math.max(minEnd, targetEnd - searchRadius);
    index <= Math.min(text.length, targetEnd + searchRadius);
    index++
  ) {
    const prev = text[index - 1] || '';
    const current = text[index] || '';
    if (!isGoodSplitBoundary(prev, current)) continue;

    const distance = Math.abs(index - targetEnd);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function isGoodSplitBoundary(prev: string, current: string): boolean {
  return /\s/.test(prev) || /\s/.test(current) || /[.,;:!?)]/.test(prev);
}

function setRunTextPreservingWhitespace(textElement: Element, value: string): void {
  textElement.textContent = value;

  const shouldPreserveSpace = /^\s|\s$|\s{2,}|\n|\t/.test(value);
  if (shouldPreserveSpace) {
    textElement.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    return;
  }

  if (textElement.hasAttributeNS(XML_NS, 'space')) {
    textElement.removeAttributeNS(XML_NS, 'space');
  }
  if (textElement.hasAttribute('xml:space')) {
    textElement.removeAttribute('xml:space');
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}
