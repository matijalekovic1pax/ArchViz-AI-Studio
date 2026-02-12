/**
 * Generation Hook
 * Wires Gemini API service with app state for all generation features
 */

import { useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { generatePrompt } from '../engine/promptEngine';
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
  ImageConfig
} from '../services/geminiService';
import { getVideoGenerationService } from '../services/videoGenerationService';
import { classifyDocumentRole } from '../services/materialValidationPipeline';
import { createMaterialValidationService } from '../services/materialValidationService';
import { translateToEnglish, needsTranslation } from '../services/translationService';
import { translateDocument } from '../services/documentTranslationService';
import { isGatewayAuthenticated } from '../services/apiGateway';
import { isConvertApiConfigured } from '../services/convertApiService';
import { initializeILoveApi, isILoveApiConfigured } from '../services/iLoveApiService';
import { compressPdfBatch } from '../lib/pdfCompression';
import { nanoid } from 'nanoid';
import type { AppState, GenerationMode, TranslationProgress, VideoGenerationProgress } from '../types';

const TEXT_ONLY_MODES: GenerationMode[] = ['material-validation', 'document-translate'];

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
    const { output } = state;

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
      '8k': '4K',
    };

    return {
      imageConfig: {
        aspectRatio: aspectRatioOverride || aspectRatioMap[output.aspectRatio] || '16:9',
        imageSize: resolutionMap[output.resolution] || '2K',
      }
    };
  }, []);

  /**
   * Get mode-specific prompt enhancement
   */
  const getModePromptPrefix = useCallback((mode: GenerationMode): string => {
    const prefixes: Partial<Record<GenerationMode, string>> = {
      'render-3d': 'Create a photorealistic architectural render: ',
      'render-cad': 'Transform this CAD drawing into a photorealistic visualization: ',
      'masterplan': 'Generate a detailed masterplan visualization: ',
      'visual-edit': 'Edit this image according to the following instructions: ',
      'exploded': 'Create an exploded architectural diagram: ',
      'section': 'Generate an architectural section drawing: ',
      'render-sketch': 'Transform this sketch into a photorealistic render: ',
      'multi-angle': 'Generate a photorealistic architectural view: ',
      'upscale': 'Enhance and upscale this architectural image: ',
      'img-to-cad': 'Convert this image into a CAD drawing: ',
      'img-to-3d': 'Generate 3D model visualization from this image: ',
      'video': 'Generate an architectural visualization video: ',
      'material-validation': 'Analyze materials in this architectural image: ',
      'generate-text': '',
    };
    return prefixes[mode] || '';
  }, []);

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
        payload: { error: 'Please upload a document to translate.' }
      });
      return;
    }

    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const isMaterialValidationMode = state.mode === 'material-validation';
    let lastProgress = 0;
    const updateProgress = (value: number) => {
      if (isMaterialValidationMode) return;
      const next = Math.min(100, Math.max(value, lastProgress));
      if (next !== lastProgress) {
        lastProgress = next;
        dispatch({ type: 'SET_PROGRESS', payload: next });
      }
    };

    dispatch({ type: 'SET_GENERATING', payload: true });
    let multiAngleHistoryHandled = false;
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    updateProgress(2);

    try {
      if (abortSignal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      // Build prompt from state or use provided prompt
      let basePrompt = options.prompt || (
        state.mode === 'material-validation'
          ? ''
          : generatePrompt(state)
      );

      // Translate user-entered prompts to English if needed
      // Note: Generated prompts from promptEngine are already in English
      if (options.prompt && needsTranslation(i18n.language)) {
        try {
          basePrompt = await translateToEnglish(basePrompt, i18n.language);
        } catch (error) {
        }
      }

      const modePrefix = getModePromptPrefix(state.mode);
      const fullPrompt = state.mode === 'material-validation'
        ? buildMaterialValidationPrompt(options.prompt)
        : modePrefix + basePrompt;
      const attachmentUrls = options.attachments
        ? options.attachments.map((attachment) =>
            typeof attachment === 'string' ? attachment : attachment.dataUrl
          )
        : [];

      const sourceLockedModes: GenerationMode[] = [
        'render-3d',
        'render-cad',
        'render-sketch',
        'masterplan',
        'exploded',
        'section',
        'multi-angle',
        'img-to-cad'
      ];
      const isSourceLockedMode = sourceLockedModes.includes(state.mode);
      const sourceImage = state.sourceImage || state.uploadedImage;
      const baseImage = isSourceLockedMode ? sourceImage : state.uploadedImage;
      const primaryRatioSource = baseImage || attachmentUrls.find((url) => url.startsWith('data:image/'));
      const inputAspectRatio = await resolveClosestAspectRatio(primaryRatioSource);
      const adjustAspectRatio = state.mode === 'visual-edit' && state.workflow.activeTool === 'adjust'
        ? state.workflow.visualAdjust.aspectRatio
        : 'same';
      const aspectRatioOverride = adjustAspectRatio && adjustAspectRatio !== 'same'
        ? adjustAspectRatio
        : inputAspectRatio || undefined;

      if (isSourceLockedMode && !state.sourceImage && state.uploadedImage) {
        dispatch({ type: 'SET_SOURCE_IMAGE', payload: state.uploadedImage });
      }

      // Collect images from state and attachments
      const images: ImageData[] = [];
      const attachments: AttachmentData[] = [];

      // Add uploaded image if available (skip for material validation)
      if (baseImage && state.mode !== 'material-validation') {
        const imgData = dataUrlToImageData(baseImage);
        if (imgData) {
          images.push(imgData);
        }
      }

      // Add background reference image for render-3d and render-cad modes if enabled
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
      const isUpscaleMode = state.mode === 'upscale';
      const isVisualEditMode = state.mode === 'visual-edit';
      const isVideoMode = state.mode === 'video';
      const isPdfCompressionMode = state.mode === 'pdf-compression';

      if (isPdfCompressionMode) {
        updateProgress(5);
        const queue = state.workflow.pdfCompression.queue;
        if (queue.length === 0) {
          dispatch({ type: 'SET_GENERATING', payload: false });
          dispatch({ type: 'SET_PROGRESS', payload: 0 });
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

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'PDF compression failed';

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
        }
        return;
      }

      const buildImagePrompt = (prompt: string) => (
        prompt.includes('generate') || prompt.includes('create')
          ? prompt
          : `Generate an image: ${prompt}`
      );

      const DEFAULT_MAX_RETRIES = 3;
      const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

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

          try {
            const result = await Promise.race([
              fn(),
              new Promise<never>((_, reject) => {
                setTimeout(() => {
                  reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`));
                }, timeoutMs);
              })
            ]);
            return result;
          } catch (error) {
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

      const runStreamedImageGeneration = async (request: {
        prompt: string;
        images?: ImageData[];
        generationConfig?: GenerationConfig;
      }): Promise<GeminiResponse> => {
        updateProgress(10);
        if (abortSignal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        let chunkCount = 0;
        let sawImage = false;
        let text: string | null = null;
        let imagesOut: GeneratedImage[] = [];

        for await (const chunk of service.generateStream({
          ...request,
          prompt: buildImagePrompt(request.prompt),
          model: IMAGE_MODEL
        })) {
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
        return { text, images: imagesOut };
      };

      // Build generation config
      const generationConfig = buildGenerationConfig(state, aspectRatioOverride);
      const generationConfigWithAbort: GenerationConfig = {
        ...generationConfig,
        abortSignal
      };

      let result: GeminiResponse;

      // Handle different modes
      const isTextOnlyMode = TEXT_ONLY_MODES.includes(state.mode);
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
              payload: { error: 'Please upload a document to translate.' }
            });
            dispatch({ type: 'SET_GENERATING', payload: false });
            return;
          }

          // Check if PDF converter is needed for PDF documents
        const isPdf = docTranslate.sourceDocument.mimeType.includes('pdf');
        if (isPdf) {
          const hasCustomApi = ensurePdfConverterInitialized();

          if (!hasCustomApi) {
            dispatch({
              type: 'UPDATE_DOCUMENT_TRANSLATE',
              payload: { error: 'PDF conversion service is unavailable. Please try again later.' }
            });
            dispatch({ type: 'SET_GENERATING', payload: false });
            return;
          }
          }

          // Reset state
          dispatch({
            type: 'UPDATE_DOCUMENT_TRANSLATE',
            payload: {
              error: null,
              translatedDocumentUrl: null,
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
            const translatedUrl = await runWithRetry(
              'document translation',
              () => translateDocument({
                sourceDocument: docTranslate.sourceDocument,
                sourceLanguage: docTranslate.sourceLanguage,
                targetLanguage: docTranslate.targetLanguage,
                translationQuality: docTranslate.translationQuality,
                translateHeaders: docTranslate.translateHeaders,
                translateFootnotes: docTranslate.translateFootnotes,
                onProgress: (progress: TranslationProgress) => {
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
                translatedDocumentUrl: translatedUrl,
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
                  progress: { phase: 'idle', currentSegment: 0, totalSegments: 0, currentBatch: 0, totalBatches: 0 }
                }
              });
            } else {
              dispatch({
                type: 'UPDATE_DOCUMENT_TRANSLATE',
                payload: {
                  error: error instanceof Error ? error.message : 'Translation failed.',
                  progress: { phase: 'error', currentSegment: 0, totalSegments: 0, currentBatch: 0, totalBatches: 0 }
                }
              });
            }
          }
          result = { text: null, images: [] };
        } else {
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

        // Log the current resolution being used
        const currentConfig = buildGenerationConfig(state, aspectRatioOverride);
        const currentResolution = currentConfig.imageConfig?.imageSize || '2K';
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
          `IMPORTANT: Do not add any text labels, letters, or markings (A, B, C, etc.) to the images. Generate clean panels without any annotations.`,
          ``,
          `Lighting Instruction: Maintain a fixed global light source so that shadows shift realistically as the camera moves around the building. No hallucinations or added features.`,
          ``,
          fullPrompt ? `Additional requirements: ${fullPrompt}` : '',
        ].filter(p => p.trim()).join(' ');

        updateProgress(10);

        // Use the global generation config (respects user's resolution choice)
        const gridGenerationConfig = {
          ...generationConfig,
          abortSignal
        };

        // Generate the grid image
        const gridResult = await runWithRetry(
          'multi-angle grid',
          () => service.generateImages({
            prompt: gridPrompt,
            images: images.length > 0 ? images : undefined,
            generationConfig: gridGenerationConfig
          })
        );

        if (!gridResult.images?.[0]) {
          throw new Error('No grid image generated');
        }

        updateProgress(70);

        const gridImage = gridResult.images[0];

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
            prompt: gridPrompt,
            attachments: attachmentUrls,
            mode: state.mode,
            settings: {
              kind: 'multi-angle',
              gridLayout: `${gridRows}x${gridCols}`
            }
          }
        });

        updateProgress(90);

        dispatch({ type: 'UPDATE_WORKFLOW', payload: { multiAngleOutputs: outputs } });
        result = { text: null, images: imagesOut };
        multiAngleHistoryHandled = true;
      } else if (isUpscaleMode) {
        updateProgress(10);
        const wf = state.workflow;
        const queued = wf.upscaleBatch.map((item) => ({ ...item }));
        const failedItems: typeof queued = []; // Track failed items to keep them in the batch
        const syncUpscaleBatch = (nextBatch: typeof queued) => {
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
              const upscaleResult = await Promise.race([
                service.generateImages({
                  prompt: fullPrompt,
                  images: [source],
                  generationConfig: {
                    ...buildGenerationConfig(state, itemAspectRatio || inputAspectRatio || undefined),
                    abortSignal
                  }
                }),
                new Promise<never>((_, reject) => {
                  setTimeout(() => {
                    reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`));
                  }, REQUEST_TIMEOUT_MS);
                })
              ]);

              if (upscaleResult.images?.[0]) {
                const outputUrl = upscaleResult.images[0].dataUrl;
                queued[0] = { ...item, status: 'done', url: outputUrl, retryCount: attempt };
                imagesOut.push({
                  base64: upscaleResult.images[0].base64,
                  mimeType: upscaleResult.images[0].mimeType,
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
                      attachments: attachmentUrls,
                      mode: state.mode
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
                message: `Failed to upscale "${item.name}" after ${MAX_RETRIES + 1} attempts. Image kept in queue for retry.`
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
        const sourceImage = state.uploadedImage ? dataUrlToImageData(state.uploadedImage) : null;
        if (!sourceImage) {
          throw new Error('No source image available for visual edit.');
        }
        const maskImage = state.workflow.visualSelectionMask
          ? dataUrlToImageData(state.workflow.visualSelectionMask)
          : null;

        const editTypeMap: Record<string, ImageEditRequest['editType']> = {
          select: 'inpaint',
          material: 'style-transfer',
          lighting: 'enhance',
          object: 'replace',
          people: 'replace',
          sky: 'replace',
          remove: 'remove',
          replace: 'replace',
          adjust: 'enhance',
          extend: 'outpaint',
        };
        const editType = editTypeMap[state.workflow.activeTool] || 'replace';

        result = await runWithRetry('image edit', () => service.editImage({
          sourceImage,
          maskImage: maskImage || undefined,
          prompt: basePrompt,
          editType,
          generationConfig: generationConfigWithAbort
        }));
      } else if (isVideoMode) {
        updateProgress(10);
        const videoState = state.workflow.videoState;
        const videoService = getVideoGenerationService();
        // Prepare input image for image-animate mode
        let inputImage: ImageData | undefined;
        if (videoState.inputMode === 'image-animate' && state.uploadedImage) {
          const converted = dataUrlToImageData(state.uploadedImage);
          if (converted) {
            // Ensure dataUrl is preserved
            inputImage = {
              ...converted,
              dataUrl: state.uploadedImage
            };
          }
        }

        // Prepare keyframes for multi-frame modes
        let keyframes: ImageData[] | undefined;
        if (videoState.inputMode !== 'image-animate' && videoState.keyframes.length > 0) {
          keyframes = videoState.keyframes
            .map((kf) => dataUrlToImageData(kf.url))
            .filter((img): img is ImageData => img !== null);
        }

        // Progress callback for video generation
        const onVideoProgress = (progress: VideoGenerationProgress) => {
          dispatch({
            type: 'UPDATE_VIDEO_STATE',
            payload: { generationProgress: progress }
          });
          updateProgress(progress.progress);
        };

        try {
          const videoResult = await runWithRetry(
            'video generation',
            () => videoService.generateVideo({
              model: videoState.model,
              prompt: fullPrompt,
              inputImage,
              keyframes,
              duration: videoState.duration,
              resolution: videoState.resolution,
              fps: videoState.fps,
              aspectRatio: videoState.aspectRatio,
              motionAmount: videoState.motionAmount,
              camera: videoState.camera,
              quality: videoState.quality,
              transitionEffect: videoState.transitionEffect,
              seed: videoState.seedLocked ? videoState.seed : undefined,
              generateAudio: videoState.generateAudio,
              personGeneration: videoState.personGeneration,
              klingProvider: videoState.klingProvider,
              onProgress: onVideoProgress,
              abortSignal
            }),
            { timeoutMs: 10 * 60 * 1000 }
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
        const batchResult = await runWithRetry('batch image generation', () => service.generateBatchImages({
          prompt: fullPrompt,
          referenceImages: images.length > 0 ? images : undefined,
          numberOfImages: options.numberOfImages,
          imageConfig: generationConfig.imageConfig,
          abortSignal
        }));
        result = { text: batchResult.text, images: batchResult.images };
      } else {
        // Standard image generation
        result = await runWithRetry('image generation', () => runStreamedImageGeneration({
          prompt: fullPrompt,
          images: images.length > 0 ? images : undefined,
          generationConfig: generationConfigWithAbort
        }));
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

        // Set the first generated image as the main image
        const generatedImageUrl = result.images[0].dataUrl;
        dispatch({ type: 'SET_IMAGE', payload: generatedImageUrl });
        dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
        dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });

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

        // Add to history
        dispatch({
          type: 'ADD_HISTORY',
          payload: {
            id: nanoid(),
            timestamp: Date.now(),
            thumbnail: generatedImageUrl,
            prompt: basePrompt,
            attachments: attachmentUrls,
            mode: state.mode
          }
        });

        // If multiple images were generated, we could store them elsewhere
        // For now, the first one is the main result
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

      updateProgress(100);
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: 0 });

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
        if (state.mode === 'material-validation') {
          dispatch({
            type: 'UPDATE_MATERIAL_VALIDATION',
            payload: { isRunning: false, error: 'Validation canceled.' }
          });
        }
        dispatch({ type: 'SET_GENERATING', payload: false });
        dispatch({ type: 'SET_PROGRESS', payload: 0 });
        return;
      }
      resetUpscaleProcessing();
      const errorMessage = error instanceof Error ? error.message : '';
      const lowerMessage = errorMessage.toLowerCase();
      const isServiceUnavailable =
        lowerMessage.includes('503') ||
        lowerMessage.includes('service unavailable') ||
        lowerMessage.includes('overloaded');
      const isImageMode = !TEXT_ONLY_MODES.includes(state.mode);
      if (isImageMode && isServiceUnavailable) {
        dispatch({
          type: 'SET_APP_ALERT',
          payload: {
            id: nanoid(),
            tone: 'warning',
            message: 'Gemini image service is temporarily unavailable (503). Please retry in a moment.'
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
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: 0 });

      // Could dispatch an error action here
      // dispatch({ type: 'SET_ERROR', payload: error.message });
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
          progress: { phase: 'idle', currentSegment: 0, totalSegments: 0, currentBatch: 0, totalBatches: 0 }
        }
      });
    }
    dispatch({ type: 'SET_GENERATING', payload: false });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
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

