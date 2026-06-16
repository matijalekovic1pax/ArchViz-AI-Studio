/**
 * Generation Hook
 * Wires Gemini API service with app state for all generation features
 */

import { useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { adaptImagePromptForModel, generatePrompt } from '../engine/promptEngine';
import {
  getGeminiService,
  isGeminiServiceInitialized,
  initGeminiService,
  ImageUtils,
  IMAGE_MODEL,
  GeminiResponse,
  ImageData,
  ImageEditRequest,
  GeneratedImage,
  AttachmentData,
  GenerationConfig,
  ImageConfig,
  TEXT_MODEL,
  OUTPUT_VERIFICATION_MIN_SCORE,
  type ImageGenerationProgress,
  type ImageOutputVerificationResult
} from '../services/geminiService';
import { getVideoGenerationService } from '../services/videoGenerationService';
import { classifyDocumentRole } from '../services/materialValidationPipeline';
import { createMaterialValidationService } from '../services/materialValidationService';
import { translateToEnglish, needsTranslation } from '../services/translationService';
import { translateDocument } from '../services/documentTranslationService';
import {
  createGatewayTraceId,
  isGatewayAuthenticated,
  queueAppLogEvent,
  setActiveGenerationTraceId,
} from '../services/apiGateway';
import { isConvertApiConfigured } from '../services/convertApiService';
import { initializeILoveApi, isILoveApiConfigured } from '../services/iLoveApiService';
import { compressPdfBatch } from '../lib/pdfCompression';
import { getMaterialById } from '../lib/materialCatalog';
import {
  applyVisualPostProduction
} from '../lib/visualPostProcessing';
import { AI_SLOP_UPSCALER_SUGGESTION_EVENT } from '../lib/assistantEvents';
import { nanoid } from 'nanoid';
import { AI_SLOP_UPSCALE_IMAGE_MODEL, type AppState, type GenerationMode, type GenerationProgressStage, type TranslationProgress, type VideoGenerationProgress } from '../types';

const TEXT_ONLY_MODES: GenerationMode[] = ['material-validation', 'document-translate'];
const RENDER_FORMAT_MODES: GenerationMode[] = ['render-3d', 'render-cad', 'render-sketch'];
const SOURCE_LOCKED_MODES: GenerationMode[] = [
  'render-3d',
  'scene-compose',
  'render-cad',
  'render-sketch',
  'masterplan',
  'exploded',
  'section',
  'angle-change',
  'multi-angle',
  'img-to-cad'
];
const STRICT_SOURCE_FIDELITY_MODES: GenerationMode[] = ['render-3d', 'render-cad', 'render-sketch', 'upscale'];
const RENDER_GENERATION_PIPELINE_MODES: GenerationMode[] = ['render-sketch'];
const OUTPUT_VERIFICATION_MAX_ATTEMPTS = 3;
const OUTPUT_VERIFICATION_TIMEOUT_MS = 90 * 1000;
const TEMPORARY_AI_SERVICE_STATUSES = new Set([500, 502, 503, 504]);

const estimateBase64Bytes = (base64: string): number => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const summarizeDataUrlForLog = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/s);
  const payload = match?.[2] || '';
  return {
    present: true,
    mimeType: match?.[1] || null,
    chars: value.length,
    bytesApprox: payload ? estimateBase64Bytes(payload) : null,
  };
};

const summarizeImageDataForLog = (image: ImageData, index: number) => ({
  index,
  mimeType: image.mimeType,
  width: image.width ?? null,
  height: image.height ?? null,
  base64Chars: image.base64?.length || 0,
  bytesApprox: image.base64 ? estimateBase64Bytes(image.base64) : 0,
});

const summarizeAttachmentForLog = (attachment: AttachmentData, index: number) => ({
  index,
  name: attachment.name || null,
  mimeType: attachment.mimeType,
  base64Chars: attachment.base64?.length || 0,
  bytesApprox: attachment.base64 ? estimateBase64Bytes(attachment.base64) : 0,
});

const getGenerationLogRoute = (
  mode: GenerationMode,
  imageGenerationModel: AppState['imageGenerationModel'],
  videoState: AppState['workflow']['videoState']
) => {
  if (mode === 'video') {
    const usesKling = videoState.model === 'kling-2.6';
    return {
      provider: usesKling ? 'kling' : 'veo',
      model: videoState.model,
    };
  }

  if (mode === 'pdf-compression') {
    return { provider: 'pdf-compression', model: null };
  }

  if (imageGenerationModel === 'chatgpt-image-generation-2' && !TEXT_ONLY_MODES.includes(mode)) {
    return { provider: 'openai', model: 'gpt-image-2' };
  }

  return {
    provider: 'gemini',
    model: TEXT_ONLY_MODES.includes(mode) ? TEXT_MODEL : IMAGE_MODEL,
  };
};

const getErrorMetadata = (error: unknown): { status?: number; provider?: string } => {
  const seen = new Set<unknown>();
  const metadata: { status?: number; provider?: string } = {};

  const visit = (value: unknown, depth = 0) => {
    if (!value || depth > 4 || seen.has(value)) return;
    seen.add(value);

    if (typeof value === 'object') {
      const candidate = value as {
        status?: unknown;
        provider?: unknown;
        details?: unknown;
        cause?: unknown;
      };
      if (metadata.status === undefined && typeof candidate.status === 'number') {
        metadata.status = candidate.status;
      }
      if (metadata.provider === undefined && typeof candidate.provider === 'string') {
        metadata.provider = candidate.provider;
      }
      visit(candidate.details, depth + 1);
      visit(candidate.cause, depth + 1);
    }
  };

  visit(error);
  return metadata;
};

const isTemporaryAiServiceFailure = (error: unknown, message: string): boolean => {
  const { status, provider } = getErrorMetadata(error);
  const lowerMessage = message.toLowerCase();
  const isAuthOrConfigurationIssue =
    status === 401 ||
    status === 403 ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('api_key') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('not configured');

  if (isAuthOrConfigurationIssue) return false;

  if (status !== undefined && TEMPORARY_AI_SERVICE_STATUSES.has(status)) {
    return provider === 'openai-image' || lowerMessage.includes('openai') || lowerMessage.includes('image api');
  }

  return (
    lowerMessage.includes('503') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('504') ||
    lowerMessage.includes('service unavailable') ||
    lowerMessage.includes('temporarily unavailable') ||
    lowerMessage.includes('overloaded') ||
    lowerMessage.includes('capacity') ||
    lowerMessage.includes('try again later') ||
    lowerMessage.includes('gateway timeout') ||
    lowerMessage.includes('timed out')
  );
};

const getTemporaryAiServiceAlertMessage = (error: unknown, message: string): string => {
  const { status } = getErrorMetadata(error);
  const lowerMessage = message.toLowerCase();

  if (status === 504 || lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'The AI image service did not return in time. This is usually temporary, so please try again in a few minutes.';
  }

  return 'The request reached the app, but the AI image service returned a temporary availability error. This is usually an upstream service disruption, so please try again in a few minutes.';
};

const IMAGE_PIPELINE_PROGRESS_RANGES: Record<ImageGenerationProgress['phase'], [number, number]> = {
  'ai-middle-layer': [3, 28],
  generation: [28, 84],
  'image-transfer': [84, 90],
  verification: [90, 98],
  complete: [98, 98],
};

const IMAGE_PIPELINE_STAGES: Record<ImageGenerationProgress['phase'], GenerationProgressStage> = {
  'ai-middle-layer': 'aiLayer',
  generation: 'generation',
  'image-transfer': 'transfer',
  verification: 'aiLayer',
  complete: 'finalizing',
};

const SOURCE_FIDELITY_CONTRACT = [
  'Source fidelity contract: the first input image is the locked source reference.',
  'Preserve the camera, crop, perspective, horizon, field of view, room layout, structural geometry, major object count, object positions, wall/floor/ceiling boundaries, signage blocks, openings, stairs, columns, railings, furniture, planting, and graphic placements.',
  'Do not invent a different design, move architectural elements, replace the scene, or use style/lighting instructions as permission to redraw the composition.',
  'If any user instruction conflicts with the source image, follow the source image.'
].join(' ');

const ISOLATED_BACKGROUND_REQUEST_PATTERN = /(?:transparent|transparente|alpha|png)\s+(?:background|fondo)|(?:background|fondo)\s+(?:transparent|transparente)|(?:no|without|remove)\s+(?:background|fondo)|sin\s+fondo|fondo\s+transparente|png\s+transparente/i;
const ISOLATED_ASSET_PATTERN = /\b(emoji|emojis|emoticon|emoticono|emoticonos|emote|sticker|stickers|icon|icons|icono|iconos|avatar|badge|badges|cutout|cut-out)\b/i;
const PLAIN_FOLLOW_UP_PATTERN = /^(change|make|turn|set|replace|modify|edit|adjust|update|remove|add|keep|preserve|only|just|now|same|try|haz|cambia|cambiar|pon|poner|quita|editar|modifica)\b|\b(her|his|their|its|the same|same image|helmet|casco|color)\b/i;

const ISOLATED_ASSET_OUTPUT_INSTRUCTION = [
  'Isolated asset output:',
  'The selected image models do not provide real alpha transparency, so use a clean pure white background instead.',
  'Do not render a checkerboard pattern, gray transparency grid, photo backdrop, shadow box, or visible scene background.',
  'Keep the subject centered with clean anti-aliased edges and a tight icon/sticker-safe silhouette.'
].join(' ');

const shouldUseIsolatedAssetOutput = (prompt: string): boolean => {
  const normalized = prompt.trim();
  if (!normalized) return false;
  return ISOLATED_BACKGROUND_REQUEST_PATTERN.test(normalized) || ISOLATED_ASSET_PATTERN.test(normalized);
};

const getRecentPlainGenerateHistory = (history: AppState['history'], limit = 4): AppState['history'] =>
  history
    .filter((item) => item.mode === 'generate-text' && item.settings?.kind !== 'source')
    .slice(-limit);

const getLatestPlainGenerateImage = (state: AppState): string | null => {
  if (state.uploadedImage?.startsWith('data:image/')) return state.uploadedImage;
  const latestHistoryImage = [...state.history]
    .reverse()
    .find((item) =>
      item.mode === 'generate-text' &&
      item.settings?.kind !== 'source' &&
      item.thumbnail?.startsWith('data:image/')
    );
  return latestHistoryImage?.thumbnail || null;
};

const isLikelyPlainGenerateFollowUp = (prompt: string): boolean =>
  PLAIN_FOLLOW_UP_PATTERN.test(prompt.trim());

const buildPlainGenerateConversationPrompt = (
  currentPrompt: string,
  history: AppState['history'],
  options: {
    hasContextImage: boolean;
    isLikelyFollowUp: boolean;
    wantsIsolatedAssetOutput: boolean;
  }
): string => {
  const recentHistory = getRecentPlainGenerateHistory(history);
  if (!recentHistory.length && !options.hasContextImage && !options.wantsIsolatedAssetOutput) {
    return currentPrompt;
  }

  const historyLines = recentHistory.map((item, index) =>
    `${index + 1}. User asked: ${item.prompt.replace(/\s+/g, ' ').trim().slice(0, 500) || '(image prompt not recorded)'}`
  );

  return [
    'You are continuing a plain image-generation conversation.',
    historyLines.length > 0
      ? ['Recent image-generation turns, oldest to newest:', ...historyLines].join('\n')
      : '',
    options.hasContextImage
      ? 'A reference image is attached. Treat it as the latest generated image when the current request is a follow-up edit.'
      : '',
    `Current user request: ${currentPrompt}`,
    options.isLikelyFollowUp
      ? 'Apply the current request as an edit to the latest generated image. Preserve subject identity, composition, style, and all unchanged details.'
      : 'If the current request is a follow-up, edit the latest generated image and preserve unchanged details. If it is a standalone new request, ignore unrelated prior turns and create a new image from the current request.',
    options.wantsIsolatedAssetOutput ? ISOLATED_ASSET_OUTPUT_INSTRUCTION : ''
  ].filter(Boolean).join('\n\n');
};

const loadCanvasImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for canvas processing.'));
    img.src = src;
  });

const generatedImageFromDataUrl = (dataUrl: string): GeneratedImage => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  return {
    dataUrl,
    mimeType: (match?.[1] as GeneratedImage['mimeType']) || 'image/png',
    base64: match?.[2] || dataUrl.split(',')[1] || ''
  };
};

const pickFinalImage = (images?: GeneratedImage[]): GeneratedImage | null => {
  if (!images || images.length === 0) return null;
  return images[images.length - 1];
};

const withOutputVerificationSettings = (
  settings: Record<string, any> | undefined,
  result: GeminiResponse
) => {
  if (!result.outputVerification) return settings;
  return {
    ...(settings || {}),
    outputVerification: {
      score: result.outputVerification.score,
      summary: result.outputVerification.summary,
      issues: result.outputVerification.issues,
      attempts: result.outputVerificationAttempts ?? 1,
      aiSlopDetected: result.outputVerification.aiSlopDetected || undefined,
      aiSlopConfidence: result.outputVerification.aiSlopConfidence,
      aiSlopIndicators: result.outputVerification.aiSlopIndicators,
      aiSlopSuggestion: result.outputVerification.aiSlopSuggestion
    }
  };
};

const getAiSlopDetectionForVisibleResult = (result: GeminiResponse) => {
  const verifications = [
    result.outputVerification,
    ...(result.outputVerifications || [])
  ].filter((verification): verification is ImageOutputVerificationResult => Boolean(verification));

  return verifications
    .filter((verification) => verification.aiSlopDetected)
    .sort((a, b) => (b.aiSlopConfidence ?? 0) - (a.aiSlopConfidence ?? 0))[0] || null;
};

const suggestAiSlopUpscalerIfNeeded = (
  result: GeminiResponse,
  mode: GenerationMode,
  upscaleMode: AppState['workflow']['upscaleMode']
) => {
  if (typeof window === 'undefined') return;
  if (mode === 'upscale' && upscaleMode === 'ai-slop') return;

  const detection = getAiSlopDetectionForVisibleResult(result);
  if (!detection) return;

  window.dispatchEvent(new CustomEvent(AI_SLOP_UPSCALER_SUGGESTION_EVENT, {
    detail: {
      id: nanoid(),
      score: detection.aiSlopConfidence,
      summary: detection.aiSlopSuggestion || detection.summary,
      indicators: detection.aiSlopIndicators || []
    }
  }));
};

const drawMaskImageData = (
  mask: HTMLImageElement,
  width: number,
  height: number,
  options: { invert?: boolean; alphaMask?: boolean } = {}
): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(mask, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    const value = options.invert ? 255 - luminance : luminance;
    pixels[index] = options.alphaMask ? 255 : value;
    pixels[index + 1] = options.alphaMask ? 255 : value;
    pixels[index + 2] = options.alphaMask ? 255 : value;
    pixels[index + 3] = options.alphaMask ? value : 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const getGuidanceMaskFeatherRadius = (width: number, height: number, featherAmount: number): number => {
  const longEdge = Math.max(width, height);
  const normalizedFeather = Math.min(100, Math.max(0, featherAmount)) / 100;
  const radius = longEdge * (0.006 + normalizedFeather * 0.028);
  return Math.round(Math.min(96, Math.max(4, radius)));
};

const createGuidanceMaskDataUrl = async (
  maskDataUrl: string,
  featherAmount: number
): Promise<string> => {
  const mask = await loadCanvasImage(maskDataUrl);
  const width = mask.naturalWidth || mask.width;
  const height = mask.naturalHeight || mask.height;
  if (!width || !height) return maskDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return maskDataUrl;

  const radius = getGuidanceMaskFeatherRadius(width, height, featherAmount);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(mask, 0, 0, width, height);
  ctx.filter = 'none';

  return canvas.toDataURL('image/png');
};

const createEditableMaskDataUrl = async (maskDataUrl: string, invert: boolean, alphaMask = false): Promise<string> => {
  if (!invert && !alphaMask) return maskDataUrl;
  const mask = await loadCanvasImage(maskDataUrl);
  const width = mask.naturalWidth || mask.width;
  const height = mask.naturalHeight || mask.height;
  if (!width || !height) return maskDataUrl;
  return drawMaskImageData(mask, width, height, { invert, alphaMask })?.toDataURL('image/png') || maskDataUrl;
};

const getVisualMaskMode = (
  activeVisualTool: string,
  shouldUseSelectionMask: boolean,
  editOutsideSelection: boolean
): ImageEditRequest['maskMode'] | undefined => {
  if (!shouldUseSelectionMask) return undefined;
  return editOutsideSelection ? 'strict' : 'guided';
};

const materialPreviewToImageData = async (previewUrl: string, fallbackUrl?: string): Promise<ImageData | null> => {
  try {
    let preview: HTMLImageElement;
    try {
      preview = await loadCanvasImage(previewUrl);
    } catch {
      if (!fallbackUrl || fallbackUrl === previewUrl) return null;
      preview = await loadCanvasImage(fallbackUrl);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
    return ImageUtils.dataUrlToImageData(canvas.toDataURL('image/png'));
  } catch {
    return null;
  }
};

const compositeVisualEditResult = async (
  sourceDataUrl: string,
  generated: GeneratedImage,
  selectedMaskDataUrl: string,
  editOutsideSelection: boolean
): Promise<GeneratedImage> => {
  const [source, generatedImage, selectedMask] = await Promise.all([
    loadCanvasImage(sourceDataUrl),
    loadCanvasImage(generated.dataUrl),
    loadCanvasImage(selectedMaskDataUrl)
  ]);

  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (!width || !height) return generated;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return generated;
  ctx.drawImage(source, 0, 0, width, height);

  const editCanvas = document.createElement('canvas');
  editCanvas.width = width;
  editCanvas.height = height;
  const editCtx = editCanvas.getContext('2d');
  if (!editCtx) return generated;
  editCtx.drawImage(generatedImage, 0, 0, width, height);

  const maskCanvas = drawMaskImageData(selectedMask, width, height, {
    invert: editOutsideSelection,
    alphaMask: true
  });
  if (!maskCanvas) return generated;

  editCtx.globalCompositeOperation = 'destination-in';
  editCtx.drawImage(maskCanvas, 0, 0);
  ctx.drawImage(editCanvas, 0, 0);

  return generatedImageFromDataUrl(canvas.toDataURL('image/png'));
};

// Initialize Gemini service if gateway is authenticated
const ensureServiceInitialized = (): boolean => {
  if (isGeminiServiceInitialized()) {
    return true;
  }

  if (!isGatewayAuthenticated()) {
    return false;
  }

  initGeminiService();
  return true;
};

// Check if PDF conversion is available (ConvertAPI via gateway)
const ensurePdfConverterInitialized = (): boolean => {
  return isConvertApiConfigured();
};

// Initialize iLovePDF API (gateway handles auth)
const ensureILoveApiInitialized = async (): Promise<boolean> => {
  if (isILoveApiConfigured()) {
    return await initializeILoveApi();
  }
  return false;
};

export type GenerationAttachment = string | { dataUrl: string; name?: string };

export interface GenerationOptions {
  prompt?: string;
  attachments?: GenerationAttachment[];
  numberOfImages?: number;
}

export interface UseGenerationReturn {
  generate: (options?: GenerationOptions) => Promise<void>;
  generateFromState: () => Promise<void>;
  cancelGeneration: () => void;
  isReady: boolean;
  setApiKey: (key: string) => void;
}

export function useGeneration(): UseGenerationReturn {
  const { state, dispatch } = useAppStore();
  const { i18n } = useTranslation();
  const abortControllerRef = useRef<AbortController | null>(null);
  const upscaleBatchSnapshotRef = useRef<AppState['workflow']['upscaleBatch'] | null>(null);

  const isReady = ensureServiceInitialized();
  const effectiveImageGenerationModel =
    state.mode === 'upscale' && state.workflow.upscaleMode === 'ai-slop'
      ? AI_SLOP_UPSCALE_IMAGE_MODEL
      : state.imageGenerationModel;

  // Auto-initialize PDF services
  useEffect(() => {
    ensureILoveApiInitialized(); // iLovePDF via gateway (best quality, monthly limit)
  }, []);

  // No-op — API keys are managed server-side by the gateway
  const setApiKey = useCallback((_key: string) => {
    // No-op: gateway handles API keys server-side
  }, []);

  /**
   * Convert data URL to ImageData for API
   */
  const dataUrlToImageData = useCallback((dataUrl: string): ImageData | null => {
    try {
      return ImageUtils.dataUrlToImageData(dataUrl);
    } catch {
      return null;
    }
  }, []);

  const parseDataUrl = useCallback((dataUrl: string) => {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    return { mimeType: matches[1], base64: matches[2] };
  }, []);

  const resolveClosestAspectRatio = useCallback(async (dataUrl?: string | null): Promise<ImageConfig['aspectRatio'] | null> => {
    if (!dataUrl) return null;
    const supportedRatios: Array<{ label: ImageConfig['aspectRatio']; value: number }> = [
      { label: '1:1', value: 1 },
      { label: '2:3', value: 2 / 3 },
      { label: '3:2', value: 3 / 2 },
      { label: '3:4', value: 3 / 4 },
      { label: '4:3', value: 4 / 3 },
      { label: '4:5', value: 4 / 5 },
      { label: '5:4', value: 5 / 4 },
      { label: '9:16', value: 9 / 16 },
      { label: '16:9', value: 16 / 9 },
      { label: '21:9', value: 21 / 9 },
    ];

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }
        const ratio = width / height;
        let closest = supportedRatios[0];
        let minDelta = Math.abs(ratio - closest.value);
        supportedRatios.forEach((candidate) => {
          const delta = Math.abs(ratio - candidate.value);
          if (delta < minDelta) {
            minDelta = delta;
            closest = candidate;
          }
        });
        resolve(closest.label);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }, []);

  const buildMaterialValidationPrompt = useCallback((userPrompt?: string) => {
    const { documents, checks } = state.materialValidation;
    const docLines = documents.map((doc) => `- ${doc.name}`);
    const scope: string[] = [];
    if (checks.crossReferenceBoq) scope.push('Cross-reference BoQ against materials.');
    if (checks.technicalSpec) scope.push('Validate technical specifications and standards.');

    const checkItems: string[] = [];
    if (checks.dimensions) checkItems.push('dimensions');
    if (checks.productRefs) checkItems.push('product references');
    if (checks.quantities) checkItems.push('quantities');

    const userNotes = userPrompt?.trim() ? `User notes: ${userPrompt.trim()}` : '';

    return [
      'You are an architectural materials validation engine.',
      'Use the attached documents to extract materials and BoQ items, then report discrepancies.',
      'Documents:',
      ...(docLines.length > 0 ? docLines : ['- (none listed)']),
      scope.length > 0 ? `Scope: ${scope.join(' ')}` : 'Scope: standard material validation.',
      checkItems.length > 0 ? `Checks to run: ${checkItems.join(', ')}.` : 'Checks to run: none.',
      userNotes,
      'Return ONLY valid JSON with this shape:',
      '{ "summary": string, "materials": [...], "boqItems": [...], "issues": [...] }',
      'Materials: [{ code, name, category, description, referenceProduct:{type,brand}, drawingRef, source, dimensions, notes, application }]',
      'BoQ items: [{ code, section, description, materialRef, product:{type,brand}, quantity:{terminal,cargo,unit} }]',
      'Issues: [{ id, code, type, severity, message, details, recommendation, sourceDocument, resolved, date }]',
      'Rules:',
      '- type must be one of: technical, boq, drawing, documentation.',
      '- severity must be one of: pass, warning, error, info, pending.',
      '- Use empty strings or empty arrays instead of null.',
      '- If a field is unknown, use empty string or omit optional fields.',
      '- Use material codes as code; for missing codes use MAT-###.',
      '- Keep JSON compact (no markdown, no extra commentary).',
      '- Prefer listing only materials/BoQ items that have discrepancies; omit fully matching items if output is long.',
      '- If you must omit items, note that in the summary (e.g., "Omitted N matching items for brevity").'
    ].filter(Boolean).join('\n');
  }, [state.materialValidation]);

  const normalizeMaterialValidationResult = useCallback((text: string) => {
    const repairTruncatedJson = (value: string) => {
      const input = value.trim();
      let inString = false;
      let escape = false;
      const stack: string[] = [];
      let lastBoundaryIndex = -1;
      let lastBoundaryStack: string[] = [];

      for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === '\\') {
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }

        if (ch === '{' || ch === '[') {
          stack.push(ch);
          continue;
        }

        if (ch === '}' || ch === ']') {
          const last = stack[stack.length - 1];
          const matches = (ch === '}' && last === '{') || (ch === ']' && last === '[');
          if (matches) {
            stack.pop();
            lastBoundaryIndex = i;
            lastBoundaryStack = [...stack];
          }
        }
      }

      if (lastBoundaryIndex === -1) {
        throw new Error('JSON response appears truncated and cannot be repaired.');
      }

      const trimmed = input.slice(0, lastBoundaryIndex + 1);
      const closing = lastBoundaryStack
        .slice()
        .reverse()
        .map((open) => (open === '{' ? '}' : ']'))
        .join('');

      return `${trimmed}${closing}`;
    };

    const extractJson = (value: string) => {
      const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = (fenced ? fenced[1] : value).trim();
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error('No JSON object found in response.');
      }
      const jsonSlice = candidate.slice(start, end + 1);
      try {
        return JSON.parse(jsonSlice);
      } catch {
        const repaired = repairTruncatedJson(jsonSlice);
        return JSON.parse(repaired);
      }
    };

    const normalizeCategory = (value: string, code: string) => {
      const upper = value.toUpperCase();
      const allowed = new Set(['FF', 'WF', 'IC', 'WP', 'RF', 'L']);
      if (allowed.has(upper)) return upper;
      const fromCode = code.slice(0, 2).toUpperCase();
      return allowed.has(fromCode) ? fromCode : 'FF';
    };

    const normalizeSource = (value: string, name: string) => {
      const lowered = value.toLowerCase();
      if (lowered === 'cargo' || name.toLowerCase().includes('cargo')) return 'cargo';
      return 'terminal';
    };

    const normalizeIssueType = (value: string) => {
      const lowered = value.toLowerCase();
      if (['technical', 'boq', 'drawing', 'documentation'].includes(lowered)) return lowered;
      return 'technical';
    };

    const normalizeSeverity = (value: string) => {
      const lowered = value.toLowerCase();
      if (['pass', 'warning', 'error', 'pending', 'info'].includes(lowered)) return lowered;
      return 'warning';
    };

    const raw = extractJson(text);
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
    const rawMaterials = Array.isArray(raw.materials) ? raw.materials : [];
    const rawBoqItems = Array.isArray(raw.boqItems) ? raw.boqItems : [];
    const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];

    const materials = rawMaterials.map((item: any, index: number) => {
      const code = typeof item.code === 'string' && item.code.trim() ? item.code.trim() : `MAT-${index + 1}`;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const category = normalizeCategory(
        typeof item.category === 'string' ? item.category : '',
        code
      );
      const referenceProduct = item.referenceProduct || {};
      return {
        code,
        name,
        category,
        description: typeof item.description === 'string' ? item.description.trim() : '',
        referenceProduct: {
          type: typeof referenceProduct.type === 'string' ? referenceProduct.type.trim() : '',
          brand: typeof referenceProduct.brand === 'string' ? referenceProduct.brand.trim() : ''
        },
        drawingRef: typeof item.drawingRef === 'string' ? item.drawingRef.trim() : '',
        source: normalizeSource(typeof item.source === 'string' ? item.source : '', name),
        dimensions: typeof item.dimensions === 'string' ? item.dimensions.trim() : undefined,
        notes: Array.isArray(item.notes)
          ? item.notes.map((note: any) => String(note))
          : typeof item.notes === 'string' && item.notes.trim()
            ? [item.notes.trim()]
            : [],
        application: typeof item.application === 'string' ? item.application.trim() : undefined
      };
    });

    const boqItems = rawBoqItems.map((item: any, index: number) => {
      const quantity = item.quantity || {};
      const product = item.product || {};
      return {
        code: typeof item.code === 'string' ? item.code.trim() : `BOQ-${index + 1}`,
        section: typeof item.section === 'string' ? item.section.trim() : '',
        description: typeof item.description === 'string' ? item.description.trim() : '',
        materialRef: typeof item.materialRef === 'string' ? item.materialRef.trim() : '',
        product: {
          type: typeof product.type === 'string' ? product.type.trim() : '',
          brand: typeof product.brand === 'string' ? product.brand.trim() : ''
        },
        quantity: {
          terminal: typeof quantity.terminal === 'number' ? quantity.terminal : undefined,
          cargo: typeof quantity.cargo === 'number' ? quantity.cargo : undefined,
          unit: typeof quantity.unit === 'string' ? quantity.unit.trim() : ''
        }
      };
    });

    const issues = rawIssues.map((item: any, index: number) => ({
      id: typeof item.id === 'string' ? item.id : `issue-${index + 1}`,
      code: typeof item.code === 'string' ? item.code.trim() : '',
      type: normalizeIssueType(typeof item.type === 'string' ? item.type : ''),
      severity: normalizeSeverity(typeof item.severity === 'string' ? item.severity : ''),
      message: typeof item.message === 'string' ? item.message.trim() : 'Issue detected',
      details: typeof item.details === 'string' ? item.details.trim() : undefined,
      recommendation: typeof item.recommendation === 'string' ? item.recommendation.trim() : undefined,
      sourceDocument: typeof item.sourceDocument === 'string' ? item.sourceDocument.trim() : undefined,
      resolved: Boolean(item.resolved),
      date: typeof item.date === 'string' ? item.date.trim() : undefined
    }));

    return { summary, materials, boqItems, issues };
  }, []);

  /**
   * Run batch material validation using the new MaterialValidationService
   * Processes documents one at a time, fetches web links, and uses batch API
   */
  const runBatchMaterialValidation = useCallback(async () => {
    const { documents, checks } = state.materialValidation;
    const materialDocs = documents.filter((doc) => classifyDocumentRole(doc) === 'materials');
    const boqDocs = documents.filter((doc) => classifyDocumentRole(doc) === 'boq');

    if (materialDocs.length === 0) {
      throw new Error('No material documents found. Upload at least one material schedule.');
    }

    // Clear previous results and set initial state
    dispatch({
      type: 'UPDATE_MATERIAL_VALIDATION',
      payload: {
        materials: [],
        issues: [],
        boqItems: [],
        aiSummary: 'Starting batch validation...',
        error: null
      }
    });

    // Create validation service with progress callback
    const validationService = createMaterialValidationService((progress) => {
      // Calculate overall progress percentage
      const docsWeight = progress.documentsTotal > 0 ? progress.documentsProcessed / progress.documentsTotal : 0;
      const matWeight = progress.materialsTotal > 0 ? progress.materialsProcessed / progress.materialsTotal : 0;
      const overallProgress = Math.min(90, Math.round((docsWeight * 0.7 + matWeight * 0.3) * 90));

      dispatch({ type: 'SET_PROGRESS', payload: overallProgress });
      dispatch({
        type: 'UPDATE_MATERIAL_VALIDATION',
        payload: {
          aiSummary: `${progress.phase}${progress.document ? ` - ${progress.document}` : ''}: ${progress.materialsProcessed}/${progress.materialsTotal || '...'}`
        }
      });
    });

    // Run the batch validation
    const result = await validationService.validateDocuments(materialDocs, boqDocs, checks);

    // Calculate final stats
    const errorCount = result.issues.filter(i => i.severity === 'error').length;
    const warningCount = result.issues.filter(i => i.severity === 'warning').length;

    // Update final state
    dispatch({
      type: 'UPDATE_MATERIAL_VALIDATION',
      payload: {
        materials: result.materials,
        issues: result.issues,
        boqItems: result.boqItems,
        aiSummary: result.summary,
        stats: {
          total: result.materials.length,
          validated: result.materials.length,
          warnings: warningCount,
          errors: errorCount
        }
      }
    });

    dispatch({ type: 'SET_PROGRESS', payload: 100 });
  }, [state.materialValidation, dispatch]);

  /**
   * Build generation config based on current mode and state
   */
  const buildGenerationConfig = useCallback((state: AppState, aspectRatioOverride?: ImageConfig['aspectRatio']) => {
    const usesRender3DEnhance = state.mode === 'render-3d' && state.workflow.renderMode === 'enhance';
    const usesRender3DAlter = state.mode === 'render-3d' && state.workflow.render3dSourceMode === 'alter-rendering';
    const usesRenderFormat = RENDER_FORMAT_MODES.includes(state.mode) && !usesRender3DEnhance && !usesRender3DAlter;
    const aspectRatioSource = usesRenderFormat ? state.workflow.render3d.render.aspectRatio : state.output.aspectRatio;
    const resolutionSource = usesRender3DEnhance || usesRender3DAlter
      ? '1080p'
      : usesRenderFormat
        ? state.workflow.render3d.render.resolution
        : state.output.resolution;

    // Map output settings to image config
    const aspectRatioMap: Record<string, ImageConfig['aspectRatio']> = {
      '1:1': '1:1',
      '2:3': '2:3',
      '3:2': '3:2',
      '3:4': '3:4',
      '16:9': '16:9',
      '9:16': '9:16',
      '4:3': '4:3',
      '4:5': '4:5',
      '5:4': '5:4',
      '21:9': '21:9',
    };

    const resolutionMap: Record<string, '1K' | '2K' | '4K'> = {
      '720p': '1K',
      '1080p': '2K',
      '1440p': '2K',
      '2k': '2K',
      '4k': '4K',
      'print': '4K',
    };

    return {
      imageConfig: {
        aspectRatio: aspectRatioOverride || aspectRatioMap[aspectRatioSource] || '16:9',
        imageSize: resolutionMap[resolutionSource] || '2K',
      }
    };
  }, []);

  /**
   * Get mode-specific prompt enhancement
   */
  const getModePromptPrefix = useCallback((mode: GenerationMode, renderMode = state.workflow.renderMode): string => {
    if (mode === 'render-3d') {
      if (state.workflow.render3dSourceMode === 'alter-rendering') {
        return 'Lightly adjust this existing architectural render while preserving the image: ';
      }
      if (renderMode === 'enhance') {
        return 'Enhance this existing architectural render into a hyper-realistic architectural photograph: ';
      }
      return 'Convert this 3D, Revit, BIM, or viewport screenshot into a hyper-realistic architectural render: ';
    }

    if (mode === 'render-cad') {
      return 'Convert this CAD, Revit, BIM, or drawing source into a hyper-realistic architectural visualization: ';
    }

    if (mode === 'render-sketch') {
      if (renderMode === 'concept-push') {
        return 'Create an intentionally artificial architectural concept render from this sketch: ';
      }
      return 'Transform this sketch into a photorealistic render: ';
    }

    const prefixes: Partial<Record<GenerationMode, string>> = {
      'scene-compose': 'Create a photorealistic architectural scene composition: ',
      'masterplan': 'Generate a detailed masterplan visualization: ',
      'visual-edit': 'Edit this image according to the following instructions: ',
      'angle-change': 'Reshoot this image from a new camera viewpoint: ',
      'exploded': 'Create an exploded architectural diagram: ',
      'section': 'Generate an architectural section drawing: ',
      'multi-angle': 'Generate a photorealistic architectural view: ',
      'upscale': 'Enhance and upscale this architectural image: ',
      'img-to-cad': 'Convert this image into a CAD drawing: ',
      'video': 'Generate an architectural visualization video: ',
      'material-validation': 'Analyze materials in this architectural image: ',
      'generate-text': '',
    };
    return prefixes[mode] || '';
  }, [state.workflow.render3dSourceMode, state.workflow.renderMode]);

  /**
   * Main generation function
   */
  const generate = useCallback(async (options: GenerationOptions = {}) => {
    if (!ensureServiceInitialized()) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'error',
          message: 'Please sign in to use AI generation.'
        }
      });
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
      return;
    }

    const service = getGeminiService();

    if (state.mode === 'material-validation' && state.materialValidation.documents.length === 0) {
      dispatch({
        type: 'UPDATE_MATERIAL_VALIDATION',
        payload: { error: 'Upload material schedule and BoQ documents to run validation.' }
      });
      return;
    }

    if (state.mode === 'document-translate' && !state.workflow.documentTranslate.sourceDocument) {
      dispatch({
        type: 'UPDATE_DOCUMENT_TRANSLATE',
        payload: { error: 'Please upload a document to translate.', warnings: null, xlsxStats: null }
      });
      return;
    }

    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;
    const generationTraceId = createGatewayTraceId('gen');
    const generationStartedAt = Date.now();
    setActiveGenerationTraceId(generationTraceId);

    const isMaterialValidationMode = state.mode === 'material-validation';
    let lastProgress = 0;
    let lastGenerationStage: GenerationProgressStage | null = null;
    const updateGenerationStage = (stage: GenerationProgressStage | null) => {
      if (isMaterialValidationMode) return;
      if (lastGenerationStage === stage) return;
      lastGenerationStage = stage;
      dispatch({ type: 'SET_GENERATION_STAGE', payload: stage });
    };
    const updateProgress = (value: number) => {
      if (isMaterialValidationMode) return;
      const next = Math.round(Math.min(100, Math.max(value, lastProgress)));
      if (next !== lastProgress) {
        lastProgress = next;
        dispatch({ type: 'SET_PROGRESS', payload: next });
      }
    };
    const resetImagePipelineProgress = () => {
      if (isMaterialValidationMode) return;
      lastProgress = 0;
      lastGenerationStage = null;
      dispatch({ type: 'SET_PROGRESS', payload: 0 });
      updateGenerationStage('preparing');
      updateProgress(2);
    };
    const clearGenerationRetryNotice = () => {
      dispatch({ type: 'SET_GENERATION_RETRY_NOTICE', payload: null });
    };
    const showUnsatisfactoryRetryNotice = (nextAttempt: number) => {
      if (isMaterialValidationMode) return;
      dispatch({
        type: 'SET_GENERATION_RETRY_NOTICE',
        payload: {
          reason: 'unsatisfactory-result',
          attempt: nextAttempt
        }
      });
    };
    const updateImagePipelineProgress = (progress: ImageGenerationProgress) => {
      const range = IMAGE_PIPELINE_PROGRESS_RANGES[progress.phase];
      const stage = IMAGE_PIPELINE_STAGES[progress.phase];
      updateGenerationStage(stage);
      if (!range) return;
      const [start, end] = range;
      updateProgress(start + ((end - start) * progress.progress) / 100);
    };

    clearGenerationRetryNotice();
    dispatch({ type: 'SET_GENERATING', payload: true });
    let multiAngleHistoryHandled = false;
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    updateGenerationStage('preparing');
    updateProgress(2);
    let generationPromptForLog = state.prompt?.trim() || options.prompt?.trim() || '';
    let generationLogRoute = getGenerationLogRoute(
      state.mode,
      effectiveImageGenerationModel,
      state.workflow.videoState
    );

    try {
      if (abortSignal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      const isSourceLockedMode = SOURCE_LOCKED_MODES.includes(state.mode);
      const usesConceptRenderPipeline =
        RENDER_GENERATION_PIPELINE_MODES.includes(state.mode) &&
        state.workflow.renderMode === 'concept-push';
      const usesStrictSourceFidelity =
        STRICT_SOURCE_FIDELITY_MODES.includes(state.mode) && !usesConceptRenderPipeline;
      const keepsStructuredPrompt = isSourceLockedMode || state.mode === 'upscale';
      const usesRender3DAlterSource =
        state.mode === 'render-3d' && state.workflow.render3dSourceMode === 'alter-rendering';
      const sourceImage = state.sourceImage || state.uploadedImage;
      const baseImage = usesRender3DAlterSource
        ? state.uploadedImage || sourceImage
        : isSourceLockedMode
          ? sourceImage
          : state.uploadedImage;
      const plainGenerateContextImage = state.mode === 'generate-text'
        ? getLatestPlainGenerateImage(state)
        : null;

      // Build prompt. Source-based modes always keep the structured prompt so
      // preservation constraints cannot be bypassed by a freeform prompt.
      let basePrompt = '';
      let explicitPrompt = state.prompt?.trim() || options.prompt?.trim() || '';
      if (options.prompt && explicitPrompt && needsTranslation(i18n.language)) {
        try {
          explicitPrompt = await translateToEnglish(explicitPrompt, i18n.language);
        } catch (error) {
        }
      }
      if (state.mode === 'visual-edit') {
        const visualPrompt = explicitPrompt || state.workflow.visualPrompt;
        basePrompt = generatePrompt({
          ...state,
          workflow: {
            ...state.workflow,
            visualPrompt
          }
        });
      } else if (state.mode === 'material-validation') {
        basePrompt = '';
      } else if (keepsStructuredPrompt) {
        const structuredPrompt = generatePrompt({
          ...state,
          prompt: ''
        });
        basePrompt = explicitPrompt
          ? [
              structuredPrompt,
              `Additional user request: ${explicitPrompt}`,
              'Apply the additional request only where it does not conflict with the source-preservation constraints above.'
            ].join('\n\n')
          : structuredPrompt;
      } else {
        basePrompt = explicitPrompt || generatePrompt(state);
      }

      const modePrefix = getModePromptPrefix(state.mode, state.workflow.renderMode);
      const isolatedPlainOutput = state.mode === 'generate-text' && shouldUseIsolatedAssetOutput([
        explicitPrompt,
        basePrompt,
        options.prompt || '',
        state.prompt || ''
      ].filter(Boolean).join('\n'));
      let fullPrompt = state.mode === 'material-validation'
        ? buildMaterialValidationPrompt(options.prompt)
        : [
            modePrefix + basePrompt,
            usesStrictSourceFidelity && baseImage ? SOURCE_FIDELITY_CONTRACT : ''
          ].filter(Boolean).join('\n\n');
      if (state.mode === 'generate-text') {
        fullPrompt = buildPlainGenerateConversationPrompt(fullPrompt, state.history, {
          hasContextImage: Boolean(plainGenerateContextImage),
          isLikelyFollowUp: isLikelyPlainGenerateFollowUp(explicitPrompt || basePrompt),
          wantsIsolatedAssetOutput: isolatedPlainOutput
        });
      }
      const attachmentUrls = options.attachments
        ? options.attachments.map((attachment) =>
            typeof attachment === 'string' ? attachment : attachment.dataUrl
          )
        : [];

      const primaryRatioSource = baseImage || plainGenerateContextImage || attachmentUrls.find((url) => url.startsWith('data:image/'));
      const inputAspectRatio = await resolveClosestAspectRatio(primaryRatioSource);
      const adjustAspectRatio = state.mode === 'visual-edit' && state.workflow.activeTool === 'adjust'
        ? state.workflow.visualAdjust.aspectRatio
        : 'same';
      const usesRender3DEnhanceRatio = state.mode === 'render-3d' && (
        state.workflow.renderMode === 'enhance' ||
        state.workflow.render3dSourceMode === 'alter-rendering'
      );
      const usesRenderFormatAspectRatio = RENDER_FORMAT_MODES.includes(state.mode) && !usesRender3DEnhanceRatio;
      const aspectRatioOverride = adjustAspectRatio && adjustAspectRatio !== 'same'
        ? adjustAspectRatio
        : usesRenderFormatAspectRatio
          ? undefined
        : inputAspectRatio || undefined;

      if (isSourceLockedMode && !state.sourceImage && state.uploadedImage) {
        dispatch({ type: 'SET_SOURCE_IMAGE', payload: state.uploadedImage });
      }

      // Collect images from state and attachments
      const images: ImageData[] = [];
      const attachments: AttachmentData[] = [];

      // Add uploaded image if available (skip for material validation and headshot — headshot adds its own reference images below)
      if (baseImage && state.mode !== 'material-validation' && state.mode !== 'headshot') {
        const imgData = dataUrlToImageData(baseImage);
        if (imgData) {
          images.push(imgData);
        }
      }

      if (
        state.mode === 'generate-text' &&
        !baseImage &&
        plainGenerateContextImage &&
        isLikelyPlainGenerateFollowUp(explicitPrompt || basePrompt)
      ) {
        const imgData = dataUrlToImageData(plainGenerateContextImage);
        if (imgData) {
          images.push(imgData);
        }
      }

      // Add style reference image for render-style modes if enabled
      if (
        (state.mode === 'render-3d' || state.mode === 'render-cad') &&
        state.workflow.styleReferenceEnabled &&
        state.workflow.styleReferenceImage
      ) {
        const styleImgData = dataUrlToImageData(state.workflow.styleReferenceImage);
        if (styleImgData) {
          images.push(styleImgData);
        }
      }

      // Add background reference image for render-style modes if enabled
      if (
        (state.mode === 'render-3d' || state.mode === 'render-cad') &&
        state.workflow.backgroundReferenceEnabled &&
        state.workflow.backgroundReferenceImage
      ) {
        const bgImgData = dataUrlToImageData(state.workflow.backgroundReferenceImage);
        if (bgImgData) {
          images.push(bgImgData);
        }
      }

      const sceneInsertionReferences = state.workflow.sceneInsertionReferences ?? [];
      if (state.mode === 'scene-compose' && sceneInsertionReferences.length > 0) {
        sceneInsertionReferences.forEach((reference) => {
          const referenceImage = dataUrlToImageData(reference.image);
          if (referenceImage) {
            images.push(referenceImage);
          }
        });
      }

      // Add background reference image for visual-edit background tool if enabled
      if (
        state.mode === 'visual-edit' &&
        state.workflow.activeTool === 'background' &&
        state.workflow.visualBackground.mode === 'image' &&
        state.workflow.visualBackground.referenceImage
      ) {
        const bgImgData = dataUrlToImageData(state.workflow.visualBackground.referenceImage);
        if (bgImgData) {
          images.push(bgImgData);
        }
      }

      // Add attachments
      if (options.attachments) {
        for (const attachment of options.attachments) {
          const dataUrl = typeof attachment === 'string' ? attachment : attachment.dataUrl;
          const parsed = parseDataUrl(dataUrl);
          if (!parsed) continue;
          if (parsed.mimeType.startsWith('image/')) {
            const imgData = dataUrlToImageData(dataUrl);
            if (imgData) {
              images.push(imgData);
            }
            continue;
          }
          attachments.push({
            base64: parsed.base64,
            mimeType: parsed.mimeType,
            name: typeof attachment === 'string' ? undefined : attachment.name
          });
        }
      }

      const isMultiAngleMode = state.mode === 'multi-angle';
      const isAngleChangeMode = state.mode === 'angle-change';
      const isUpscaleMode = state.mode === 'upscale';
      const isVisualEditMode = state.mode === 'visual-edit';
      const isVideoMode = state.mode === 'video';
      const isPdfCompressionMode = state.mode === 'pdf-compression';
      const isHeadshotMode = state.mode === 'headshot';

      // Add headshot reference images (front first as primary, then left, then right)
      if (isHeadshotMode) {
        const { leftImage, frontImage, rightImage } = state.workflow.headshot;
        for (const refUrl of [frontImage, leftImage, rightImage]) {
          if (refUrl) {
            const imgData = dataUrlToImageData(refUrl);
            if (imgData) images.push(imgData);
          }
        }
      }

      // Headshot aspect ratio override
      const headshotAspectRatio: ImageConfig['aspectRatio'] | undefined =
        isHeadshotMode
          ? (state.workflow.headshot.style === 'website-custom' ? '16:9' : '3:4')
          : undefined;

      generationLogRoute = getGenerationLogRoute(
        state.mode,
        effectiveImageGenerationModel,
        state.workflow.videoState
      );
      generationPromptForLog = fullPrompt;
      const generationInputSummary = {
        explicitPrompt: explicitPrompt || null,
        modePrefix: modePrefix || null,
        optionPromptProvided: Boolean(options.prompt),
        requestedImageCount: options.numberOfImages || 1,
        sourceImage: summarizeDataUrlForLog(baseImage),
        plainGenerateContextImage: summarizeDataUrlForLog(plainGenerateContextImage),
        attachmentUrls: attachmentUrls.map((url, index) => ({
          index,
          summary: summarizeDataUrlForLog(url),
        })),
        imageInputs: images.map(summarizeImageDataForLog),
        attachments: attachments.map(summarizeAttachmentForLog),
        output: {
          aspectRatio: state.output.aspectRatio,
          resolution: state.output.resolution,
        },
        workflow: {
          renderMode: state.workflow.renderMode,
          render3dSourceMode: state.workflow.render3dSourceMode,
          activeVisualTool: state.workflow.activeTool,
          upscaleMode: state.workflow.upscaleMode,
          videoInputMode: state.workflow.videoState.inputMode,
          videoModel: state.workflow.videoState.model,
          videoDuration: state.workflow.videoState.duration,
          videoResolution: state.workflow.videoState.resolution,
          videoAspectRatio: state.workflow.videoState.aspectRatio,
          headshotStyle: state.workflow.headshot.style,
        },
        historyCount: state.history.length,
      };

      queueAppLogEvent({
        traceId: generationTraceId,
        eventType: 'generation_started',
        session: true,
        status: 'started',
        mode: state.mode,
        provider: generationLogRoute.provider,
        model: generationLogRoute.model,
        action: options.numberOfImages && options.numberOfImages > 1 ? 'batch-generation' : 'generation',
        prompt: fullPrompt,
        inputSummary: generationInputSummary,
        metadata: {
          imageGenerationModel: effectiveImageGenerationModel,
          language: i18n.language,
          app: 'archviz-ai-studio',
        },
      });

      if (isPdfCompressionMode) {
        updateGenerationStage('generation');
        updateProgress(5);
        const queue = state.workflow.pdfCompression.queue;
        if (queue.length === 0) {
          dispatch({ type: 'SET_GENERATING', payload: false });
          dispatch({ type: 'SET_PROGRESS', payload: 0 });
          dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
          return;
        }

        let progressTimer: ReturnType<typeof setInterval> | null = null;
        let tickProgress = () => {};

        try {
          // Get compression settings from right panel state
          const compressionLevel = (state.workflow.pdfCompression as any).compressionLevel || 'balanced';
          const imageQuality = ((state.workflow.pdfCompression as any).imageQuality || 70) / 100;
          const stripMetadata = (state.workflow.pdfCompression as any).stripMetadata ?? true;

          let progressValue = 5;
          let progressTarget = 5;
          const clampTarget = (value: number) => Math.min(85, Math.max(progressTarget, value));
          tickProgress = () => {
            if (progressValue >= progressTarget) return;
            const delta = progressTarget - progressValue;
            const step = Math.max(1, Math.round(delta * 0.25));
            progressValue = Math.min(progressTarget, progressValue + step);
            updateProgress(progressValue);
          };
          progressTimer = setInterval(tickProgress, 250);

          // Perform REAL compression
          const results = await compressPdfBatch(
            queue,
            {
              compressionLevel,
              imageQuality,
              removeMetadata: stripMetadata,
              compressImages: true,
              preserveText: true,
              preserveVectors: true,
            },
            (current, total) => {
              const fraction = total > 0 ? (current - 0.5) / total : 0;
              progressTarget = clampTarget(10 + Math.round(fraction * 70));
            }
          );

          // Create outputs from successful compressions
          const now = Date.now();
          const outputs = results
            .filter(result => result.success)
            .map((result, index) => ({
              id: nanoid(),
              name: result.name.replace(/\.pdf$/i, '') + '-compressed.pdf',
              size: result.compressedSize,
              dataUrl: result.dataUrl, // Use the ACTUAL compressed dataUrl
              sourceId: result.id,
              compressedAt: now + index
            }));

          const latestQuota = results.reduce<{
            remainingFiles?: number;
            remainingCredits?: number;
          }>((acc, result) => {
            if (result.remainingFiles != null || result.remainingCredits != null) {
              return {
                remainingFiles: result.remainingFiles ?? acc.remainingFiles,
                remainingCredits: result.remainingCredits ?? acc.remainingCredits
              };
            }
            return acc;
          }, {
            remainingFiles: state.workflow.pdfCompression.remainingFiles,
            remainingCredits: state.workflow.pdfCompression.remainingCredits
          });

          // Update state: CLEAR queue and add outputs
          dispatch({
            type: 'UPDATE_WORKFLOW',
            payload: {
              pdfCompression: {
                ...state.workflow.pdfCompression,
                queue: [], // Clear the queue
                selectedId: outputs[0]?.id || null,
                outputs: [...state.workflow.pdfCompression.outputs, ...outputs],
                remainingFiles: latestQuota.remainingFiles,
                remainingCredits: latestQuota.remainingCredits
              }
            }
          });

          progressTarget = 90;
          tickProgress();
          if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
          }
          updateGenerationStage('complete');
          updateProgress(100);

          // Show success message
          const avgCompression = results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length;
          dispatch({
            type: 'SET_APP_ALERT',
            payload: {
              type: 'success',
              message: i18n.t('pdfCompression.alerts.success', {
                count: outputs.length,
                avg: Math.round(avgCompression)
              })
            }
          });

          queueAppLogEvent({
            traceId: generationTraceId,
            eventType: 'generation_completed',
            session: true,
            status: 'completed',
            mode: state.mode,
            provider: generationLogRoute.provider,
            model: generationLogRoute.model,
            action: 'pdf-compression',
            prompt: fullPrompt,
            durationMs: Date.now() - generationStartedAt,
            outputSummary: {
              inputCount: queue.length,
              outputCount: outputs.length,
              averageCompressionRatio: Number.isFinite(avgCompression) ? avgCompression : null,
              results: results.map((result) => ({
                id: result.id,
                name: result.name,
                success: result.success,
                originalSize: result.originalSize,
                compressedSize: result.compressedSize,
                compressionRatio: result.compressionRatio,
                error: result.error || null,
              })),
            },
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'PDF compression failed';
          queueAppLogEvent({
            traceId: generationTraceId,
            eventType: 'generation_failed',
            session: true,
            status: 'failed',
            mode: state.mode,
            provider: generationLogRoute.provider,
            model: generationLogRoute.model,
            action: 'pdf-compression',
            prompt: fullPrompt,
            durationMs: Date.now() - generationStartedAt,
            errorMessage,
          });

          // Check if it's an API configuration error
          if (errorMessage.includes('not configured') || errorMessage.includes('API key')) {
            dispatch({
              type: 'SET_APP_ALERT',
              payload: {
                type: 'error',
                message: i18n.t('pdfCompression.alerts.notConfigured')
              }
            });
          } else {
            dispatch({
              type: 'SET_APP_ALERT',
              payload: {
                type: 'error',
                message: i18n.t('pdfCompression.alerts.failed', { message: errorMessage })
              }
            });
          }
        } finally {
          if (progressTimer) {
            clearInterval(progressTimer);
          }
          dispatch({ type: 'SET_GENERATING', payload: false });
          dispatch({ type: 'SET_PROGRESS', payload: 0 });
          dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
        }
        return;
      }

      const buildImagePrompt = (prompt: string) => (
        /\b(generate|create|edit|convert|transform|model:|task:|output artifact:)\b/i.test(prompt)
          ? prompt
          : `Generate an image: ${prompt}`
      );

      const DEFAULT_MAX_RETRIES = 3;
      const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
      const IMAGE_GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

      const runWithRetry = async <T>(
        label: string,
        fn: () => Promise<T>,
        options?: { timeoutMs?: number; maxRetries?: number }
      ): Promise<T> => {
        const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
        const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }

          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([
              fn(),
              new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                  reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`));
                }, timeoutMs);
              })
            ]);
            if (timeoutId) clearTimeout(timeoutId);
            return result;
          } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            lastError = error as Error;
            if ((error as DOMException)?.name === 'AbortError' || abortSignal.aborted) {
              throw error;
            }
            const isTimeout = lastError.message?.includes('timed out');
            if (attempt < maxRetries) {
              const delay = isTimeout ? 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        throw lastError || new Error(`${label} failed after ${maxRetries + 1} attempts`);
      };
      const runAbortableWithTimeout = async <T>(
        label: string,
        timeoutMs: number,
        fn: (signal: AbortSignal) => Promise<T>
      ): Promise<T> => {
        if (abortSignal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const controller = new AbortController();
        const abortFromParent = () => controller.abort();
        abortSignal.addEventListener('abort', abortFromParent, { once: true });
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
          return await Promise.race([
            fn(controller.signal),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error(`${label} timed out after ${timeoutMs / 1000} seconds`));
              }, timeoutMs);
            })
          ]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          abortSignal.removeEventListener('abort', abortFromParent);
          if (!controller.signal.aborted) {
            controller.abort();
          }
        }
      };
      const imageGenerationRetryOptions = {
        timeoutMs: IMAGE_GENERATION_TIMEOUT_MS,
        maxRetries: 0
      };

      const runStreamedImageGeneration = async (request: {
        prompt: string;
        images?: ImageData[];
        generationConfig?: GenerationConfig;
        promptAlreadyOptimized?: boolean;
      }): Promise<GeminiResponse> => {
        updateProgress(10);
        if (abortSignal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const promptForModel = request.promptAlreadyOptimized
          ? request.prompt
          : buildImagePrompt(request.prompt);
        const promptPreparationFlags = request.promptAlreadyOptimized
          ? { promptOptimized: true, skipPromptOptimization: true }
          : {};

        if (effectiveImageGenerationModel === 'chatgpt-image-generation-2') {
          const result = await service.generateImages({
            ...request,
            prompt: promptForModel,
            imageGenerationModel: effectiveImageGenerationModel,
            ...promptPreparationFlags
          } as any);
          updateProgress(result.images.length > 0 ? 95 : 85);
          return result;
        }

        let chunkCount = 0;
        let sawImage = false;
        let text: string | null = null;
        let imagesOut: GeneratedImage[] = [];
        let optimizedPrompt: string | undefined;

        for await (const chunk of service.generateStream({
          ...request,
          prompt: promptForModel,
          model: IMAGE_MODEL,
          ...promptPreparationFlags
        } as any)) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          chunkCount += 1;
          if (typeof chunk.text === 'string') {
            text = chunk.text;
          }
          if (Array.isArray(chunk.images)) {
            imagesOut = chunk.images;
          }
          if (typeof chunk.optimizedPrompt === 'string' && chunk.optimizedPrompt.trim()) {
            optimizedPrompt = chunk.optimizedPrompt;
          }

          if (chunkCount === 1) {
            updateProgress(35);
          }

          if (!sawImage && chunk.images && chunk.images.length > 0) {
            sawImage = true;
            updateProgress(90);
          } else if (!sawImage) {
            const paced = Math.min(80, 35 + chunkCount * 5);
            updateProgress(paced);
          }
        }

        updateProgress(sawImage ? 95 : 85);
        return { text, images: imagesOut, optimizedPrompt };
      };

      const verifyImageResult = async (
        resultToVerify: GeminiResponse,
        promptForVerification: string,
        referenceImages?: ImageData[],
        originalPromptForVerification?: string
      ): Promise<ImageOutputVerificationResult | null> => {
        const finalImage = pickFinalImage(resultToVerify.images);
        if (!finalImage) return null;
        if (abortSignal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        return runAbortableWithTimeout(
          'AI output verification',
          OUTPUT_VERIFICATION_TIMEOUT_MS,
          (verificationSignal) => service.verifyImageOutput({
            prompt: resultToVerify.optimizedPrompt || promptForVerification,
            originalPrompt: originalPromptForVerification || promptForVerification,
            referenceImages,
            generatedImage: finalImage,
            threshold: OUTPUT_VERIFICATION_MIN_SCORE,
            generationConfig: {
              abortSignal: verificationSignal,
              onProgress: updateImagePipelineProgress
            }
          })
        );
      };

      const formatVerificationFailure = (
        label: string,
        verification: ImageOutputVerificationResult | null,
        attempts: number
      ) => {
        const score = verification ? `${verification.score}/100` : 'unscored';
        const issue = verification?.issues?.[0] || verification?.summary || 'The output did not match the prompt closely enough.';
        return `${label} did not pass AI output verification after ${attempts} attempts (last score ${score}). ${issue}`;
      };

      const runVerifiedImageGeneration = async (
        label: string,
        prompt: string,
        referenceImages: ImageData[] | undefined,
        generateAttempt: (promptForAttempt: string, promptAlreadyOptimized: boolean) => Promise<GeminiResponse>,
        originalPromptForVerification = prompt,
        generationRetryOptions: { timeoutMs?: number; maxRetries?: number } = imageGenerationRetryOptions
      ): Promise<GeminiResponse> => {
        let promptForAttempt = prompt;
        let lastVerification: ImageOutputVerificationResult | null = null;

        for (let attempt = 1; attempt <= OUTPUT_VERIFICATION_MAX_ATTEMPTS; attempt += 1) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          if (attempt > 1) {
            resetImagePipelineProgress();
          }
          const resultForAttempt = await runWithRetry(
            attempt === 1 ? label : `${label} verification retry ${attempt}`,
            () => generateAttempt(promptForAttempt, attempt > 1),
            generationRetryOptions
          );
          const promptUsed = resultForAttempt.optimizedPrompt || promptForAttempt;
          const verification = await verifyImageResult(
            resultForAttempt,
            promptUsed,
            referenceImages,
            originalPromptForVerification
          );
          if (!verification || verification.passed) {
            return {
              ...resultForAttempt,
              optimizedPrompt: promptUsed,
              outputVerification: verification || undefined,
              outputVerificationAttempts: attempt
            };
          }

          lastVerification = verification;
          promptForAttempt = verification.revisedPrompt?.trim() || promptUsed;
          if (attempt < OUTPUT_VERIFICATION_MAX_ATTEMPTS) {
            showUnsatisfactoryRetryNotice(attempt + 1);
          }
        }

        throw new Error(formatVerificationFailure(label, lastVerification, OUTPUT_VERIFICATION_MAX_ATTEMPTS));
      };

      const runVerifiedBatchImageGeneration = async (
        label: string,
        prompt: string,
        referenceImages: ImageData[] | undefined,
        generateAttempt: (promptForAttempt: string, promptAlreadyOptimized: boolean) => Promise<GeminiResponse>,
        originalPromptForVerification = prompt
      ): Promise<GeminiResponse> => {
        let promptForAttempt = prompt;
        let lastVerification: ImageOutputVerificationResult | null = null;

        for (let attempt = 1; attempt <= OUTPUT_VERIFICATION_MAX_ATTEMPTS; attempt += 1) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          if (attempt > 1) {
            resetImagePipelineProgress();
          }
          const resultForAttempt = await runWithRetry(
            attempt === 1 ? label : `${label} verification retry ${attempt}`,
            () => generateAttempt(promptForAttempt, attempt > 1),
            imageGenerationRetryOptions
          );
          const promptUsed = resultForAttempt.optimizedPrompt || promptForAttempt;
          const verifications = await Promise.all(
            resultForAttempt.images.map((image) =>
              runAbortableWithTimeout(
                'AI output verification',
                OUTPUT_VERIFICATION_TIMEOUT_MS,
                (verificationSignal) => service.verifyImageOutput({
                  prompt: promptUsed,
                  originalPrompt: originalPromptForVerification,
                  referenceImages,
                  generatedImage: image,
                  threshold: OUTPUT_VERIFICATION_MIN_SCORE,
                  generationConfig: {
                    abortSignal: verificationSignal,
                    onProgress: updateImagePipelineProgress
                  }
                })
              )
            )
          );

          const failed = verifications.filter((verification) => !verification.passed);
          if (resultForAttempt.images.length > 0 && failed.length === 0) {
            return {
              ...resultForAttempt,
              optimizedPrompt: promptUsed,
              outputVerification: verifications[verifications.length - 1],
              outputVerifications: verifications,
              outputVerificationAttempts: attempt
            };
          }

          lastVerification = failed.sort((a, b) => a.score - b.score)[0] || null;
          promptForAttempt = lastVerification?.revisedPrompt?.trim() || promptUsed;
          if (attempt < OUTPUT_VERIFICATION_MAX_ATTEMPTS) {
            showUnsatisfactoryRetryNotice(attempt + 1);
          }
        }

        throw new Error(formatVerificationFailure(label, lastVerification, OUTPUT_VERIFICATION_MAX_ATTEMPTS));
      };

      // Build generation config
      const generationConfig = buildGenerationConfig(state, headshotAspectRatio ?? aspectRatioOverride);
      const generationConfigWithAbort: GenerationConfig = {
        ...generationConfig,
        abortSignal,
        openAI: isolatedPlainOutput
          ? { background: 'opaque' }
          : undefined,
        onProgress: updateImagePipelineProgress
      };

      let result: GeminiResponse;
      let generationOutputSummary: Record<string, any> = {};
      const isTextOnlyMode = TEXT_ONLY_MODES.includes(state.mode);
      const hasImageSourceForPrompt = Boolean(
        baseImage ||
        plainGenerateContextImage ||
        (isHeadshotMode && images.length > 0)
      );
      const imageModelPrompt = !isTextOnlyMode && !isVideoMode && !isVisualEditMode
        ? adaptImagePromptForModel(state, fullPrompt, {
            hasSourceImage: hasImageSourceForPrompt,
            hasReferenceImages: images.length > (hasImageSourceForPrompt ? 1 : 0),
            promptKind: options.numberOfImages && options.numberOfImages > 1 ? 'batch' : 'generation'
          })
        : fullPrompt;

      // Handle different modes
      if (isTextOnlyMode) {
        if (state.mode === 'material-validation') {
          dispatch({
            type: 'UPDATE_MATERIAL_VALIDATION',
            payload: { isRunning: true, aiSummary: null, lastRunAt: Date.now(), error: null }
          });
          await runBatchMaterialValidation();
          result = { text: null, images: [] };
        } else if (state.mode === 'document-translate') {
          // Document translation mode
          const docTranslate = state.workflow.documentTranslate;

          if (!docTranslate.sourceDocument) {
            dispatch({
              type: 'UPDATE_DOCUMENT_TRANSLATE',
              payload: { error: 'Please upload a document to translate.', warnings: null, xlsxStats: null }
            });
            dispatch({ type: 'SET_GENERATING', payload: false });
            dispatch({ type: 'SET_PROGRESS', payload: 0 });
            dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
            return;
          }

          // Check if PDF converter is needed for PDF documents
        const isPdf = docTranslate.sourceDocument.mimeType.includes('pdf');
        if (isPdf) {
          const hasCustomApi = ensurePdfConverterInitialized();

          if (!hasCustomApi) {
            dispatch({
              type: 'UPDATE_DOCUMENT_TRANSLATE',
              payload: {
                error: 'PDF conversion service is unavailable. Please try again later.',
                warnings: null,
                xlsxStats: null,
              }
            });
            dispatch({ type: 'SET_GENERATING', payload: false });
            dispatch({ type: 'SET_PROGRESS', payload: 0 });
            dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
            return;
          }
          }

          // Reset state
          dispatch({
            type: 'UPDATE_DOCUMENT_TRANSLATE',
            payload: {
              error: null,
              translatedDocumentUrl: null,
              warnings: null,
              xlsxStats: null,
              progress: {
                phase: 'parsing',
                currentSegment: 0,
                totalSegments: 0,
                currentBatch: 0,
                totalBatches: 0,
              }
            }
          });

          try {
            const translationResult = await runWithRetry(
              'document translation',
              () => translateDocument({
                sourceDocument: docTranslate.sourceDocument,
                sourceLanguage: docTranslate.sourceLanguage,
                targetLanguage: docTranslate.targetLanguage,
                translateHeaders: docTranslate.translateHeaders,
                translateFootnotes: docTranslate.translateFootnotes,
                onProgress: (progress: TranslationProgress) => {
                  updateGenerationStage('generation');
                  dispatch({
                    type: 'UPDATE_DOCUMENT_TRANSLATE',
                    payload: { progress }
                  });
                  // Update global progress based on translation progress
                  const percent = progress.totalSegments > 0
                    ? Math.round((progress.currentSegment / progress.totalSegments) * 100)
                    : 0;
                  dispatch({ type: 'SET_PROGRESS', payload: percent });
                },
                abortSignal,
              }),
              { timeoutMs: 8 * 60 * 1000 }
            );

            dispatch({
              type: 'UPDATE_DOCUMENT_TRANSLATE',
              payload: {
                translatedDocumentUrl: translationResult.dataUrl,
                warnings: translationResult.warnings,
                xlsxStats: translationResult.xlsxStats,
                progress: {
                  phase: 'complete',
                  currentSegment: 0,
                  totalSegments: 0,
                  currentBatch: 0,
                  totalBatches: 0,
                }
              }
            });
          } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') {
              dispatch({
                type: 'UPDATE_DOCUMENT_TRANSLATE',
                payload: {
                  error: 'Translation cancelled.',
                  warnings: null,
                  xlsxStats: null,
                  progress: { phase: 'idle', currentSegment: 0, totalSegments: 0, currentBatch: 0, totalBatches: 0 }
                }
              });
            } else {
              dispatch({
                type: 'UPDATE_DOCUMENT_TRANSLATE',
                payload: {
                  error: error instanceof Error ? error.message : 'Translation failed.',
                  warnings: null,
                  xlsxStats: null,
                  progress: { phase: 'error', currentSegment: 0, totalSegments: 0, currentBatch: 0, totalBatches: 0 }
                }
              });
            }
          }
          result = { text: null, images: [] };
        } else {
          updateGenerationStage('generation');
          updateProgress(10);
          const textGenerationConfig = generationConfig;
          // Text-only generation (analysis modes)
          const text = await runWithRetry('text generation', () => service.generateText({
            prompt: fullPrompt || 'Analyze the provided materials and return a concise validation summary.',
            images,
            attachments,
            generationConfig: generationConfigWithAbort
          }));
          if (!text.trim()) {
            throw new Error('No text returned from Gemini. Ensure the model supports document analysis.');
          }
          result = { text, images: [] };
        }
      } else if (isMultiAngleMode) {
        updateProgress(10);
        if (abortSignal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        const wf = state.workflow;
        const count = Math.max(1, wf.multiAngleViewCount);
        const [azStart, azEnd] = wf.multiAngleAzimuthRange;
        const [elStart, elEnd] = wf.multiAngleElevationRange;
        const span = azEnd - azStart;
        const fullCircle = Math.abs(span - 360) < 0.001;
        const step = count > 1 ? (fullCircle ? span / count : span / (count - 1)) : 0;

        // Calculate angle views based on distribution mode
        const angleViews = wf.multiAngleDistribution === 'manual' && wf.multiAngleAngles.length > 0
          ? wf.multiAngleAngles.slice(0, count)
          : Array.from({ length: count }, (_, index) => {
              const t = count > 1 ? index / (count - 1) : 0.5;
              return {
                azimuth: Math.round((azStart + step * index) * 10) / 10,
                elevation: Math.round((elStart + (elEnd - elStart) * t) * 10) / 10,
              };
            });

        const outputs: Array<{ id: string; name: string; url: string }> = [];
        const imagesOut: GeneratedImage[] = [];
        const sourceForHistory = state.sourceImage ?? (isSourceLockedMode ? state.uploadedImage : null);
        const hasSourceEntry = sourceForHistory
          ? state.history.some((item) => item.thumbnail === sourceForHistory && item.settings?.kind === 'source')
          : false;
        if (sourceForHistory && !hasSourceEntry) {
          dispatch({
            type: 'ADD_HISTORY',
            payload: {
              id: nanoid(),
              timestamp: Date.now(),
              thumbnail: sourceForHistory,
              prompt: basePrompt,
              attachments: attachmentUrls,
              mode: state.mode,
              settings: { kind: 'source' }
            }
          });
        }
        const normalizeAzimuth = (value: number) => ((value % 360) + 360) % 360;
        const compassLabel = (azimuth: number) => {
          const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
          const index = Math.round(normalizeAzimuth(azimuth) / 45) % directions.length;
          return directions[index];
        };
        const facadeDescriptor = (azimuth: number) => {
          const normalized = normalizeAzimuth(azimuth);
          if (normalized < 22.5 || normalized >= 337.5) return 'front';
          if (normalized < 67.5) return 'front-right';
          if (normalized < 112.5) return 'right';
          if (normalized < 157.5) return 'back-right';
          if (normalized < 202.5) return 'back';
          if (normalized < 247.5) return 'back-left';
          if (normalized < 292.5) return 'left';
          return 'front-left';
        };

        // Build descriptions for each angle
        const angleDescriptions: string[] = [];
        for (let i = 0; i < angleViews.length; i++) {
          const view = angleViews[i];
          const azimuth = normalizeAzimuth(view.azimuth);
          const elevation = view.elevation;
          const direction = compassLabel(azimuth);

          let viewName = '';
          let cameraTransform = '';

          if (azimuth === 0) {
            viewName = 'Front';
            cameraTransform = '0-degree rotation around the Y-axis (front view)';
          } else if (azimuth === 90) {
            viewName = 'Profile (Right)';
            cameraTransform = '90-degree rotation around the Y-axis to show the right side';
          } else if (azimuth === 180) {
            viewName = 'Rear';
            cameraTransform = '180-degree rotation around the Y-axis to show the back';
          } else if (azimuth === 270) {
            viewName = 'Profile (Left)';
            cameraTransform = '270-degree rotation around the Y-axis to show the left side';
          } else {
            viewName = `Angle ${azimuth}°`;
            cameraTransform = `${azimuth}-degree rotation around the Y-axis`;
          }

          if (elevation !== 0) {
            cameraTransform += ` and ${Math.abs(elevation)}-degree tilt ${elevation > 0 ? 'down' : 'up'} on the X-axis`;
          }

          angleDescriptions.push(`Panel ${i + 1} (${viewName}): ${cameraTransform}`);
        }

        // Determine optimal grid layout for various view counts
        let gridRows = 1;
        let gridCols = count;

        if (count === 1) {
          gridRows = 1;
          gridCols = 1;
        } else if (count === 2) {
          gridRows = 1;
          gridCols = 2;
        } else if (count === 3) {
          gridRows = 1;
          gridCols = 3;
        } else if (count === 4) {
          gridRows = 2;
          gridCols = 2;
        } else if (count === 5) {
          gridRows = 2;
          gridCols = 3; // 2x3 grid with one empty slot
        } else if (count === 6) {
          gridRows = 2;
          gridCols = 3;
        } else if (count === 7) {
          gridRows = 2;
          gridCols = 4; // 2x4 grid with one empty slot
        } else if (count === 8) {
          gridRows = 2;
          gridCols = 4;
        } else if (count === 9) {
          gridRows = 3;
          gridCols = 3;
        } else if (count === 10) {
          gridRows = 2;
          gridCols = 5;
        } else if (count === 12) {
          gridRows = 3;
          gridCols = 4;
        } else {
          // For other counts, create a 2-row layout
          gridRows = 2;
          gridCols = Math.ceil(count / 2);
        }

        // Map panel numbers to letters
        const panelLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

        // Build frame descriptions with letters
        const frameDescriptions: string[] = [];
        for (let i = 0; i < angleViews.length; i++) {
          const view = angleViews[i];
          const azimuth = normalizeAzimuth(view.azimuth);
          const elevation = view.elevation;
          const letter = panelLetters[i] || `${i + 1}`;

          let frameDesc = '';
          if (azimuth === 0 && elevation === 0) {
            frameDesc = `Frame ${letter} (Front): The original view for reference.`;
          } else if (azimuth === 90 && elevation === 0) {
            frameDesc = `Frame ${letter} (Profile): A 90-degree rotation around the Y-axis to show the right side.`;
          } else if (azimuth === 180 && elevation === 0) {
            frameDesc = `Frame ${letter} (Rear): A 180-degree rotation around the Y-axis to show the back.`;
          } else if (azimuth === 270 && elevation === 0) {
            frameDesc = `Frame ${letter} (Left Profile): A 270-degree rotation around the Y-axis to show the left side.`;
          } else {
            let rotationDesc = `A ${azimuth}-degree rotation around the Y-axis`;
            if (elevation !== 0) {
              rotationDesc += ` and a ${Math.abs(elevation)}-degree tilt ${elevation > 0 ? 'down' : 'up'} on the X-axis`;
            }
            frameDesc = `Frame ${letter}: ${rotationDesc}.`;
          }
          frameDescriptions.push(frameDesc);
        }

        // Build the grid prompt using the exact structure that works
        const gridPrompt = [
          `Act as a 3D camera operator. Using the attached image as the absolute geometric reference, generate a multi-angle orthographic study of this building. Keep the internal proportions, textures, and material properties 100% consistent.`,
          ``,
          `Render a ${gridRows}x${gridCols} grid showing the following specific camera transformations:`,
          ``,
          ...frameDescriptions,
          ``,
          `Do not add text labels, letters, markings, or panel IDs such as A, B, or C. Generate clean panels without annotations.`,
          ``,
          `Lighting Instruction: Maintain a fixed global light source so that shadows shift realistically as the camera moves around the building. No hallucinations or added features.`,
          ``,
          fullPrompt ? `Additional requirements: ${fullPrompt}` : '',
        ].filter(p => p.trim()).join(' ');
        const gridPromptForModel = adaptImagePromptForModel(state, gridPrompt, {
          hasSourceImage: images.length > 0,
          hasReferenceImages: false,
          promptKind: 'grid'
        });

        updateProgress(10);

        // Use the global generation config (respects user's resolution choice)
        const gridGenerationConfig: GenerationConfig = {
          ...generationConfig,
          abortSignal,
          onProgress: updateImagePipelineProgress
        };

        // Generate the grid image
        const gridResult = await runVerifiedImageGeneration(
          'multi-angle grid',
          gridPromptForModel,
          images.length > 0 ? images : undefined,
          (promptForAttempt, promptAlreadyOptimized) => service.generateImages({
            prompt: promptForAttempt,
            images: images.length > 0 ? images : undefined,
            imageGenerationModel: effectiveImageGenerationModel,
            generationConfig: gridGenerationConfig,
            ...(promptAlreadyOptimized ? { promptOptimized: true, skipPromptOptimization: true } : {})
          } as any),
          gridPromptForModel
        );

        const gridImage = pickFinalImage(gridResult.images);
        if (!gridImage) {
          throw new Error('No grid image generated');
        }

        updateProgress(70);

        // TODO: Split the grid into individual panels
        // For now, just store the full grid
        outputs.push({
          id: nanoid(),
          name: `Multi-angle Grid (${count} views)`,
          url: gridImage.dataUrl
        });

        imagesOut.push({
          base64: gridImage.base64,
          mimeType: gridImage.mimeType,
          dataUrl: gridImage.dataUrl
        });

        dispatch({
          type: 'ADD_HISTORY',
          payload: {
            id: nanoid(),
            timestamp: Date.now(),
            thumbnail: gridImage.dataUrl,
            prompt: gridPromptForModel,
            modelPrompt: gridResult.optimizedPrompt,
            attachments: attachmentUrls,
            mode: state.mode,
            settings: withOutputVerificationSettings({
              kind: 'multi-angle',
              gridLayout: `${gridRows}x${gridCols}`
            }, gridResult)
          }
        });

        updateProgress(90);

        dispatch({ type: 'UPDATE_WORKFLOW', payload: { multiAngleOutputs: outputs } });
        result = { text: null, images: imagesOut };
        multiAngleHistoryHandled = true;
      } else if (isUpscaleMode) {
        updateProgress(10);
        const wf = state.workflow;
        const hasBatchQueue = wf.upscaleBatch.length > 0;
        const canvasUpscaleItem = !hasBatchQueue && state.uploadedImage
          ? {
              id: `canvas-${Date.now()}`,
              name: 'Canvas Image',
              status: 'queued' as const,
              url: state.uploadedImage
            }
          : null;
        const queued = hasBatchQueue
          ? wf.upscaleBatch.map((item) => ({ ...item }))
          : canvasUpscaleItem
            ? [canvasUpscaleItem]
            : [];
        const failedItems: typeof queued = []; // Track failed items to keep them in the batch
        const syncUpscaleBatch = (nextBatch: typeof queued) => {
          if (!hasBatchQueue) return;
          upscaleBatchSnapshotRef.current = nextBatch.map((item) => ({ ...item }));
          dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleBatch: [...nextBatch] } });
        };
        syncUpscaleBatch(queued);
        const completedIds = new Set(queued.filter((item) => item.status === 'done').map((item) => item.id));
        const imagesOut: GeneratedImage[] = [];

        const totalCount = queued.length;
        let processedCount = 0;

        while (queued.length > 0) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          const item = queued[0];

          // Skip items that are already in failed status (from previous runs)
          if (item.status === 'failed') {
            failedItems.push(item);
            queued.shift();
            processedCount += 1;
            const progress = Math.round((processedCount / Math.max(totalCount, 1)) * 90);
            updateProgress(progress);
            syncUpscaleBatch([...failedItems, ...queued]);
            continue;
          }

          if (item.status === 'done' && item.url) {
            const existing = dataUrlToImageData(item.url);
            if (existing) {
              imagesOut.push({
                base64: existing.base64,
                mimeType: existing.mimeType,
                dataUrl: item.url
              });
            }
            queued.shift();
            processedCount += 1;
            const progress = Math.round((processedCount / Math.max(totalCount, 1)) * 90);
            updateProgress(progress);
            syncUpscaleBatch([...failedItems, ...queued]);
            continue;
          }
          if (!item.url) {
            queued.shift();
            processedCount += 1;
            const progress = Math.round((processedCount / Math.max(totalCount, 1)) * 90);
            updateProgress(progress);
            syncUpscaleBatch([...failedItems, ...queued]);
            continue;
          }
          const currentRetryCount = item.retryCount || 0;
          queued[0] = { ...item, status: 'processing', retryCount: currentRetryCount };
          syncUpscaleBatch(queued);

          const source = dataUrlToImageData(item.url);
          if (!source) {
            queued.shift();
            processedCount += 1;
            const progress = Math.round((processedCount / Math.max(totalCount, 1)) * 90);
            updateProgress(progress);
            syncUpscaleBatch(queued);
            continue;
          }

          const itemAspectRatio = await resolveClosestAspectRatio(item.url);

          // Retry logic: up to 3 retries per image
          const MAX_RETRIES = 3;
          const REQUEST_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes timeout
          let upscaleSuccess = false;
          let lastError: Error | null = null;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              if (abortSignal.aborted) {
                throw new DOMException('Request aborted', 'AbortError');
              }

              // Update retry count in UI
              if (attempt > 0) {
                queued[0] = { ...item, status: 'processing', retryCount: attempt };
                syncUpscaleBatch(queued);
              }

              // Create a timeout-aware generation call
              const upscalePrompt = adaptImagePromptForModel(state, fullPrompt, {
                hasSourceImage: true,
                hasReferenceImages: false,
                promptKind: 'edit'
              });
              const upscaleResult = await runVerifiedImageGeneration(
                'image upscale',
                upscalePrompt,
                [source],
                (promptForAttempt, promptAlreadyOptimized) => service.generateImages({
                  prompt: promptForAttempt,
                  images: [source],
                  imageGenerationModel: effectiveImageGenerationModel,
                  generationConfig: {
                    ...buildGenerationConfig(state, itemAspectRatio || inputAspectRatio || undefined),
                    abortSignal,
                    onProgress: updateImagePipelineProgress
                  },
                  ...(promptAlreadyOptimized ? { promptOptimized: true, skipPromptOptimization: true } : {})
                } as any),
                upscalePrompt,
                { timeoutMs: REQUEST_TIMEOUT_MS, maxRetries: 0 }
              );

              const finalUpscaleImage = pickFinalImage(upscaleResult.images);
              if (finalUpscaleImage) {
                const outputUrl = finalUpscaleImage.dataUrl;
                queued[0] = { ...item, status: 'done', url: outputUrl, retryCount: attempt };
                imagesOut.push({
                  base64: finalUpscaleImage.base64,
                  mimeType: finalUpscaleImage.mimeType,
                  dataUrl: outputUrl
                });

                dispatch({ type: 'SET_IMAGE', payload: outputUrl });
                dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
                dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });

                if (!completedIds.has(item.id)) {
                  dispatch({
                    type: 'ADD_HISTORY',
                    payload: {
                      id: nanoid(),
                      timestamp: Date.now(),
                      thumbnail: outputUrl,
                      prompt: basePrompt,
                      modelPrompt: upscaleResult.optimizedPrompt,
                      attachments: attachmentUrls,
                      mode: state.mode,
                      settings: withOutputVerificationSettings(undefined, upscaleResult)
                    }
                  });
                  completedIds.add(item.id);
                }
                upscaleSuccess = true;
                break; // Success, exit retry loop
              } else {
                // No image returned but no error - treat as success with no output
                queued[0] = { ...item, status: 'done', retryCount: attempt };
                upscaleSuccess = true;
                break;
              }
            } catch (error) {
              lastError = error as Error;

              // Don't retry user-initiated abort errors
              if ((error as DOMException)?.name === 'AbortError') {
                throw error;
              }
              if (lastError.message?.includes('AI output verification')) {
                break;
              }

              const isTimeout = lastError.message?.includes('timed out');
              // If we have more retries left, wait before retrying
              // Shorter delay for timeouts since we already waited
              if (attempt < MAX_RETRIES) {
                const delay = isTimeout ? 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }

          // If all retries failed, mark as failed and keep in batch so user can retry
          if (!upscaleSuccess) {
            const errorMessage = lastError?.message || 'Upscale failed after multiple attempts';
            const failedItem = {
              ...item,
              status: 'failed' as const,
              retryCount: MAX_RETRIES + 1,
              error: errorMessage
            };

            // Add to failed items to keep in batch
            failedItems.push(failedItem);

            // Show alert for the failed image but continue processing
            dispatch({
              type: 'SET_APP_ALERT',
              payload: {
                id: nanoid(),
                tone: 'warning',
                message: hasBatchQueue
                  ? `Failed to upscale "${item.name}" after ${MAX_RETRIES + 1} attempts. Image kept in queue for retry.`
                  : `Failed to upscale the current canvas image after ${MAX_RETRIES + 1} attempts.`
              }
            });
          }

          queued.shift();
          processedCount += 1;
          const progress = Math.round((processedCount / Math.max(totalCount, 1)) * 90);
          updateProgress(progress);
          syncUpscaleBatch([...failedItems, ...queued]);
        }

        upscaleBatchSnapshotRef.current = null;
        result = { text: null, images: imagesOut };
      } else if (isVisualEditMode) {
        updateProgress(10);
        if (abortSignal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        const sourceImageUrl = state.uploadedImage;
        const sourceImage = sourceImageUrl ? dataUrlToImageData(sourceImageUrl) : null;
        if (!sourceImage) {
          throw new Error('No source image available for visual edit.');
        }
        const activeVisualTool = state.workflow.activeTool;
        const selectedMaskDataUrl = state.workflow.visualSelectionMask;
        const shouldUseSelectionMask = Boolean(selectedMaskDataUrl) &&
          activeVisualTool !== 'extend' &&
          !(activeVisualTool === 'adjust' && state.workflow.visualAdjust.aspectRatio !== 'same');
        const editOutsideSelection = activeVisualTool === 'background';
        const maskMode = getVisualMaskMode(activeVisualTool, shouldUseSelectionMask, editOutsideSelection);
        const effectiveFeatherAmount = state.workflow.visualSelection.featherEnabled
          ? state.workflow.visualSelection.featherAmount
          : 35;
        const guidanceMaskDataUrl = shouldUseSelectionMask && selectedMaskDataUrl && maskMode === 'guided'
          ? await createGuidanceMaskDataUrl(selectedMaskDataUrl, effectiveFeatherAmount)
          : selectedMaskDataUrl;
        const editableMaskDataUrl = shouldUseSelectionMask && guidanceMaskDataUrl
          ? await createEditableMaskDataUrl(
              guidanceMaskDataUrl,
              editOutsideSelection,
              effectiveImageGenerationModel === 'chatgpt-image-generation-2' && maskMode === 'strict'
            )
          : null;
        const maskImage = editableMaskDataUrl
          ? dataUrlToImageData(editableMaskDataUrl)
          : null;
        const localSelectionMaskDataUrl = shouldUseSelectionMask ? guidanceMaskDataUrl : null;
        let visualMaskHandledLocally = false;

        const editTypeMap: Record<string, ImageEditRequest['editType']> = {
          select: 'inpaint',
          material: 'style-transfer',
          lighting: 'enhance',
          object: 'replace',
          sky: 'replace',
          remove: 'remove',
          replace: 'replace',
          adjust: 'enhance',
          extend: 'outpaint',
          people: 'people',
        };
        const editType = editTypeMap[activeVisualTool] || 'replace';
        const visualMaterial = state.workflow.visualMaterial;
        const isMaterialReferenceMode = Boolean(
          activeVisualTool === 'material' &&
          visualMaterial.referenceEnabled
        );
        const materialReference = activeVisualTool === 'material' && !isMaterialReferenceMode
          ? getMaterialById(visualMaterial.materialId)
          : null;
        const materialReferenceImage = isMaterialReferenceMode && visualMaterial.referenceImage
          ? dataUrlToImageData(visualMaterial.referenceImage)
          : materialReference
            ? await materialPreviewToImageData(
                materialReference.referenceUrl || materialReference.previewUrl,
                materialReference.fallbackPreviewUrl
              )
            : null;

        const adjust = state.workflow.visualAdjust;
        const hasAdjustGeometryChange = activeVisualTool === 'adjust' && (
          adjust.aspectRatio !== 'same' ||
          adjust.transformRotate !== 0 ||
          adjust.transformHorizontal !== 0 ||
          adjust.transformVertical !== 0 ||
          adjust.transformDistortion !== 0 ||
          adjust.transformPerspective !== 0
        );

        if (activeVisualTool === 'adjust' && !hasAdjustGeometryChange) {
          const adjustedImage = await applyVisualPostProduction(
            sourceImageUrl!,
            adjust,
            localSelectionMaskDataUrl
          );
          result = { text: null, images: [adjustedImage] };
          visualMaskHandledLocally = shouldUseSelectionMask;
          updateProgress(90);
        } else {
          const editReferenceImages = [
            sourceImage,
            ...(maskImage ? [maskImage] : []),
            ...(materialReferenceImage ? [materialReferenceImage] : [])
          ];
          result = await runVerifiedImageGeneration(
            'image edit',
            basePrompt,
            editReferenceImages,
            (promptForAttempt) => service.editImage({
              sourceImage,
              maskImage: maskImage || undefined,
              maskMode,
              referenceImages: materialReferenceImage ? [materialReferenceImage] : undefined,
              prompt: promptForAttempt,
              editType,
              activeTool: activeVisualTool,
              imageGenerationModel: effectiveImageGenerationModel,
              generationConfig: generationConfigWithAbort
            }),
            basePrompt
          );
        }

        if (!visualMaskHandledLocally && shouldUseSelectionMask && maskMode === 'strict' && selectedMaskDataUrl && result.images?.length) {
          result = {
            ...result,
            images: await Promise.all(
              result.images.map((image) =>
                compositeVisualEditResult(sourceImageUrl!, image, selectedMaskDataUrl, editOutsideSelection)
              )
            )
          };
        }
      } else if (isVideoMode) {
        updateProgress(10);
        const videoState = state.workflow.videoState;
        const videoService = getVideoGenerationService();
        // Prepare input image for image-animate mode
        // Prefer videoState.videoInputImage, fall back to global uploadedImage
        let inputImage: ImageData | undefined;
        if (videoState.inputMode === 'image-animate') {
          const src = videoState.videoInputImage || state.uploadedImage;
          if (src) {
            const converted = dataUrlToImageData(src);
            if (converted) {
              inputImage = { ...converted, dataUrl: src };
            }
          }
        }

        // Prepare start/end frames for Veo interpolation (image-morph mode)
        let startFrame: ImageData | undefined;
        let endFrame: ImageData | undefined;
        if (videoState.inputMode === 'image-morph' && videoState.model === 'veo-3.1-generate-preview') {
          if (videoState.startFrame) {
            const sf = dataUrlToImageData(videoState.startFrame);
            if (sf) startFrame = { ...sf, dataUrl: videoState.startFrame };
          }
          if (videoState.endFrame) {
            const ef = dataUrlToImageData(videoState.endFrame);
            if (ef) endFrame = { ...ef, dataUrl: videoState.endFrame };
          }
        }

        // Prepare keyframes for multi-frame modes
        let keyframes: ImageData[] | undefined;
        if (videoState.inputMode !== 'image-animate' && videoState.inputMode !== 'image-morph' && videoState.keyframes.length > 0) {
          keyframes = videoState.keyframes
            .map((kf) => dataUrlToImageData(kf.url))
            .filter((img): img is ImageData => img !== null);
        }

        // Progress callback for video generation
        const onVideoProgress = (progress: VideoGenerationProgress) => {
          updateGenerationStage(progress.progress >= 92 ? 'transfer' : 'generation');
          dispatch({
            type: 'UPDATE_VIDEO_STATE',
            payload: { generationProgress: progress }
          });
          updateProgress(progress.progress);
        };

        // Assign a fresh random seed for this generation (unless the seed is locked)
        const activeSeed = videoState.seedLocked
          ? videoState.seed
          : (() => {
              const newSeed = Math.floor(Math.random() * 2147483647);
              dispatch({ type: 'UPDATE_VIDEO_STATE', payload: { seed: newSeed } });
              return newSeed;
            })();

        try {
          const videoResult = await runWithRetry(
            'video generation',
            () => videoService.generateVideo({
              model: 'veo-3.1-generate-preview',
              prompt: fullPrompt,
              inputImage,
              startFrame,
              endFrame,
              duration: videoState.duration,
              resolution: videoState.resolution,
              fps: 30,
              aspectRatio: videoState.aspectRatio,
              motionAmount: 5,
              camera: videoState.camera,
              quality: 'standard',
              transitionEffect: 'none',
              seed: activeSeed,
              generateAudio: videoState.generateAudio,
              personGeneration: videoState.personGeneration,
              negativePrompt: videoState.negativePrompt || undefined,
              klingProvider: 'piapi',
              onProgress: onVideoProgress,
              abortSignal
            }),
            { timeoutMs: 10 * 60 * 1000, maxRetries: 0 }
          );
          // Store result in video state
          dispatch({
            type: 'UPDATE_VIDEO_STATE',
            payload: {
              generatedVideoUrl: videoResult.videoUrl,
              generationProgress: {
                phase: 'complete',
                progress: 100,
                message: 'Video generation complete!',
                videoUrl: videoResult.videoUrl
              },
              generationHistory: [
                ...videoState.generationHistory,
                {
                  id: nanoid(),
                  url: videoResult.videoUrl,
                  thumbnail: videoResult.thumbnailUrl || videoResult.videoUrl,
                  timestamp: Date.now(),
                  settings: { ...videoState }
                }
              ].slice(-10) // Keep last 10
            }
          });

          // Also set as uploaded image for canvas display compatibility
          dispatch({ type: 'SET_IMAGE', payload: videoResult.videoUrl });
          generationOutputSummary = {
            videoUrlKind: videoResult.videoUrl.startsWith('blob:') ? 'blob' : 'remote',
            thumbnailUrlPresent: Boolean(videoResult.thumbnailUrl),
            model: videoResult.model,
            expiresAt: videoResult.expiresAt?.toISOString?.() || null,
          };

          // Return empty result to skip normal image handling
          result = { text: null, images: [] };
        } catch (videoError) {
          // Handle video generation errors
          const errorMessage = videoError instanceof Error ? videoError.message : 'Video generation failed';

          // Show user-friendly error notification
          dispatch({
            type: 'SET_APP_ALERT',
            payload: {
              id: nanoid(),
              tone: 'error',
              message: errorMessage
            }
          });

          dispatch({
            type: 'UPDATE_VIDEO_STATE',
            payload: {
              generationProgress: {
                phase: 'error',
                progress: 0,
                message: errorMessage
              }
            }
          });
          throw videoError;
        }
      } else if (options.numberOfImages && options.numberOfImages > 1) {
        updateProgress(10);
        // Batch image generation
        const batchResult = await runVerifiedBatchImageGeneration(
          'batch image generation',
          imageModelPrompt,
          images.length > 0 ? images : undefined,
          (promptForAttempt, promptAlreadyOptimized) => service.generateBatchImages({
            prompt: promptForAttempt,
            referenceImages: images.length > 0 ? images : undefined,
            numberOfImages: options.numberOfImages,
            imageConfig: generationConfig.imageConfig,
            openAI: generationConfigWithAbort.openAI,
            imageGenerationModel: effectiveImageGenerationModel,
            abortSignal,
            onProgress: updateImagePipelineProgress,
            promptAlreadyOptimized
          }),
          imageModelPrompt
        );
        result = {
          text: batchResult.text,
          images: batchResult.images,
          optimizedPrompt: batchResult.optimizedPrompt,
          outputVerification: batchResult.outputVerification,
          outputVerifications: batchResult.outputVerifications,
          outputVerificationAttempts: batchResult.outputVerificationAttempts
        };
      } else {
        // Standard image generation
        result = await runVerifiedImageGeneration(
          'image generation',
          imageModelPrompt,
          images.length > 0 ? images : undefined,
          (promptForAttempt, promptAlreadyOptimized) => runStreamedImageGeneration({
            prompt: promptForAttempt,
            images: images.length > 0 ? images : undefined,
            generationConfig: generationConfigWithAbort,
            promptAlreadyOptimized
          }),
          imageModelPrompt
        );
      }
      updateProgress(95);

      // Process result
      if (result.images && result.images.length > 0 && !isUpscaleMode && !multiAngleHistoryHandled) {
        const sourceForHistory = state.sourceImage ?? (isSourceLockedMode ? state.uploadedImage : null);
        const hasSourceEntry = sourceForHistory
          ? state.history.some((item) => item.thumbnail === sourceForHistory && item.settings?.kind === 'source')
          : false;

        if (sourceForHistory && !hasSourceEntry) {
              dispatch({
                type: 'ADD_HISTORY',
                payload: {
                  id: nanoid(),
                  timestamp: Date.now(),
                  thumbnail: sourceForHistory,
                  prompt: basePrompt,
                  attachments: attachmentUrls,
                  mode: state.mode,
                  settings: { kind: 'source' }
                }
              });
            }

        // Use the final image part as the main image. Gemini 3 image models can
        // emit interim image parts before the finished render.
        const generatedImageUrl = pickFinalImage(result.images)?.dataUrl || result.images[0].dataUrl;
        dispatch({ type: 'SET_IMAGE', payload: generatedImageUrl });
        dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
        dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
        suggestAiSlopUpscalerIfNeeded(result, state.mode, state.workflow.upscaleMode);

        if (isVisualEditMode) {
          dispatch({
            type: 'UPDATE_WORKFLOW',
            payload: {
              visualSelections: [],
              visualSelectionUndoStack: [],
              visualSelectionRedoStack: [],
              visualSelectionMask: null,
              visualSelectionMaskSize: null,
              visualSelectionViewScale: null,
              visualSelectionComposite: null,
              visualSelectionCompositeSize: null,
            }
          });
        }

        if (isAngleChangeMode) {
          const angleDeg = Math.max(-90, Math.min(90, Math.round(state.workflow.angleChangeDegrees)));
          const tiltDeg = Math.max(-30, Math.min(30, Math.round(state.workflow.angleChangePitch)));
          const angleLabel = Math.abs(angleDeg) < 3
            ? 'Original Angle'
            : `${Math.abs(angleDeg)}° ${angleDeg < 0 ? 'Left' : 'Right'} Angle`;
          const tiltLabel = Math.abs(tiltDeg) < 3
            ? 'Level Tilt'
            : `${Math.abs(tiltDeg)}° Tilt ${tiltDeg > 0 ? 'Up' : 'Down'}`;

          dispatch({
            type: 'UPDATE_WORKFLOW',
            payload: {
              angleChangeOutputs: [
                {
                  id: nanoid(),
                  name: `${angleLabel} · ${tiltLabel}`,
                  url: generatedImageUrl,
                  rotation: angleDeg,
                  pitch: tiltDeg,
                  createdAt: Date.now()
                },
                ...state.workflow.angleChangeOutputs
              ].slice(0, 24)
            }
          });
        }

        // Add to history
        dispatch({
          type: 'ADD_HISTORY',
          payload: {
            id: nanoid(),
            timestamp: Date.now(),
            thumbnail: generatedImageUrl,
            prompt: basePrompt,
            modelPrompt: result.optimizedPrompt,
            attachments: attachmentUrls,
            mode: state.mode,
            settings: withOutputVerificationSettings(isAngleChangeMode
              ? {
                  kind: 'angle-change',
                  angleDeg: state.workflow.angleChangeDegrees,
                  tiltDeg: state.workflow.angleChangePitch
                }
              : undefined, result)
          }
        });

        // If multiple images were generated, we could store them elsewhere
        // For now, the first one is the main result

        // Store headshot results in workflow state
        if (isHeadshotMode) {
          const newItems = result.images.map(img => ({
            id: nanoid(),
            url: img.dataUrl || '',
            style: state.workflow.headshot.style,
            colorMode: state.workflow.headshot.colorMode,
            createdAt: Date.now(),
          })).filter(item => item.url);
          if (newItems.length > 0) {
            dispatch({
              type: 'UPDATE_WORKFLOW',
              payload: {
                headshot: {
                  ...state.workflow.headshot,
                  generatedItems: [...state.workflow.headshot.generatedItems, ...newItems],
                }
              }
            });
          }
        }
      } else if (result.text) {
        // Text-only result - add as chat message if in text mode
        if (state.mode === 'generate-text') {
          dispatch({
            type: 'ADD_CHAT_MESSAGE',
            payload: {
              id: nanoid(),
              role: 'assistant',
              content: result.text,
              type: 'text',
              timestamp: Date.now()
            }
          });
        } else if (state.mode === 'material-validation') {
          try {
            const parsed = normalizeMaterialValidationResult(result.text);
            const issuesByCode = new Map<string, { hasError: boolean; hasWarning: boolean }>();

            parsed.issues.forEach((issue) => {
              if (!issue.code) return;
              const entry = issuesByCode.get(issue.code) || { hasError: false, hasWarning: false };
              if (issue.severity === 'error') entry.hasError = true;
              if (issue.severity === 'warning') entry.hasWarning = true;
              issuesByCode.set(issue.code, entry);
            });

            let errorCount = 0;
            let warningCount = 0;
            parsed.materials.forEach((material) => {
              const entry = issuesByCode.get(material.code);
              if (entry?.hasError) {
                errorCount += 1;
              } else if (entry?.hasWarning) {
                warningCount += 1;
              }
            });

            dispatch({
              type: 'UPDATE_MATERIAL_VALIDATION',
              payload: {
                aiSummary: parsed.summary || result.text,
                materials: parsed.materials,
                boqItems: parsed.boqItems,
                issues: parsed.issues,
                stats: {
                  total: parsed.materials.length,
                  validated: parsed.materials.length,
                  warnings: warningCount,
                  errors: errorCount
                },
                isRunning: false,
                error: null
              }
            });
          } catch (parseError) {
            dispatch({
              type: 'UPDATE_MATERIAL_VALIDATION',
              payload: {
                aiSummary: result.text,
                isRunning: false,
                error: parseError instanceof Error ? parseError.message : 'Failed to parse validation response.'
              }
            });
          }
        }
      }

      if (state.mode === 'material-validation') {
        dispatch({
          type: 'UPDATE_MATERIAL_VALIDATION',
          payload: { isRunning: false }
        });
      }

      updateGenerationStage('complete');
      updateProgress(100);
      queueAppLogEvent({
        traceId: generationTraceId,
        eventType: 'generation_completed',
        session: true,
        status: 'completed',
        mode: state.mode,
        provider: generationLogRoute.provider,
        model: generationLogRoute.model,
        action: options.numberOfImages && options.numberOfImages > 1 ? 'batch-generation' : 'generation',
        prompt: fullPrompt,
        durationMs: Date.now() - generationStartedAt,
        outputSummary: {
          ...generationOutputSummary,
          imageCount: result.images?.length || 0,
          textChars: result.text?.length || 0,
          optimizedPromptChars: result.optimizedPrompt?.length || 0,
          outputVerificationAttempts: result.outputVerificationAttempts || null,
          outputVerification: result.outputVerification
            ? {
                score: result.outputVerification.score,
                passed: result.outputVerification.passed,
                summary: result.outputVerification.summary,
                issues: result.outputVerification.issues,
                aiSlopDetected: result.outputVerification.aiSlopDetected || false,
                aiSlopConfidence: result.outputVerification.aiSlopConfidence || null,
              }
            : null,
          outputVerifications: result.outputVerifications?.map((verification) => ({
            score: verification.score,
            passed: verification.passed,
            summary: verification.summary,
            issues: verification.issues,
            aiSlopDetected: verification.aiSlopDetected || false,
            aiSlopConfidence: verification.aiSlopConfidence || null,
          })) || null,
        },
      });
      clearGenerationRetryNotice();
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: 0 });
      dispatch({ type: 'SET_GENERATION_STAGE', payload: null });

    } catch (error) {
      const resetUpscaleProcessing = () => {
        if (state.mode !== 'upscale') return;
        const snapshot = upscaleBatchSnapshotRef.current ?? state.workflow.upscaleBatch;
        if (!snapshot || snapshot.length === 0) return;
        const resetBatch = snapshot.map((item) =>
          item.status === 'processing' ? { ...item, status: 'queued' } : item
        );
        upscaleBatchSnapshotRef.current = resetBatch.map((item) => ({ ...item }));
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleBatch: resetBatch } });
      };

      if ((error as DOMException)?.name === 'AbortError') {
        resetUpscaleProcessing();
        queueAppLogEvent({
          traceId: generationTraceId,
          eventType: 'generation_cancelled',
          session: true,
          status: 'cancelled',
          mode: state.mode,
          provider: generationLogRoute.provider,
          model: generationLogRoute.model,
          action: 'generation',
          prompt: generationPromptForLog,
          durationMs: Date.now() - generationStartedAt,
          errorMessage: 'Generation cancelled.',
        });
        if (state.mode === 'material-validation') {
          dispatch({
            type: 'UPDATE_MATERIAL_VALIDATION',
            payload: { isRunning: false, error: 'Validation canceled.' }
          });
        }
        clearGenerationRetryNotice();
        dispatch({ type: 'SET_GENERATING', payload: false });
        dispatch({ type: 'SET_PROGRESS', payload: 0 });
        dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
        return;
      }
      resetUpscaleProcessing();
      const errorMessage = error instanceof Error ? error.message : '';
      queueAppLogEvent({
        traceId: generationTraceId,
        eventType: 'generation_failed',
        session: true,
        status: 'failed',
        mode: state.mode,
        provider: generationLogRoute.provider,
        model: generationLogRoute.model,
        action: 'generation',
        prompt: generationPromptForLog,
        durationMs: Date.now() - generationStartedAt,
        errorMessage: errorMessage || 'Generation failed.',
        metadata: {
          errorName: error instanceof Error ? error.name : null,
        },
      });
      const isImageMode = !TEXT_ONLY_MODES.includes(state.mode);
      const isServiceUnavailable = isImageMode && isTemporaryAiServiceFailure(error, errorMessage);
      if (isServiceUnavailable) {
        const providerName = effectiveImageGenerationModel === 'chatgpt-image-generation-2'
          ? 'ChatGPT Image Generation 2'
          : 'Nano Banana Pro';
        dispatch({
          type: 'SET_APP_ALERT',
          payload: {
            id: nanoid(),
            tone: 'warning',
            title: `${providerName} is currently unavailable`,
            message: getTemporaryAiServiceAlertMessage(error, errorMessage)
          }
        });
      }
      if (!isServiceUnavailable) {
        const message = errorMessage || 'Generation failed. Please try again.';
        dispatch({
          type: 'SET_APP_ALERT',
          payload: {
            id: nanoid(),
            tone: 'error',
            message
          }
        });
      }
      if (state.mode === 'material-validation') {
        dispatch({
          type: 'UPDATE_MATERIAL_VALIDATION',
          payload: {
            isRunning: false,
            error: error instanceof Error ? error.message : 'Validation failed.'
          }
        });
      }
      clearGenerationRetryNotice();
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: 0 });
      dispatch({ type: 'SET_GENERATION_STAGE', payload: null });

      // Could dispatch an error action here
      // dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      setActiveGenerationTraceId(null);
    }
  }, [
    state,
    dispatch,
    dataUrlToImageData,
    parseDataUrl,
    buildMaterialValidationPrompt,
    normalizeMaterialValidationResult,
    buildGenerationConfig,
    getModePromptPrefix
  ]);

  /**
   * Generate using only state (no custom options)
   */
  const generateFromState = useCallback(async () => {
    return generate();
  }, [generate]);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (state.mode === 'material-validation') {
      dispatch({
        type: 'UPDATE_MATERIAL_VALIDATION',
        payload: { isRunning: false, error: 'Validation canceled.' }
      });
    }
    if (state.mode === 'document-translate') {
      dispatch({
        type: 'UPDATE_DOCUMENT_TRANSLATE',
        payload: {
          error: 'Translation cancelled.',
          warnings: null,
          xlsxStats: null,
          progress: { phase: 'idle', currentSegment: 0, totalSegments: 0, currentBatch: 0, totalBatches: 0 }
        }
      });
    }
    dispatch({ type: 'SET_GENERATING', payload: false });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    dispatch({ type: 'SET_GENERATION_STAGE', payload: null });
    dispatch({ type: 'SET_GENERATION_RETRY_NOTICE', payload: null });
  }, [dispatch, state.mode]);

  return {
    generate,
    generateFromState,
    cancelGeneration,
    isReady,
    setApiKey
  };
}

export default useGeneration;
