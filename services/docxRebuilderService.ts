/**
 * DOCX Rebuilder Service
 * Rebuilds a DOCX by injecting translated text into the original package.
 * The rebuilder must not normalize layout XML: PDF-to-DOCX converters often
 * encode visual fidelity with section breaks, column breaks, empty paragraphs,
 * and drawing-only paragraphs.
 */

import type { ParsedDocx, TextSegment } from '../types';
import { replaceParagraphText } from './docxParserService';

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

      replaceParagraphText(paragraph, translation);
    }

    // Step 3: Serialize updated XML
    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(doc);
    zip.file(xmlPath, newXmlString);
  }

  // Step 4: Generate output. All untouched DOCX parts stay byte-for-byte as
  // they came from the converter/source document; only parsed XML parts with
  // translated paragraphs are serialized back into the zip.
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
