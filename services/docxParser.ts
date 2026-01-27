/**
 * DOCX Parser Service
 * Parses and rebuilds Word documents while preserving structure
 * Uses JSZip for DOCX manipulation (DOCX is essentially a ZIP file with XML)
 *
 * Strategy: Extract text at paragraph level (<w:p>) to preserve context and spacing
 */

import JSZip from 'jszip';

export interface TextSegment {
  id: string;
  text: string;
  xmlPath: string; // Path in the ZIP file (e.g., 'word/document.xml')
  paragraphElement: Element; // Reference to the paragraph element
  context: 'paragraph' | 'table-cell' | 'header' | 'footer';
}

export interface DocxParseResult {
  segments: TextSegment[];
  zip: JSZip;
  xmlDocuments: Map<string, Document>; // filename -> Parsed XML Document
}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Parse a DOCX file from a data URL
 */
export async function parseDocx(dataUrl: string): Promise<DocxParseResult> {
  // Extract base64 from data URL
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

  // Load the ZIP file
  const zip = await JSZip.loadAsync(bytes);

  const segments: TextSegment[] = [];
  const xmlDocuments = new Map<string, Document>();

  // Files to parse for text content
  const filesToParse = [
    { path: 'word/document.xml', context: 'paragraph' as const },
  ];

  // Find headers and footers
  for (const filename of Object.keys(zip.files)) {
    if (filename.match(/^word\/header\d*\.xml$/)) {
      filesToParse.push({ path: filename, context: 'header' as const });
    }
    if (filename.match(/^word\/footer\d*\.xml$/)) {
      filesToParse.push({ path: filename, context: 'footer' as const });
    }
  }

  // Parse each XML file
  for (const { path, context } of filesToParse) {
    const file = zip.file(path);
    if (!file) continue;

    const xmlString = await file.async('string');

    // Parse XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn(`XML parsing error in ${path}:`, parseError.textContent);
      continue;
    }

    xmlDocuments.set(path, doc);

    // Extract paragraphs
    extractParagraphSegments(doc, path, context, segments);
  }

  console.log(`Extracted ${segments.length} paragraph segments from DOCX`);

  return { segments, zip, xmlDocuments };
}

/**
 * Extract text segments at paragraph level from an XML document
 */
function extractParagraphSegments(
  doc: Document,
  xmlPath: string,
  context: TextSegment['context'],
  segments: TextSegment[]
): void {
  // Find all <w:p> elements (paragraph elements in OOXML)
  const paragraphs = doc.getElementsByTagNameNS(WORD_NS, 'p');

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // Extract all text from this paragraph
    const text = extractParagraphText(para);

    if (text.trim().length === 0) {
      continue; // Skip empty paragraphs
    }

    // Determine context more precisely
    let actualContext = context;
    let node: Element | null = para.parentElement;
    while (node) {
      if (node.localName === 'tc') {
        actualContext = 'table-cell';
        break;
      }
      node = node.parentElement;
    }

    segments.push({
      id: `docx-${xmlPath.replace(/[\/\.]/g, '-')}-para-${i}`,
      text,
      xmlPath,
      paragraphElement: para,
      context: actualContext,
    });
  }
}

/**
 * Extract all text content from a paragraph element
 */
function extractParagraphText(paragraph: Element): string {
  const textElements = paragraph.getElementsByTagNameNS(WORD_NS, 't');
  let fullText = '';

  for (let i = 0; i < textElements.length; i++) {
    const textEl = textElements[i];
    fullText += textEl.textContent || '';
  }

  return fullText;
}

/**
 * Rebuild a DOCX file with translated text
 */
export async function rebuildDocx(
  parseResult: DocxParseResult,
  translations: Map<string, string>
): Promise<string> {
  const { zip, xmlDocuments, segments } = parseResult;

  // Group segments by XML path
  const segmentsByPath = new Map<string, TextSegment[]>();
  for (const segment of segments) {
    const existing = segmentsByPath.get(segment.xmlPath) || [];
    existing.push(segment);
    segmentsByPath.set(segment.xmlPath, existing);
  }

  // Process each XML file
  for (const [xmlPath, pathSegments] of segmentsByPath.entries()) {
    const doc = xmlDocuments.get(xmlPath);
    if (!doc) continue;

    // Apply translations to each paragraph
    for (const segment of pathSegments) {
      const translation = translations.get(segment.id);
      if (translation === undefined) continue;

      // Replace text in the paragraph
      replaceParagraphText(segment.paragraphElement, translation);
    }

    // Serialize back to XML
    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(doc);

    // Update the ZIP file
    zip.file(xmlPath, newXmlString);
  }

  // Generate output
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Replace all text in a paragraph with translated text
 */
function replaceParagraphText(paragraph: Element, translatedText: string): void {
  const textElements = paragraph.getElementsByTagNameNS(WORD_NS, 't');

  if (textElements.length === 0) {
    return;
  }

  // Put all translated text in the first <w:t> element
  textElements[0].textContent = translatedText;

  // Remove remaining <w:t> elements to avoid duplication
  for (let i = textElements.length - 1; i > 0; i--) {
    const textEl = textElements[i];
    const run = textEl.parentElement; // <w:r> element

    if (run && run.parentElement) {
      // If the run only contains this text element, remove the entire run
      const runChildren = Array.from(run.children);
      const hasOnlyText = runChildren.length === 1 && runChildren[0] === textEl;

      if (hasOnlyText) {
        run.parentElement.removeChild(run);
      } else {
        // Just remove the text element
        run.removeChild(textEl);
      }
    }
  }
}

/**
 * Get a summary of the document structure
 */
export function getDocumentSummary(parseResult: DocxParseResult): {
  totalSegments: number;
  paragraphCount: number;
  tableCellCount: number;
  headerCount: number;
  footerCount: number;
  totalCharacters: number;
} {
  const { segments } = parseResult;

  return {
    totalSegments: segments.length,
    paragraphCount: segments.filter((s) => s.context === 'paragraph').length,
    tableCellCount: segments.filter((s) => s.context === 'table-cell').length,
    headerCount: segments.filter((s) => s.context === 'header').length,
    footerCount: segments.filter((s) => s.context === 'footer').length,
    totalCharacters: segments.reduce((sum, s) => sum + s.text.length, 0),
  };
}
