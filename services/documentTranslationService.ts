/**
 * Document Translation Service
 * Orchestrates document parsing, translation via Gemini, and rebuilding
 * For PDFs: Uses ConvertAPI to convert PDF→DOCX, then translates and returns as DOCX
 * Output is always a translated Word document (.docx)
 */

import { getGeminiService, isGeminiServiceInitialized } from './geminiService';
import { parseDocx, rebuildDocx, TextSegment as DocxTextSegment } from './docxParser';
import { convertPdfToDocxWithConvertApi, isConvertApiConfigured } from './convertApiService';
import type { DocumentTranslateDocument, DocumentTranslationQuality, TranslationProgress } from '../types';

// Translation settings
const FAST_TRANSLATION_MODEL = 'gemini-2.5-flash';
const PROFESSIONAL_TRANSLATION_MODEL = 'gemini-3-flash-preview';
const BATCH_SIZE = 20; // Max segments per batch (reduced for paragraph-level translation)
const MAX_CHARS_PER_BATCH = 12000; // Max characters per batch
const MAX_CONCURRENT_BATCHES = 3;

const getTranslationModel = (quality?: DocumentTranslationQuality) => (
  quality === 'pro' ? PROFESSIONAL_TRANSLATION_MODEL : FAST_TRANSLATION_MODEL
);

export type TextSegment = DocxTextSegment;

export interface TranslationOptions {
  sourceDocument: DocumentTranslateDocument;
  sourceLanguage: string;
  targetLanguage: string;
  translationQuality?: DocumentTranslationQuality;
  onProgress: (progress: TranslationProgress) => void;
  abortSignal?: AbortSignal;
}

interface TranslationBatch {
  segments: TextSegment[];
  startIndex: number;
}

/**
 * Translate a document
 */
export async function translateDocument(options: TranslationOptions): Promise<string> {
  const { sourceDocument, sourceLanguage, targetLanguage, onProgress, abortSignal, translationQuality } = options;

  if (!isGeminiServiceInitialized()) {
    throw new Error('Gemini API not initialized. Please set your API key.');
  }

  const service = getGeminiService();
  const translationModel = getTranslationModel(translationQuality);
  const isPdf = sourceDocument.mimeType.includes('pdf');

  // Phase 0: Convert PDF to DOCX if needed (using ConvertAPI)
  let docxDataUrl = sourceDocument.dataUrl;

  if (isPdf) {
    if (!isConvertApiConfigured()) {
      throw new Error('ConvertAPI not configured. Please set VITE_CONVERTAPI_SECRET in .env\n\nGet your API secret from https://www.convertapi.com/ (250 free conversions)');
    }

    onProgress({
      phase: 'parsing',
      currentSegment: 0,
      totalSegments: 0,
      currentBatch: 0,
      totalBatches: 0,
      message: 'Converting PDF to Word...',
    });

    if (abortSignal?.aborted) {
      throw new DOMException('Translation cancelled', 'AbortError');
    }

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

  // Phase 1: Parse DOCX document (to extract text for context analysis)
  onProgress({
    phase: 'parsing',
    currentSegment: 0,
    totalSegments: 0,
    currentBatch: 0,
    totalBatches: 0,
    message: 'Parsing document...',
  });

  if (abortSignal?.aborted) {
    throw new DOMException('Translation cancelled', 'AbortError');
  }

  let segments: TextSegment[];
  let parseResult: any;

  parseResult = await parseDocx(docxDataUrl);
  segments = parseResult.segments;

  if (segments.length === 0) {
    throw new Error('No translatable text found in document.');
  }

  // Phase 2: Analyze document context
  onProgress({
    phase: 'parsing',
    currentSegment: 0,
    totalSegments: segments.length,
    currentBatch: 0,
    totalBatches: 0,
    message: 'Analyzing document context...',
  });

  if (abortSignal?.aborted) {
    throw new DOMException('Translation cancelled', 'AbortError');
  }

  const documentContext = await analyzeDocumentContext(
    service,
    segments,
    sourceLanguage,
    targetLanguage,
    translationModel,
    abortSignal
  );

  // Phase 3: Create batches
  const batches = createBatches(segments);
  const totalBatches = batches.length;
  const translations = new Map<string, string>();

  onProgress({
    phase: 'translating',
    currentSegment: 0,
    totalSegments: segments.length,
    currentBatch: 0,
    totalBatches,
    message: `Translating ${segments.length} text segments...`,
  });

  // Phase 4: Translate batches
  let processedSegments = 0;

  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    if (abortSignal?.aborted) {
      throw new DOMException('Translation cancelled', 'AbortError');
    }

    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_BATCHES);

    const batchPromises = batchGroup.map(async (batch, groupIndex) => {
      const batchIndex = i + groupIndex;

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

        // Store translations
        batch.segments.forEach((segment, idx) => {
          if (batchTranslations[idx] !== undefined) {
            translations.set(segment.id, batchTranslations[idx]);
          }
        });

        return batch.segments.length;
      } catch (error) {
        // On error, keep original text
        batch.segments.forEach((segment) => {
          translations.set(segment.id, segment.text);
        });
        return batch.segments.length;
      }
    });

    const results = await Promise.all(batchPromises);
    processedSegments += results.reduce((a, b) => a + b, 0);

    onProgress({
      phase: 'translating',
      currentSegment: processedSegments,
      totalSegments: segments.length,
      currentBatch: Math.min(i + MAX_CONCURRENT_BATCHES, batches.length),
      totalBatches,
      message: `Translated ${processedSegments} of ${segments.length} segments`,
    });
  }

  // Phase 5: Rebuild DOCX document
  onProgress({
    phase: 'rebuilding',
    currentSegment: segments.length,
    totalSegments: segments.length,
    currentBatch: totalBatches,
    totalBatches,
    message: 'Rebuilding document...',
  });

  if (abortSignal?.aborted) {
    throw new DOMException('Translation cancelled', 'AbortError');
  }

  let translatedDocxDataUrl: string;

  try {
    translatedDocxDataUrl = await rebuildDocx(parseResult, translations);
  } catch (error) {
    throw error;
  }

  // Output is always the translated DOCX (no conversion back to PDF)
  let outputDataUrl = translatedDocxDataUrl;

  // Phase 6: Complete
  onProgress({
    phase: 'complete',
    currentSegment: segments.length,
    totalSegments: segments.length,
    currentBatch: totalBatches,
    totalBatches,
    message: 'Translation complete!',
  });

  return outputDataUrl;
}

/**
 * Create batches of segments for translation
 */
function createBatches(segments: TextSegment[]): TranslationBatch[] {
  const batches: TranslationBatch[] = [];
  let currentBatch: TextSegment[] = [];
  let currentChars = 0;
  let startIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentChars = segment.text.length;

    // Start new batch if current batch is full
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

  // Add remaining segments
  if (currentBatch.length > 0) {
    batches.push({ segments: currentBatch, startIndex });
  }

  return batches;
}

/**
 * Analyze document context to improve translation accuracy
 */
async function analyzeDocumentContext(
  service: ReturnType<typeof getGeminiService>,
  segments: TextSegment[],
  sourceLanguage: string,
  targetLanguage: string,
  model: string,
  abortSignal?: AbortSignal
): Promise<string> {
  // Get full text from first ~500 segments or ~8000 chars for context analysis
  const sampleSegments = segments.slice(0, 500);
  const fullText = sampleSegments.map(s => s.text).join('\n');
  const textSample = fullText.substring(0, 8000); // Limit to ~8k chars for analysis

  const sourceLangDisplay = sourceLanguage === 'auto' ? 'the source language' : getLanguageName(sourceLanguage);

  const prompt = `Analyze this document excerpt and provide a brief context description that will help with translation accuracy.

DOCUMENT EXCERPT:
${textSample}

Provide a concise 2-3 sentence context description covering:
1. Document type (e.g., technical manual, architectural specifications, legal contract, marketing materials, etc.)
2. Subject matter/domain (e.g., construction, medicine, finance, technology, etc.)
3. Tone/style (e.g., formal, technical, conversational, etc.)

Focus on information that would help a translator understand specialized terminology and context.

Context description:`;

  try {
    const response = await service.generateText({
      prompt,
      model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 300,
        abortSignal,
      },
    });

    return response.trim();
  } catch (error) {
    // Return generic context on failure
    return `Professional document in ${sourceLangDisplay}.`;
  }
}

/**
 * Translate a batch of text segments using Gemini
 */
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

  const sourceLangDisplay = sourceLanguage === 'auto' ? 'the detected language' : getLanguageName(sourceLanguage);
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
      temperature: 0.4, // Balanced temperature for quality and consistency
      maxOutputTokens: 16384, // Increased for longer paragraphs
      abortSignal,
    },
  });

  // Parse response
  try {
    // Clean up response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    // Try to extract JSON from the response
    const jsonMatch = cleanResponse.match(/\{[\s\S]*"translations"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.translations)) {
      throw new Error('Invalid response format: translations is not an array');
    }

    // Ensure we have the right number of translations
    if (parsed.translations.length !== texts.length) {
      // Pad with original text if we're missing translations
      while (parsed.translations.length < texts.length) {
        const missingIndex = parsed.translations.length;
        parsed.translations.push(texts[missingIndex]);
      }

      // Trim if we have too many
      if (parsed.translations.length > texts.length) {
        parsed.translations = parsed.translations.slice(0, texts.length);
      }
    }

    return parsed.translations;
  } catch (error) {
    // Return original texts on parse failure
    return texts;
  }
}

/**
 * Get human-readable language name
 */
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

/**
 * Estimate the number of tokens in a text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  // This varies by language but is a reasonable approximation
  return Math.ceil(text.length / 4);
}

/**
 * Get supported languages
 */
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

