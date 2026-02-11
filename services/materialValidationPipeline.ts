import { nanoid } from 'nanoid';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker?url';
import { fetchUrlViaGateway } from './apiGateway';
import type { MaterialValidationDocument, FetchedLinkContent, EnrichedMaterialCandidate } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type DocumentRole = 'materials' | 'boq';

export interface MaterialCandidate {
  id: string;
  code: string;
  name: string;
  specText: string;
  links: string[];
  docId: string;
  docName: string;
  source: 'terminal' | 'cargo';
  pageRef?: string;
}

export interface BoQCandidate {
  id: string;
  code: string;
  section: string;
  description: string;
  materialRef: string;
  rawText: string;
  docId: string;
  docName: string;
}

const MATERIAL_CODE_REGEX = /\b(?:FF|WF|IC|WP|RF|L)\s*-?\s*\d{1,4}[A-Z]?\b/i;
const BOQ_CODE_REGEX = /\b\d+(?:\.\d+)+\b/;
const URL_REGEX = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;

const normalizeCode = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const normalizeSource = (name: string) => (name.toLowerCase().includes('cargo') ? 'cargo' : 'terminal');

const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const extractLinks = (text: string): string[] => {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return matches.map((link) => link.replace(/[.,]+$/g, ''));
};

export const classifyDocumentRole = (doc: MaterialValidationDocument): DocumentRole => {
  const name = doc.name.toLowerCase();
  if (name.includes('boq') || name.includes('bill') || name.includes('quantity')) return 'boq';
  return 'materials';
};

const extractMaterialsFromLines = (
  lines: string[],
  doc: MaterialValidationDocument,
  pageRef?: string
): MaterialCandidate[] => {
  const results: MaterialCandidate[] = [];
  let current: MaterialCandidate | null = null;

  const pushCurrent = () => {
    if (!current) return;
    if (current.specText.trim().length < 4 && current.links.length === 0) return;
    current.specText = current.specText.trim();
    current.links = Array.from(new Set(current.links));
    results.push(current);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(MATERIAL_CODE_REGEX);
    if (match) {
      pushCurrent();
      const code = normalizeCode(match[0]);
      const remainder = trimmed.replace(match[0], '').trim();
      current = {
        id: nanoid(),
        code,
        name: remainder,
        specText: remainder,
        links: extractLinks(trimmed),
        docId: doc.id,
        docName: doc.name,
        source: normalizeSource(doc.name),
        pageRef
      };
    } else if (current) {
      current.specText = `${current.specText} ${trimmed}`.trim();
      current.links.push(...extractLinks(trimmed));
    }
  }

  pushCurrent();
  return results;
};

const extractBoqFromLines = (lines: string[], doc: MaterialValidationDocument, pageRef?: string): BoQCandidate[] => {
  const items: BoQCandidate[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const codeMatch = trimmed.match(BOQ_CODE_REGEX);
    if (!codeMatch) continue;
    items.push({
      id: nanoid(),
      code: codeMatch[0],
      section: '',
      description: trimmed,
      materialRef: '',
      rawText: trimmed,
      docId: doc.id,
      docName: doc.name
    });
  }
  return items;
};

const getPdfLines = async (doc: MaterialValidationDocument): Promise<Array<{ page: number; lines: string[] }>> => {
  const data = dataUrlToArrayBuffer(doc.dataUrl);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: Array<{ page: number; lines: string[] }> = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str?: string; hasEOL?: boolean }>;
    const lines: string[] = [];
    let line = '';

    for (const item of items) {
      const chunk = (item.str || '').trim();
      if (!chunk) continue;
      line = line ? `${line} ${chunk}` : chunk;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = '';
      }
    }
    if (line.trim()) {
      lines.push(line.trim());
    }
    pages.push({ page: pageNumber, lines });
  }

  return pages;
};

const getSheetRows = (doc: MaterialValidationDocument): string[][] => {
  const data = dataUrlToArrayBuffer(doc.dataUrl);
  const workbook = XLSX.read(data, { type: 'array' });
  const rows: string[][] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];
    sheetRows.forEach((row) => rows.push(row.map((cell) => String(cell ?? '').trim())));
  });
  return rows;
};

const findHeaderRow = (rows: string[][]): { index: number; headers: string[] } => {
  let bestIndex = 0;
  let bestScore = -1;
  let bestHeaders: string[] = [];
  const keywords = ['code', 'material', 'description', 'spec', 'link', 'url', 'brand', 'type', 'section', 'quantity'];

  rows.slice(0, 5).forEach((row, idx) => {
    const headers = row.map((cell) => cell.toLowerCase());
    const score = headers.reduce((total, cell) => (
      total + (keywords.some((key) => cell.includes(key)) ? 1 : 0)
    ), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
      bestHeaders = headers;
    }
  });

  return { index: bestIndex, headers: bestHeaders };
};

const extractMaterialsFromRows = (rows: string[][], doc: MaterialValidationDocument): MaterialCandidate[] => {
  if (rows.length === 0) return [];
  const { index, headers } = findHeaderRow(rows);
  const getColumn = (name: string) => headers.findIndex((header) => header.includes(name));
  const codeIndex = getColumn('code');
  const nameIndex = getColumn('material');
  const descIndex = getColumn('description');

  const candidates: MaterialCandidate[] = [];
  rows.slice(index + 1).forEach((row) => {
    const rowText = row.filter(Boolean).join(' | ');
    const codeCell = codeIndex >= 0 ? row[codeIndex] : '';
    const match = codeCell || rowText.match(MATERIAL_CODE_REGEX)?.[0] || '';
    if (!match) return;
    const code = normalizeCode(match);
    const name = (nameIndex >= 0 ? row[nameIndex] : '') || (descIndex >= 0 ? row[descIndex] : '') || '';
    const links = extractLinks(rowText);
    candidates.push({
      id: nanoid(),
      code,
      name,
      specText: rowText || name,
      links,
      docId: doc.id,
      docName: doc.name,
      source: normalizeSource(doc.name)
    });
  });
  return candidates;
};

const extractBoqFromRows = (rows: string[][], doc: MaterialValidationDocument): BoQCandidate[] => {
  if (rows.length === 0) return [];
  const { index, headers } = findHeaderRow(rows);
  const getColumn = (name: string) => headers.findIndex((header) => header.includes(name));
  const codeIndex = getColumn('code');
  const sectionIndex = getColumn('section');
  const descIndex = getColumn('description');
  const materialIndex = getColumn('material');

  const items: BoQCandidate[] = [];
  rows.slice(index + 1).forEach((row) => {
    const rowText = row.filter(Boolean).join(' | ');
    if (!rowText) return;
    const code = codeIndex >= 0 ? row[codeIndex] : '';
    const detectedCode = code || rowText.match(BOQ_CODE_REGEX)?.[0] || '';
    if (!detectedCode) return;
    const section = sectionIndex >= 0 ? row[sectionIndex] : '';
    const description = descIndex >= 0 ? row[descIndex] : rowText;
    const materialRef = materialIndex >= 0 ? row[materialIndex] : '';
    items.push({
      id: nanoid(),
      code: detectedCode,
      section: section || '',
      description: description || '',
      materialRef: materialRef || '',
      rawText: rowText,
      docId: doc.id,
      docName: doc.name
    });
  });
  return items;
};

export const extractMaterialsFromDocument = async (doc: MaterialValidationDocument): Promise<MaterialCandidate[]> => {
  const name = doc.name.toLowerCase();
  if (name.endsWith('.pdf') || doc.mimeType.includes('pdf')) {
    const pages = await getPdfLines(doc);
    return pages.flatMap((page) => extractMaterialsFromLines(page.lines, doc, `p.${page.page}`));
  }
  if (name.endsWith('.csv') || doc.mimeType.includes('csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const rows = getSheetRows(doc);
    return extractMaterialsFromRows(rows, doc);
  }
  return [];
};

export const extractBoqItemsFromDocument = async (doc: MaterialValidationDocument): Promise<BoQCandidate[]> => {
  const name = doc.name.toLowerCase();
  if (name.endsWith('.pdf') || doc.mimeType.includes('pdf')) {
    const pages = await getPdfLines(doc);
    return pages.flatMap((page) => extractBoqFromLines(page.lines, doc, `p.${page.page}`));
  }
  if (name.endsWith('.csv') || doc.mimeType.includes('csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const rows = getSheetRows(doc);
    return extractBoqFromRows(rows, doc);
  }
  return [];
};

export const pickBoqMatches = (material: MaterialCandidate, boqItems: BoQCandidate[], limit = 6): BoQCandidate[] => {
  if (!boqItems.length) return [];
  const code = material.code.toLowerCase();
  const name = material.name.toLowerCase();
  const matches = boqItems.filter((item) => (
    item.rawText.toLowerCase().includes(code) ||
    (name && item.rawText.toLowerCase().includes(name))
  ));
  if (matches.length > 0) return matches.slice(0, limit);
  return boqItems.slice(0, Math.min(limit, boqItems.length));
};

export const buildTechnicalValidationPrompt = (material: MaterialCandidate, checks: string[] = []) => {
  const links = material.links.length > 0 ? material.links.join(', ') : 'none';
  const checkLine = checks.length > 0 ? `Checks to focus on: ${checks.join(', ')}.` : '';
  return [
    'You are a technical materials validation assistant.',
    'Validate the material specification for consistency, completeness, and plausibility.',
    checkLine,
    'Material data:',
    `- Code: ${material.code}`,
    `- Name: ${material.name || 'unknown'}`,
    `- Spec: ${material.specText || 'none'}`,
    `- Source document: ${material.docName}${material.pageRef ? ` (${material.pageRef})` : ''}`,
    `- Links: ${links}`,
    'Return ONLY valid JSON with this shape:',
    '{ "summary": string, "materials": [...], "boqItems": [...], "issues": [...] }',
    'Materials: [{ code, name, category, description, referenceProduct:{type,brand}, drawingRef, source, dimensions, notes, application }]',
    'BoQ items: []',
    'Issues: [{ id, code, type, severity, message, details, recommendation, sourceDocument, resolved, date }]',
    'Rules:',
    '- type must be technical.',
    '- severity must be one of: pass, warning, error, info, pending.',
    '- Use empty strings or empty arrays instead of null.',
    '- Do not include markdown or commentary.'
  ].join('\n');
};

export const buildBoqValidationPrompt = (material: MaterialCandidate, matches: BoQCandidate[], checks: string[] = []) => {
  const lines = matches.length > 0
    ? matches.map((item) => `- ${item.code}: ${item.rawText}`).join('\n')
    : '- (no matching BoQ lines found)';
  const checkLine = checks.length > 0 ? `Checks to focus on: ${checks.join(', ')}.` : '';
  return [
    'You are a BoQ cross-reference assistant.',
    'Compare the material against the BoQ lines and report mismatches or missing items.',
    checkLine,
    'Material:',
    `- Code: ${material.code}`,
    `- Name: ${material.name || 'unknown'}`,
    `- Spec: ${material.specText || 'none'}`,
    'BoQ lines:',
    lines,
    'Return ONLY valid JSON with this shape:',
    '{ "summary": string, "materials": [...], "boqItems": [...], "issues": [...] }',
    'Materials: [{ code, name, category, description, referenceProduct:{type,brand}, drawingRef, source, dimensions, notes, application }]',
    'BoQ items: [{ code, section, description, materialRef, product:{type,brand}, quantity:{terminal,cargo,unit} }]',
    'Issues: [{ id, code, type, severity, message, details, recommendation, sourceDocument, resolved, date }]',
    'Rules:',
    '- type must be boq.',
    '- severity must be one of: pass, warning, error, info, pending.',
    '- Use empty strings or empty arrays instead of null.',
    '- Do not include markdown or commentary.'
  ].join('\n');
};

// ============================================================================
// Link Fetching Utilities
// ============================================================================

const LINK_FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_CONTENT_LENGTH = 2000;  // Characters to extract per link

/**
 * Fetch content from a single URL via the API gateway proxy (bypasses CORS)
 */
export const fetchLinkContent = async (url: string): Promise<FetchedLinkContent> => {
  try {
    let normalizedUrl = url;
    if (url.startsWith('www.')) {
      normalizedUrl = `https://${url}`;
    }

    const result = await fetchUrlViaGateway(normalizedUrl);

    return {
      url: result.url,
      title: result.title,
      content: (result.content || '').slice(0, MAX_CONTENT_LENGTH),
      fetchedAt: result.fetchedAt || Date.now(),
      error: result.error
    };
  } catch (error) {
    return {
      url,
      content: '',
      fetchedAt: Date.now(),
      error: error instanceof Error ? error.message : 'Fetch failed'
    };
  }
};

/**
 * Split an array into chunks of specified size
 */
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Fetch web content for all links in a list of materials
 * Processes links in batches to avoid overwhelming the network
 */
export const fetchAllMaterialLinks = async (
  materials: MaterialCandidate[],
  onProgress?: (completed: number, total: number) => void
): Promise<EnrichedMaterialCandidate[]> => {
  const enriched: EnrichedMaterialCandidate[] = [];
  let completed = 0;

  for (const material of materials) {
    const fetchedLinks: FetchedLinkContent[] = [];

    if (material.links.length > 0) {
      // Fetch links in parallel batches (max 3 concurrent)
      const linkBatches = chunkArray(material.links, 3);
      for (const batch of linkBatches) {
        const results = await Promise.allSettled(batch.map(fetchLinkContent));
        for (const result of results) {
          if (result.status === 'fulfilled') {
            fetchedLinks.push(result.value);
          }
        }
      }
    }

    enriched.push({ ...material, fetchedLinks });
    completed++;
    onProgress?.(completed, materials.length);
  }

  return enriched;
};

// ============================================================================
// Enhanced Prompt Builders (with fetched link content)
// ============================================================================

/**
 * Build an enhanced technical validation prompt that includes fetched web content
 */
export const buildEnhancedTechnicalPrompt = (
  material: EnrichedMaterialCandidate,
  checks: string[] = []
): string => {
  // Build link content section from successfully fetched links
  const linkContent = material.fetchedLinks
    .filter(link => link.content && !link.error)
    .map(link => `[Source: ${link.url}${link.title ? ` - ${link.title}` : ''}]\n${link.content}`)
    .join('\n\n');

  const failedLinks = material.fetchedLinks.filter(link => link.error);
  const failedLinkNote = failedLinks.length > 0
    ? `\nNote: ${failedLinks.length} link(s) could not be fetched.`
    : '';

  const checkLine = checks.length > 0
    ? `\nVALIDATION CHECKS:\n${checks.map(c => `- ${c}`).join('\n')}`
    : '';

  return [
    'You are a technical materials validation assistant for architectural projects.',
    'Validate the material specification for consistency, completeness, and plausibility.',
    '',
    'MATERIAL DATA:',
    `- Code: ${material.code}`,
    `- Name: ${material.name || 'unknown'}`,
    `- Specification: ${material.specText || 'none'}`,
    `- Source Document: ${material.docName}${material.pageRef ? ` (${material.pageRef})` : ''}`,
    '',
    linkContent ? `REFERENCE DOCUMENTATION FROM WEB LINKS:\n${linkContent}${failedLinkNote}\n` : '',
    checkLine,
    '',
    'ANALYZE:',
    '1. Does the specification make sense technically?',
    '2. Are dimensions/quantities plausible for the material type?',
    '3. Does the product reference match the description?',
    '4. Any inconsistencies with the web documentation (if provided)?',
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{',
    '  "summary": "Brief assessment of the material",',
    '  "material": {',
    '    "code": "string",',
    '    "name": "string",',
    '    "category": "FF|WF|IC|WP|RF|L",',
    '    "description": "string",',
    '    "referenceProduct": { "type": "string", "brand": "string" },',
    '    "drawingRef": "string",',
    '    "source": "terminal|cargo",',
    '    "dimensions": "string or empty",',
    '    "notes": ["array of strings"],',
    '    "application": "string"',
    '  },',
    '  "issues": [',
    '    {',
    '      "id": "unique-id",',
    '      "code": "material-code",',
    '      "type": "technical",',
    '      "severity": "pass|warning|error|info",',
    '      "message": "Short issue title",',
    '      "details": "Detailed explanation",',
    '      "recommendation": "How to fix",',
    '      "sourceDocument": "document name",',
    '      "resolved": false',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- severity: pass (no issues), warning (minor), error (critical), info (FYI)',
    '- If material is valid, return empty issues array',
    '- Use empty strings instead of null',
    '- Do not include markdown or commentary outside JSON'
  ].filter(Boolean).join('\n');
};

/**
 * Build an enhanced BoQ validation prompt for cross-referencing
 */
export const buildEnhancedBoqPrompt = (
  material: EnrichedMaterialCandidate,
  matches: BoQCandidate[],
  checks: string[] = []
): string => {
  const lines = matches.length > 0
    ? matches.map((item) => `- ${item.code}: ${item.rawText}`).join('\n')
    : '- (no matching BoQ lines found)';

  const checkLine = checks.length > 0
    ? `\nCHECKS TO FOCUS ON:\n${checks.map(c => `- ${c}`).join('\n')}`
    : '';

  return [
    'You are a BoQ (Bill of Quantities) cross-reference assistant for construction projects.',
    'Compare the material specification against BoQ line items and identify discrepancies.',
    '',
    'MATERIAL:',
    `- Code: ${material.code}`,
    `- Name: ${material.name || 'unknown'}`,
    `- Specification: ${material.specText || 'none'}`,
    `- Source: ${material.source}`,
    '',
    'BOQ LINE ITEMS:',
    lines,
    checkLine,
    '',
    'ANALYZE:',
    '1. Is this material present in the BoQ?',
    '2. Do quantities match (if specified)?',
    '3. Do product references align?',
    '4. Are there any code/naming mismatches?',
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{',
    '  "summary": "Brief cross-reference assessment",',
    '  "boqItems": [',
    '    {',
    '      "code": "BoQ item code",',
    '      "section": "section name",',
    '      "description": "item description",',
    '      "materialRef": "linked material code",',
    '      "product": { "type": "string", "brand": "string" },',
    '      "quantity": { "terminal": number, "cargo": number, "unit": "string" }',
    '    }',
    '  ],',
    '  "issues": [',
    '    {',
    '      "id": "unique-id",',
    '      "code": "material-code",',
    '      "type": "boq",',
    '      "severity": "pass|warning|error|info",',
    '      "message": "Short issue title",',
    '      "details": "Detailed explanation",',
    '      "recommendation": "How to resolve",',
    '      "sourceDocument": "document name",',
    '      "resolved": false',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- type must be "boq"',
    '- If material is missing from BoQ, create an error issue',
    '- If quantities mismatch, create a warning issue',
    '- Use empty arrays/strings instead of null'
  ].join('\n');
};
