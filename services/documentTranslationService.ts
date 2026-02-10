/**
 * Document Translation Service
 * Orchestrates document parsing, translation via Gemini, and rebuilding.
 * For PDFs: Uses ConvertAPI to convert PDF→DOCX, then translates and returns as DOCX.
 * Output is always a translated Word document (.docx).
 *
 * Pipeline: parse → filter → analyze context → batch → translate → map → rebuild
 */

import { getGeminiService, isGeminiServiceInitialized } from './geminiService';
import { parseDocx } from './docxParserService';
import { rebuildDocx } from './docxRebuilderService';
import { convertPdfToDocxWithConvertApi, isConvertApiConfigured } from './convertApiService';
import type {
  DocumentTranslateDocument,
  DocumentTranslationQuality,
  TranslationProgress,
  TextSegment,
  ParsedLegalDocx,
} from '../types';

// Translation settings
const FAST_TRANSLATION_MODEL = 'gemini-2.5-flash';
const PROFESSIONAL_TRANSLATION_MODEL = 'gemini-3-flash-preview';
const BATCH_SIZE = 20;
const MAX_CHARS_PER_BATCH = 12000;
const MAX_CONCURRENT_BATCHES = 3;

const getTranslationModel = (quality?: DocumentTranslationQuality) =>
  quality === 'pro' ? PROFESSIONAL_TRANSLATION_MODEL : FAST_TRANSLATION_MODEL;

export type { TextSegment };

export interface TranslationOptions {
  sourceDocument: DocumentTranslateDocument;
  sourceLanguage: string;
  targetLanguage: string;
  translationQuality?: DocumentTranslationQuality;
  translateHeaders?: boolean;
  translateFootnotes?: boolean;
  onProgress: (progress: TranslationProgress) => void;
  abortSignal?: AbortSignal;
}

interface InternalBatch {
  segments: TextSegment[];
  startIndex: number;
}

// ============================================================================
// Main Pipeline
// ============================================================================

export async function translateDocument(options: TranslationOptions): Promise<string> {
  const {
    sourceDocument,
    sourceLanguage,
    targetLanguage,
    onProgress,
    abortSignal,
    translationQuality,
    translateHeaders = true,
    translateFootnotes = true,
  } = options;

  if (!isGeminiServiceInitialized()) {
    throw new Error('Gemini API not initialized. Please set your API key.');
  }

  const service = getGeminiService();
  const translationModel = getTranslationModel(translationQuality);
  const isPdf = sourceDocument.mimeType.includes('pdf');

  // Phase 0: Convert PDF to DOCX if needed
  let docxDataUrl = sourceDocument.dataUrl;

  if (isPdf) {
    if (!isConvertApiConfigured()) {
      throw new Error(
        'ConvertAPI not configured. Please set VITE_CONVERTAPI_SECRET in .env\n\nGet your API secret from https://www.convertapi.com/ (250 free conversions)'
      );
    }

    onProgress({
      phase: 'parsing',
      currentSegment: 0,
      totalSegments: 0,
      currentBatch: 0,
      totalBatches: 0,
      message: 'Converting PDF to Word...',
    });

    if (abortSignal?.aborted) throw new DOMException('Translation cancelled', 'AbortError');

    docxDataUrl = await convertPdfToDocxWithConvertApi(sourceDocument.dataUrl, (progress) => {
      onProgress({
        phase: 'parsing',
        currentSegment: 0,
        totalSegments: 0,
        currentBatch: 0,
        totalBatches: 0,
        message: progress.message,
      });
    });
  }

  // Phase 1: Parse DOCX document
  onProgress({
    phase: 'parsing',
    currentSegment: 0,
    totalSegments: 0,
    currentBatch: 0,
    totalBatches: 0,
    message: 'Parsing document...',
  });

  if (abortSignal?.aborted) throw new DOMException('Translation cancelled', 'AbortError');

  const parseResult: ParsedLegalDocx = await parseDocx(docxDataUrl, {
    translateHeaders,
    translateFootnotes,
  });

  const allSegments = parseResult.segments;

  if (allSegments.length === 0) {
    throw new Error('No translatable text found in document.');
  }

  // Step 1: Filter segments by settings
  const segmentsToTranslate = filterSegmentsBySettings(allSegments, {
    translateHeaders,
    translateFootnotes,
  });

  // Phase 2: Analyze document context (sample first 15 segments)
  onProgress({
    phase: 'parsing',
    currentSegment: 0,
    totalSegments: segmentsToTranslate.length,
    currentBatch: 0,
    totalBatches: 0,
    message: 'Analyzing document context...',
  });

  if (abortSignal?.aborted) throw new DOMException('Translation cancelled', 'AbortError');

  const documentContext = await analyzeDocumentContext(
    service,
    segmentsToTranslate,
    sourceLanguage,
    targetLanguage,
    translationModel,
    abortSignal
  );

  // Phase 3: Create batches
  const batches = createBatches(segmentsToTranslate);
  const totalBatches = batches.length;
  const translations = new Map<string, string>();

  onProgress({
    phase: 'translating',
    currentSegment: 0,
    totalSegments: segmentsToTranslate.length,
    currentBatch: 0,
    totalBatches,
    message: `Translating ${segmentsToTranslate.length} text segments...`,
  });

  // Phase 4: Translate batches with limited concurrency
  let processedSegments = 0;

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    if (abortSignal?.aborted) throw new DOMException('Translation cancelled', 'AbortError');

    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_BATCHES);

    const batchPromises = batchGroup.map(async (batch) => {
      try {
        const batchTranslations = await translateBatch(
          service,
          batch.segments,
          sourceLanguage,
          targetLanguage,
          documentContext,
          translationModel,
          abortSignal
        );

        batch.segments.forEach((segment, idx) => {
          const translated = batchTranslations[idx];
          translations.set(segment.id, translated);
          segment.translatedText = translated;
          segment.status = 'completed';
        });

        return batch.segments.length;
      } catch {
        // On error, keep original text
        batch.segments.forEach((segment) => {
          translations.set(segment.id, segment.text);
          segment.translatedText = segment.text;
          segment.status = 'error';
        });
        return batch.segments.length;
      }
    });

    const results = await Promise.all(batchPromises);
    processedSegments += results.reduce((a, b) => a + b, 0);

    onProgress({
      phase: 'translating',
      currentSegment: processedSegments,
      totalSegments: segmentsToTranslate.length,
      currentBatch: Math.min(i + MAX_CONCURRENT_BATCHES, batches.length),
      totalBatches,
      message: `Translated ${processedSegments} of ${segmentsToTranslate.length} segments`,
    });
  }

  // Final pass: ensure every segment in allSegments has a translation
  for (const segment of allSegments) {
    if (!translations.has(segment.id)) {
      translations.set(segment.id, segment.text);
    }
  }

  // Phase 5: Rebuild DOCX document
  onProgress({
    phase: 'rebuilding',
    currentSegment: segmentsToTranslate.length,
    totalSegments: segmentsToTranslate.length,
    currentBatch: totalBatches,
    totalBatches,
    message: 'Rebuilding document...',
  });

  if (abortSignal?.aborted) throw new DOMException('Translation cancelled', 'AbortError');

  const outputDataUrl = await rebuildDocx(parseResult, translations);

  // Phase 6: Complete
  onProgress({
    phase: 'complete',
    currentSegment: segmentsToTranslate.length,
    totalSegments: segmentsToTranslate.length,
    currentBatch: totalBatches,
    totalBatches,
    message: 'Translation complete!',
  });

  return outputDataUrl;
}

// ============================================================================
// Segment Filtering
// ============================================================================

function filterSegmentsBySettings(
  segments: TextSegment[],
  settings: { translateHeaders: boolean; translateFootnotes: boolean }
): TextSegment[] {
  return segments.filter((s) => {
    if (s.context.location === 'header' && !settings.translateHeaders) return false;
    if (s.context.location === 'footer' && !settings.translateHeaders) return false;
    if (s.context.location === 'footnote' && !settings.translateFootnotes) return false;
    return true;
  });
}

// ============================================================================
// Batching
// ============================================================================

function createBatches(segments: TextSegment[]): InternalBatch[] {
  const batches: InternalBatch[] = [];
  let currentBatch: TextSegment[] = [];
  let currentChars = 0;
  let startIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentChars = segment.text.length;

    if (
      currentBatch.length >= BATCH_SIZE ||
      (currentChars + segmentChars > MAX_CHARS_PER_BATCH && currentBatch.length > 0)
    ) {
      batches.push({ segments: currentBatch, startIndex });
      currentBatch = [];
      currentChars = 0;
      startIndex = i;
    }

    currentBatch.push(segment);
    currentChars += segmentChars;
  }

  if (currentBatch.length > 0) {
    batches.push({ segments: currentBatch, startIndex });
  }

  return batches;
}

// ============================================================================
// Context Analysis
// ============================================================================

async function analyzeDocumentContext(
  service: ReturnType<typeof getGeminiService>,
  segments: TextSegment[],
  sourceLanguage: string,
  targetLanguage: string,
  model: string,
  abortSignal?: AbortSignal
): Promise<string> {
  // Sample first 15 segments for context analysis
  const sampleSegments = segments.slice(0, 15);
  const textSample = sampleSegments.map((s) => s.text).join('\n');

  const sourceLangDisplay =
    sourceLanguage === 'auto' ? 'the source language' : getLanguageName(sourceLanguage);

  const prompt = `Analyze this document excerpt and return a JSON description to help with translation.

DOCUMENT EXCERPT:
${textSample}

Return a JSON object with these fields:
{
  "documentType": "e.g. technical manual, legal contract, architectural specifications",
  "domain": "e.g. construction, medicine, finance, technology",
  "tone": "e.g. formal, technical, conversational",
  "specialTerms": ["list of domain-specific terms found"]
}

Return ONLY the JSON:`;

  try {
    const response = await service.generateText({
      prompt,
      model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        abortSignal,
      },
    });

    // Try to parse JSON context; fall back to using raw text as context
    const cleaned = response.trim().replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    try {
      const parsed = JSON.parse(cleaned);
      return `Document type: ${parsed.documentType || 'unknown'}. Domain: ${parsed.domain || 'general'}. Tone: ${parsed.tone || 'formal'}.${parsed.specialTerms?.length ? ` Key terms: ${parsed.specialTerms.join(', ')}.` : ''}`;
    } catch {
      return cleaned;
    }
  } catch {
    return `Professional document in ${sourceLangDisplay}.`;
  }
}

// ============================================================================
// Translation
// ============================================================================

async function translateBatch(
  service: ReturnType<typeof getGeminiService>,
  segments: TextSegment[],
  sourceLanguage: string,
  targetLanguage: string,
  documentContext: string,
  model: string,
  abortSignal?: AbortSignal
): Promise<string[]> {
  const texts = segments.map((s) => s.text);

  const sourceLangDisplay =
    sourceLanguage === 'auto' ? 'the detected language' : getLanguageName(sourceLanguage);
  const targetLangDisplay = getLanguageName(targetLanguage);

  const prompt = `You are translating a professional document from ${sourceLangDisplay} to ${targetLangDisplay}.

DOCUMENT CONTEXT:
${documentContext}

Use this context to ensure accurate translation of specialized terms and domain-specific vocabulary.

CRITICAL INSTRUCTIONS:
1. You MUST return EXACTLY ${texts.length} translations in a JSON array
2. Each translation corresponds to the input segment at the same index
3. Return ONLY valid JSON - no markdown, no code blocks, no explanations
4. Preserve spacing, punctuation, line breaks, and formatting exactly
5. Keep numbers, dates, times, codes, and references unchanged
6. Keep proper nouns, brand names, and technical terms unchanged
7. Maintain the same tone and formality level as the original
8. If a segment is already in ${targetLangDisplay}, return it unchanged

Input array (${texts.length} segments):
${JSON.stringify(texts, null, 2)}

Required JSON response format:
{
  "translations": [
    "translation of segment 0",
    "translation of segment 1",
    ...
  ]
}

Return the JSON now:`;

  const response = await service.generateText({
    prompt,
    model,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 16384,
      abortSignal,
    },
  });

  return parseTranslationResponse(response, texts);
}

// ============================================================================
// Response Parsing (improved)
// ============================================================================

function parseTranslationResponse(response: string, originalTexts: string[]): string[] {
  try {
    let cleaned = response.trim();

    // Remove Markdown fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    let translations: string[];

    // Try JSON object with "translations" key
    const objMatch = cleaned.match(/\{[\s\S]*"translations"[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      if (Array.isArray(parsed.translations)) {
        translations = parsed.translations;
      } else {
        throw new Error('translations is not an array');
      }
    } else {
      // Try bare JSON array
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const parsed = JSON.parse(arrMatch[0]);
        if (Array.isArray(parsed)) {
          translations = parsed;
        } else {
          throw new Error('Not an array');
        }
      } else {
        throw new Error('No valid JSON found in response');
      }
    }

    // Count mismatch handling
    if (translations.length < originalTexts.length) {
      // Pad with original text
      while (translations.length < originalTexts.length) {
        translations.push(originalTexts[translations.length]);
      }
    } else if (translations.length > originalTexts.length) {
      // Trim extras
      translations = translations.slice(0, originalTexts.length);
    }

    return translations;
  } catch {
    // Total parse failure: return original texts
    return [...originalTexts];
  }
}

// ============================================================================
// Utilities
// ============================================================================

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    auto: 'Auto-detect',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    ru: 'Russian',
  };
  return languages[code] || code;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function getSupportedLanguages(): Array<{ code: string; name: string }> {
  return [
    { code: 'auto', name: 'Auto-detect' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' },
  ];
}
