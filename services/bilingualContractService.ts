/**
 * Bilingual Contract Service
 * Turns a contract in its original language into a bilingual Word document.
 *
 * Pipeline: PDF → DOCX (if needed) → translate in place with the document
 * translation pipeline → merge original and translation side by side or
 * paragraph by paragraph.
 */

import JSZip from 'jszip';
import { convertPdfToDocxWithConvertApi } from './convertApiService';
import { detectLanguageCode, translateDocument, translateTexts } from './documentTranslationService';
import { collectNumberingLabels, mergeBilingualDocx } from './bilingualDocxBuilder';
import type {
  BilingualContractLayout,
  BilingualContractOrder,
  BilingualContractProgress,
  DocumentTranslateDocument,
  DocumentTranslationModel,
} from '../types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const CONTRACT_INSTRUCTIONS = `LEGAL CONTRACT RULES:
This is a contract that will be signed with both language versions side by side. Translate it as a professional legal translator would:
- Use the established legal terminology of the target language. Do not paraphrase, summarize, simplify or soften any provision.
- Translate each defined term (usually capitalized, e.g. "Agreement", "Services", "Effective Date") the same way every time it appears, and keep it capitalized.
- Keep the legal force of obligation words: "shall", "must", "may", "shall not" and their equivalents must carry the same effect.
- Keep clause and article numbers, cross-references, party and company names, registration numbers, addresses, amounts, currencies, dates and percentages exactly as written.
- Keep blanks, placeholders and signature lines (e.g. "________", "[●]", "[Name]") unchanged.`;

export interface BilingualContractOptions {
  sourceDocument: DocumentTranslateDocument;
  sourceLanguage: string;
  targetLanguage: string;
  layout: BilingualContractLayout;
  order: BilingualContractOrder;
  translationModel: DocumentTranslationModel;
  columnHeaders: boolean;
  columnDivider: boolean;
  italicTranslation: boolean;
  onProgress: (progress: BilingualContractProgress) => void;
  abortSignal?: AbortSignal;
}

export interface BilingualContractResult {
  dataUrl: string;
  name: string;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  warnings: string[];
}

export async function createBilingualContract(options: BilingualContractOptions): Promise<BilingualContractResult> {
  const { sourceDocument, targetLanguage, onProgress, abortSignal } = options;
  const checkAborted = () => {
    if (abortSignal?.aborted) throw new DOMException('Bilingual contract cancelled', 'AbortError');
  };

  let docxDataUrl = sourceDocument.dataUrl;
  if (sourceDocument.type === 'pdf') {
    onProgress({ phase: 'converting', percent: 3, message: 'Converting PDF to Word…' });
    docxDataUrl = await convertPdfToDocxWithConvertApi(sourceDocument.dataUrl, (progress) => {
      onProgress({ phase: 'converting', percent: 3 + Math.round(progress.percent * 0.07), message: progress.message });
    });
  }
  checkAborted();

  const originalBytes = dataUrlToBytes(docxDataUrl);
  const sourceLanguage = options.sourceLanguage === 'auto'
    ? await detectContractLanguage(originalBytes, options.translationModel, abortSignal)
    : options.sourceLanguage;
  if (sourceLanguage && sourceLanguage === targetLanguage) {
    throw new Error(`The contract already appears to be in ${languageLabel(targetLanguage)}. Choose a different target language.`);
  }
  checkAborted();

  const translation = await translateDocument({
    sourceDocument: { ...sourceDocument, type: 'docx', mimeType: DOCX_MIME, dataUrl: docxDataUrl },
    sourceLanguage: sourceLanguage || 'auto',
    targetLanguage,
    translationModel: options.translationModel,
    // Headers, footers and footnotes stay as uploaded; the body carries both languages.
    translateHeaders: false,
    translateFootnotes: false,
    additionalInstructions: CONTRACT_INSTRUCTIONS,
    onProgress: (progress) => {
      const share = progress.totalSegments > 0 ? progress.currentSegment / progress.totalSegments : 0;
      onProgress({
        phase: 'translating',
        percent: Math.min(90, 10 + Math.round(share * 80)),
        message: progress.phase === 'rebuilding' ? 'Applying translation…' : progress.message,
      });
    },
    abortSignal,
  });
  checkAborted();

  const numberingLabels = await translateNumberingLabels(originalBytes, sourceLanguage || 'auto', targetLanguage, options.translationModel, abortSignal);
  checkAborted();

  onProgress({ phase: 'building', percent: 93, message: options.layout === 'side-by-side' ? 'Laying out the two columns…' : 'Interleaving the paragraphs…' });
  const sourceLanguageLabel = sourceLanguage ? languageLabel(sourceLanguage) : 'Original';
  const targetLanguageLabel = languageLabel(targetLanguage);
  const merged = await mergeBilingualDocx(originalBytes, dataUrlToBytes(translation.dataUrl), {
    layout: options.layout,
    order: options.order,
    columnHeaders: options.columnHeaders,
    columnDivider: options.columnDivider,
    italicTranslation: options.italicTranslation,
    sourceLabel: sourceLanguageLabel,
    targetLabel: targetLanguageLabel,
    numberingLabels,
  });

  const baseName = sourceDocument.name.replace(/\.(docx|pdf)$/i, '');
  const codes = [sourceLanguage, targetLanguage].filter(Boolean).map((code) => code!.toUpperCase()).join('-');
  onProgress({ phase: 'complete', percent: 100, message: 'Bilingual contract ready.' });
  return {
    dataUrl: `data:${DOCX_MIME};base64,${bytesToBase64(merged.bytes)}`,
    name: `${baseName} - bilingual ${codes}.docx`,
    sourceLanguageLabel,
    targetLanguageLabel,
    warnings: merged.warnings,
  };
}

/** The language's own name, e.g. "Deutsch" for German, for the column headings. */
export function languageLabel(code: string): string {
  try {
    // Serbian contracts are usually written in Latin script.
    const locale = code === 'sr' ? 'sr-Latn' : code;
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code);
    if (name && name !== code) return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    // Unknown code: fall through.
  }
  return code.toUpperCase();
}

/** Translate clause labels such as "Article %1." that live in the list definitions, not the text. */
async function translateNumberingLabels(
  docxBytes: Uint8Array,
  sourceLanguage: string,
  targetLanguage: string,
  model: DocumentTranslationModel,
  abortSignal?: AbortSignal
): Promise<Record<string, string>> {
  try {
    const labels = await collectNumberingLabels(docxBytes);
    if (labels.length === 0) return {};
    const translated = await translateTexts(
      labels,
      sourceLanguage,
      targetLanguage,
      'Numbering labels of the clauses and lists in a legal contract, e.g. "Article %1." or "Section %1.%2".',
      model,
      abortSignal,
      'Each %1, %2, … is a placeholder for the clause number: keep every placeholder exactly as written and in a grammatical position.'
    );
    const placeholders = (text: string) => (text.match(/%\d/g) || []).sort().join();
    const result: Record<string, string> = {};
    labels.forEach((label, index) => {
      const candidate = translated[index]?.trim();
      // A label that lost or gained a placeholder would misnumber the clause.
      if (candidate && candidate !== label && placeholders(candidate) === placeholders(label)) result[label] = candidate;
    });
    return result;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') throw error;
    return {};
  }
}

async function detectContractLanguage(
  docxBytes: Uint8Array,
  model: DocumentTranslationModel,
  abortSignal?: AbortSignal
): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(docxBytes);
    const xml = await zip.file('word/document.xml')?.async('string');
    const sample = (xml || '')
      .replace(/<w:p[ >]/g, '\n$&')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (!sample) return null;
    return await detectLanguageCode(sample, model, abortSignal);
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') throw error;
    return null;
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
