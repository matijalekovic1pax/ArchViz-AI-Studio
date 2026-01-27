/**
 * DOCX Parser Service
 * Parses and rebuilds Word documents while preserving structure
 * Uses JSZip for DOCX manipulation (DOCX is essentially a ZIP file with XML)
 */

import JSZip from 'jszip';

export interface TextSegment {
  id: string;
  text: string;
  xmlPath: string; // Path in the ZIP file (e.g., 'word/document.xml')
  elementIndex: number; // Index of the text element within the file
  context: 'paragraph' | 'table-cell' | 'header' | 'footer';
}

export interface DocxParseResult {
  segments: TextSegment[];
  zip: JSZip;
  xmlContents: Map<string, string>; // filename -> XML string
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
  const xmlContents = new Map<string, string>();

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
    xmlContents.set(path, xmlString);

    // Parse XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn(`XML parsing error in ${path}:`, parseError.textContent);
      continue;
    }

    // Extract text elements
    extractTextSegments(doc, path, context, segments);
  }

  return { segments, zip, xmlContents };
}

/**
 * Extract text segments from an XML document
 */
function extractTextSegments(
  doc: Document,
  xmlPath: string,
  context: TextSegment['context'],
  segments: TextSegment[]
): void {
  // Find all <w:t> elements (text elements in OOXML)
  const textElements = doc.getElementsByTagNameNS(WORD_NS, 't');

  for (let i = 0; i < textElements.length; i++) {
    const el = textElements[i];
    const text = el.textContent?.trim();

    if (text && text.length > 0) {
      // Determine context more precisely
      let actualContext = context;
      const parent = el.parentElement;
      if (parent) {
        // Check if inside a table cell
        let node: Element | null = parent;
        while (node) {
          if (node.localName === 'tc') {
            actualContext = 'table-cell';
            break;
          }
          node = node.parentElement;
        }
      }

      segments.push({
        id: `docx-${xmlPath.replace(/[\/\.]/g, '-')}-${segments.length}`,
        text: el.textContent || '', // Keep original text including whitespace
        xmlPath,
        elementIndex: i,
        context: actualContext,
      });
    }
  }
}

/**
 * Rebuild a DOCX file with translated text
 */
export async function rebuildDocx(
  parseResult: DocxParseResult,
  translations: Map<string, string>
): Promise<string> {
  const { zip, xmlContents, segments } = parseResult;

  // Group segments by XML path
  const segmentsByPath = new Map<string, TextSegment[]>();
  for (const segment of segments) {
    const existing = segmentsByPath.get(segment.xmlPath) || [];
    existing.push(segment);
    segmentsByPath.set(segment.xmlPath, existing);
  }

  // Process each XML file
  for (const [xmlPath, pathSegments] of segmentsByPath.entries()) {
    const xmlString = xmlContents.get(xmlPath);
    if (!xmlString) continue;

    // Parse the XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Get all text elements
    const textElements = doc.getElementsByTagNameNS(WORD_NS, 't');

    // Apply translations
    for (const segment of pathSegments) {
      const translation = translations.get(segment.id);
      if (translation === undefined) continue;

      const el = textElements[segment.elementIndex];
      if (el) {
        el.textContent = translation;
      }
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
