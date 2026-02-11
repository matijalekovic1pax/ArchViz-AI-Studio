/**
 * XLSX Parser Service
 * Parses Excel spreadsheets into text segments for translation.
 * Extracts string cell values across all sheets, preserving cell addresses
 * for rebuilding the translated workbook.
 */

import * as XLSX from 'xlsx';
import type { TextSegment, ParsedXlsx, DocumentMetadata } from '../types';

// Batching defaults for metadata estimation (same as DOCX)
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_CHARS = 12000;

// Max file size: 50MB
const MAX_FILE_SIZE_MB = 50;

/**
 * Parse an XLSX file from a data URL into text segments.
 * Only string cells are extracted for translation — numbers, dates,
 * booleans, and formulas are left untouched.
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

  // Size check
  if (bytes.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
  }

  const workbook = XLSX.read(bytes, { type: 'array' });

  const segments: TextSegment[] = [];
  const cellMap = new Map<string, { sheetName: string; cellAddress: string }>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellAddress];

        if (!cell) continue;

        // Only translate string cells (type 's')
        // Skip numbers (n), booleans (b), errors (e), and empty cells
        if (cell.t !== 's') continue;

        const text = String(cell.v || '');
        if (text.trim().length === 0) continue;

        const segmentId = `xlsx-${sanitizeId(sheetName)}-${cellAddress}`;

        segments.push({
          id: segmentId,
          text,
          xmlPath: sheetName,
          paragraphIndex: row,
          context: { location: 'table-cell' },
          status: 'pending',
        });

        cellMap.set(segmentId, { sheetName, cellAddress });
      }
    }
  }

  const metadata = calculateMetadata(segments);

  return { workbook, segments, cellMap, metadata };
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
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

/**
 * Returns a summary of the parsed Excel for display.
 */
export function getXlsxSummary(parseResult: ParsedXlsx): {
  totalSegments: number;
  sheetCount: number;
  totalCharacters: number;
} {
  return {
    totalSegments: parseResult.segments.length,
    sheetCount: parseResult.workbook.SheetNames.length,
    totalCharacters: parseResult.segments.reduce((sum, s) => sum + s.text.length, 0),
  };
}
