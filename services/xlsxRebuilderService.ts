/**
 * XLSX Rebuilder Service
 * Writes translated text back into Excel cells and generates the output file.
 * Preserves all formatting, formulas, merged cells, and non-string cells.
 */

import * as XLSX from 'xlsx';
import type { ParsedXlsx } from '../types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Rebuild an XLSX file with translated text applied to each cell.
 * Returns a data URL of the translated workbook.
 */
export async function rebuildXlsx(
  parsedXlsx: ParsedXlsx,
  translations: Map<string, string>
): Promise<string> {
  const { workbook, cellMap } = parsedXlsx;

  // Apply translations to cells
  for (const [segmentId, { sheetName, cellAddress }] of cellMap.entries()) {
    const translation = translations.get(segmentId);
    if (translation === undefined) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const cell = sheet[cellAddress];
    if (!cell) continue;

    // Update cell value with translation
    cell.v = translation;
    // Update the formatted text as well
    if (cell.w !== undefined) {
      cell.w = translation;
    }
    // Clear any cached rich text
    if (cell.r !== undefined) {
      delete cell.r;
    }
  }

  // Generate output
  const outputBuffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  });

  const blob = new Blob([outputBuffer], { type: XLSX_MIME });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}
