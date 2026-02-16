/**
 * XLSX Parser Service
 * Parses spreadsheets into safe text segments for translation without rewriting workbook structure.
 */

import JSZip from 'jszip';
import type {
  TextSegment,
  ParsedXlsx,
  DocumentMetadata,
  XlsxSkippedCell,
  XlsxSkipReason,
  XlsxTranslationTarget,
} from '../types';

const S_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_CHARS = 12000;

const MAX_FILE_SIZE_MB = 50;
const MAX_ZIP_ENTRIES = 1500;
const MAX_DECOMPRESSED_SIZE_MB = 200;
const MAX_COMPRESSION_RATIO = 150;

interface WorkbookSheetRef {
  name: string;
  path: string;
}

interface ParsedCellTarget {
  isTextCell: boolean;
  text: string;
  target?: Omit<XlsxTranslationTarget, 'sheetName' | 'cellAddress'>;
  skipReason?: XlsxSkipReason;
}

/**
 * Parse an XLSX file from a data URL into translation-safe segments.
 */
export async function parseXlsx(dataUrl: string): Promise<ParsedXlsx> {
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

  if (bytes.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
  }

  const zip = await JSZip.loadAsync(bytes);
  validateZipArchive(zip, bytes.length);

  const xmlDocuments = new Map<string, Document>();
  const workbookPath = 'xl/workbook.xml';
  const workbookRelsPath = 'xl/_rels/workbook.xml.rels';
  const sharedStringsPath = 'xl/sharedStrings.xml';

  const workbookDoc = await parseXmlFromZip(zip, workbookPath, true);
  const workbookRelsDoc = await parseXmlFromZip(zip, workbookRelsPath, true);
  const sharedStringsDoc = await parseXmlFromZip(zip, sharedStringsPath, false);

  xmlDocuments.set(workbookPath, workbookDoc);
  xmlDocuments.set(workbookRelsPath, workbookRelsDoc);
  if (sharedStringsDoc) {
    xmlDocuments.set(sharedStringsPath, sharedStringsDoc);
  }

  const sheetRefs = resolveWorkbookSheetRefs(workbookDoc, workbookRelsDoc);
  if (sheetRefs.length === 0) {
    throw new Error('No worksheets found in spreadsheet.');
  }

  const segments: TextSegment[] = [];
  const targetMap = new Map<string, XlsxTranslationTarget>();
  const skippedCells: XlsxSkippedCell[] = [];
  let detectedTextCount = 0;

  for (let sheetIndex = 0; sheetIndex < sheetRefs.length; sheetIndex++) {
    const sheetRef = sheetRefs[sheetIndex];
    const sheetDoc = await parseXmlFromZip(zip, sheetRef.path, false);
    if (!sheetDoc) continue;

    xmlDocuments.set(sheetRef.path, sheetDoc);

    const cells = sheetDoc.getElementsByTagNameNS(S_NS, 'c');
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const cellAddress = cell.getAttribute('r');

      if (!cellAddress) {
        skippedCells.push({
          sheetName: sheetRef.name,
          cellAddress: `unknown-${sheetIndex}-${i}`,
          reason: 'malformed-cell-reference',
        });
        continue;
      }

      const cellType = cell.getAttribute('t') || '';
      const hasFormula = getDirectChildByLocalName(cell, 'f') !== null;

      if (hasFormula) {
        if (cellType === 'str') {
          const valueEl = getDirectChildByLocalName(cell, 'v');
          const formulaText = valueEl?.textContent || '';
          if (formulaText.trim().length > 0) detectedTextCount++;
        }
        skippedCells.push({
          sheetName: sheetRef.name,
          cellAddress,
          reason: 'formula-cell',
        });
        continue;
      }

      let parsed: ParsedCellTarget | null = null;
      if (cellType === 's') {
        parsed = parseSharedStringCell(cell, sharedStringsDoc, sharedStringsPath);
      } else if (cellType === 'inlineStr') {
        parsed = parseInlineStringCell(cell, sheetRef.path);
      } else if (cellType === 'str') {
        parsed = parseFormulaStringCell(cell, sheetRef.path);
      }

      if (!parsed || !parsed.isTextCell) continue;

      if (parsed.text.trim().length > 0) {
        detectedTextCount++;
      }

      if (parsed.skipReason) {
        skippedCells.push({
          sheetName: sheetRef.name,
          cellAddress,
          reason: parsed.skipReason,
        });
        continue;
      }

      if (!parsed.target || parsed.text.trim().length === 0) continue;

      const segmentId = `xlsx-${sheetIndex}-${cellAddress}`;
      const rowIndex = getRowIndexFromCellAddress(cellAddress);

      segments.push({
        id: segmentId,
        text: parsed.text,
        xmlPath: parsed.target.xmlPath,
        paragraphIndex: rowIndex,
        context: { location: 'table-cell' },
        status: 'pending',
      });

      targetMap.set(segmentId, {
        ...parsed.target,
        sheetName: sheetRef.name,
        cellAddress,
      });
    }
  }

  const metadata = calculateMetadata(segments);

  return {
    zipInstance: zip,
    xmlDocuments,
    segments,
    targetMap,
    skippedCells,
    detectedTextCount,
    sheetCount: sheetRefs.length,
    metadata,
  };
}

function parseSharedStringCell(
  cell: Element,
  sharedStringsDoc: Document | null,
  sharedStringsPath: string
): ParsedCellTarget {
  const valueEl = getDirectChildByLocalName(cell, 'v');
  const indexText = valueEl?.textContent?.trim() || '';

  if (!indexText) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'missing-text-node',
    };
  }

  const index = Number.parseInt(indexText, 10);
  if (!Number.isInteger(index) || index < 0) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'invalid-shared-string-index',
    };
  }

  if (!sharedStringsDoc) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'missing-shared-strings',
    };
  }

  const sharedItems = sharedStringsDoc.getElementsByTagNameNS(S_NS, 'si');
  const si = sharedItems[index];
  if (!si) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'invalid-shared-string-index',
    };
  }

  if (si.getElementsByTagNameNS(S_NS, 'r').length > 0) {
    return {
      isTextCell: true,
      text: collectNodeText(si.getElementsByTagNameNS(S_NS, 't')),
      skipReason: 'rich-text',
    };
  }

  const textEl =
    getDirectChildByLocalName(si, 't') || si.getElementsByTagNameNS(S_NS, 't')[0] || null;
  if (!textEl) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'missing-text-node',
    };
  }

  const text = textEl.textContent || '';
  return {
    isTextCell: true,
    text,
    target: {
      kind: 'shared-string',
      xmlPath: sharedStringsPath,
      textElement: textEl,
      sharedStringIndex: index,
    },
  };
}

function parseInlineStringCell(cell: Element, sheetPath: string): ParsedCellTarget {
  const isEl = getDirectChildByLocalName(cell, 'is');
  if (!isEl) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'missing-text-node',
    };
  }

  if (isEl.getElementsByTagNameNS(S_NS, 'r').length > 0) {
    return {
      isTextCell: true,
      text: collectNodeText(isEl.getElementsByTagNameNS(S_NS, 't')),
      skipReason: 'rich-text',
    };
  }

  const textEl =
    getDirectChildByLocalName(isEl, 't') || isEl.getElementsByTagNameNS(S_NS, 't')[0] || null;
  if (!textEl) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'missing-text-node',
    };
  }

  return {
    isTextCell: true,
    text: textEl.textContent || '',
    target: {
      kind: 'inline-string',
      xmlPath: sheetPath,
      textElement: textEl,
    },
  };
}

function parseFormulaStringCell(cell: Element, sheetPath: string): ParsedCellTarget {
  const valueEl = getDirectChildByLocalName(cell, 'v');
  if (!valueEl) {
    return {
      isTextCell: true,
      text: '',
      skipReason: 'missing-text-node',
    };
  }

  return {
    isTextCell: true,
    text: valueEl.textContent || '',
    target: {
      kind: 'formula-string',
      xmlPath: sheetPath,
      textElement: valueEl,
    },
  };
}

function resolveWorkbookSheetRefs(workbookDoc: Document, workbookRelsDoc: Document): WorkbookSheetRef[] {
  const relById = new Map<string, string>();
  const relationships = workbookRelsDoc.getElementsByTagNameNS(PKG_REL_NS, 'Relationship');

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i];
    const relType = rel.getAttribute('Type') || '';
    const relId = rel.getAttribute('Id');
    const relTarget = rel.getAttribute('Target');
    if (!relId || !relTarget) continue;
    if (!relType.includes('/worksheet')) continue;
    relById.set(relId, resolveRelativeZipPath('xl/workbook.xml', relTarget));
  }

  const sheetRefs: WorkbookSheetRef[] = [];
  const sheets = workbookDoc.getElementsByTagNameNS(S_NS, 'sheet');

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = sheet.getAttribute('name') || `Sheet${i + 1}`;
    const relId = sheet.getAttributeNS(REL_NS, 'id') || sheet.getAttribute('r:id');
    if (!relId) continue;

    const sheetPath = relById.get(relId);
    if (!sheetPath) continue;
    sheetRefs.push({ name, path: sheetPath });
  }

  return sheetRefs;
}

async function parseXmlFromZip(
  zip: JSZip,
  path: string,
  required: boolean
): Promise<Document | null> {
  const file = zip.file(path);
  if (!file) {
    if (required) throw new Error(`Missing required spreadsheet part: ${path}`);
    return null;
  }

  const xml = await file.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    if (required) throw new Error(`Invalid XML in spreadsheet part: ${path}`);
    return null;
  }

  return doc;
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

function resolveRelativeZipPath(baseFilePath: string, targetPath: string): string {
  if (!targetPath) return normalizeZipPath(baseFilePath);
  if (targetPath.startsWith('/')) {
    return normalizeZipPath(targetPath);
  }

  const baseParts = baseFilePath.split('/');
  baseParts.pop();
  const combined = `${baseParts.join('/')}/${targetPath}`;
  return normalizeZipPath(combined);
}

function normalizeZipPath(path: string): string {
  const sourceParts = path.replace(/\\/g, '/').split('/');
  const normalized: string[] = [];

  for (const part of sourceParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return normalized.join('/');
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

function getDirectChildByLocalName(parent: Element, localName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName) {
      return child;
    }
  }
  return null;
}

function collectNodeText(nodes: HTMLCollectionOf<Element>): string {
  let text = '';
  for (let i = 0; i < nodes.length; i++) {
    text += nodes[i].textContent || '';
  }
  return text;
}

function getRowIndexFromCellAddress(cellAddress: string): number {
  const match = cellAddress.match(/\d+$/);
  if (!match) return 0;
  const row = Number.parseInt(match[0], 10);
  return Number.isNaN(row) ? 0 : Math.max(0, row - 1);
}

/**
 * Returns a summary of the parsed Excel for display.
 */
export function getXlsxSummary(parseResult: ParsedXlsx): {
  totalSegments: number;
  sheetCount: number;
  totalCharacters: number;
  skippedCells: number;
} {
  return {
    totalSegments: parseResult.segments.length,
    sheetCount: parseResult.sheetCount,
    totalCharacters: parseResult.segments.reduce((sum, s) => sum + s.text.length, 0),
    skippedCells: parseResult.skippedCells.length,
  };
}

