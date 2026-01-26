/**
 * Generation Hook
 * Wires Gemini API service with app state for all generation features
 */

import { useCallback, useRef } from 'react';
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
  GenerationConfig
} from '../services/geminiService';
import { classifyDocumentRole } from '../services/materialValidationPipeline';
import { createMaterialValidationService } from '../services/materialValidationService';
import { nanoid } from 'nanoid';
import type { AppState, GenerationMode } from '../types';

const TEXT_ONLY_MODES: GenerationMode[] = ['material-validation'];

// Get API key from environment or localStorage
const getApiKey = (): string | null => {
  // Check environment variable first (for Vite)
  // @ts-ignore - Vite injects this
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // Fall back to localStorage
  return localStorage.getItem('gemini_api_key');
};

// Initialize service if API key is available
const ensureServiceInitialized = (): boolean => {
  if (isGeminiServiceInitialized()) {
    return true;
  }

  const apiKey = getApiKey();
  if (apiKey) {
    initGeminiService({ apiKey });
    return true;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const isReady = ensureServiceInitialized();

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem('gemini_api_key', key);
    if (!isGeminiServiceInitialized()) {
      initGeminiService({ apiKey: key });
    }
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
  const buildGenerationConfig = useCallback((state: AppState) => {
    const { output } = state;

    // Map output settings to image config
    const aspectRatioMap: Record<string, '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2'> = {
      '1:1': '1:1',
      '16:9': '16:9',
      '9:16': '9:16',
      '4:3': '4:3',
      '3:4': '3:4',
      '2:3': '2:3',
      '3:2': '3:2',
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
        aspectRatio: aspectRatioMap[output.aspectRatio] || '16:9',
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
      'img-to-cad': 'Analyze this architectural image: ',
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
      console.error('Gemini API not initialized. Please set your API key.');
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
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    updateProgress(2);

    try {
      if (abortSignal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      // Build prompt from state or use provided prompt
      const basePrompt = options.prompt || (
        state.mode === 'material-validation'
          ? ''
          : generatePrompt(state)
      );
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
        'multi-angle'
      ];
      const isSourceLockedMode = sourceLockedModes.includes(state.mode);
      const sourceImage = state.sourceImage || state.uploadedImage;
      const baseImage = isSourceLockedMode ? sourceImage : state.uploadedImage;

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

      const buildImagePrompt = (prompt: string) => (
        prompt.includes('generate') || prompt.includes('create')
          ? prompt
          : `Generate an image: ${prompt}`
      );

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
      const generationConfig = buildGenerationConfig(state);
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
        } else {
          updateProgress(10);
          const textGenerationConfig = generationConfig;
          // Text-only generation (analysis modes)
          const text = await service.generateText({
            prompt: fullPrompt || 'Analyze the provided materials and return a concise validation summary.',
            images,
            attachments,
            generationConfig: generationConfigWithAbort
          });
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

        for (let i = 0; i < angleViews.length; i++) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          const view = angleViews[i];
          const anglePrompt = `${fullPrompt} Angle ${i + 1}: azimuth ${view.azimuth} deg, elevation ${view.elevation} deg.`;
          const angleResult = await service.generateImages({
            prompt: anglePrompt,
            images: images.length > 0 ? images : undefined,
            generationConfig: generationConfigWithAbort
          });
          if (angleResult.images?.[0]) {
            outputs.push({
              id: nanoid(),
              name: `Angle ${i + 1} (${view.azimuth} deg / ${view.elevation} deg)`,
              url: angleResult.images[0].dataUrl
            });
            imagesOut.push({
              base64: angleResult.images[0].base64,
              mimeType: angleResult.images[0].mimeType,
              dataUrl: angleResult.images[0].dataUrl
            });
          }
          const progress = Math.round(((i + 1) / angleViews.length) * 90);
          updateProgress(progress);
        }

        dispatch({ type: 'UPDATE_WORKFLOW', payload: { multiAngleOutputs: outputs } });
        result = { text: null, images: imagesOut };
      } else if (isUpscaleMode) {
        updateProgress(10);
        const wf = state.workflow;
        const queued = wf.upscaleBatch.map((item) => ({ ...item }));
        const imagesOut: GeneratedImage[] = [];

        for (let i = 0; i < queued.length; i++) {
          if (abortSignal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          const item = queued[i];
          if (item.status === 'done' && item.url) {
            const existing = dataUrlToImageData(item.url);
            if (existing) {
              imagesOut.push({
                base64: existing.base64,
                mimeType: existing.mimeType,
                dataUrl: item.url
              });
            }
            continue;
          }
          if (!item.url) {
            queued[i] = { ...item, status: 'done' };
            continue;
          }
          queued[i] = { ...item, status: 'processing' };
          dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleBatch: [...queued] } });

          const source = dataUrlToImageData(item.url);
          if (!source) {
            queued[i] = { ...item, status: 'done' };
            continue;
          }

          const upscaleResult = await service.generateImages({
            prompt: fullPrompt,
            images: [source],
            generationConfig: generationConfigWithAbort
          });

          if (upscaleResult.images?.[0]) {
            queued[i] = { ...item, status: 'done', url: upscaleResult.images[0].dataUrl };
            imagesOut.push({
              base64: upscaleResult.images[0].base64,
              mimeType: upscaleResult.images[0].mimeType,
              dataUrl: upscaleResult.images[0].dataUrl
            });
          } else {
            queued[i] = { ...item, status: 'done' };
          }

          const progress = Math.round(((i + 1) / queued.length) * 90);
          updateProgress(progress);
          dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleBatch: [...queued] } });
        }

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
          sky: 'replace',
          remove: 'remove',
          replace: 'replace',
          adjust: 'enhance',
          extend: 'outpaint',
        };
        const editType = editTypeMap[state.workflow.activeTool] || 'replace';

        result = await service.editImage({
          sourceImage,
          maskImage: maskImage || undefined,
          prompt: basePrompt,
          editType,
          generationConfig: generationConfigWithAbort
        });
      } else if (isVideoMode) {
        result = await runStreamedImageGeneration({
          prompt: fullPrompt,
          images: images.length > 0 ? images : undefined,
          generationConfig: generationConfigWithAbort
        });
      } else if (options.numberOfImages && options.numberOfImages > 1) {
        updateProgress(10);
        // Batch image generation
        const batchResult = await service.generateBatchImages({
          prompt: fullPrompt,
          referenceImages: images.length > 0 ? images : undefined,
          numberOfImages: options.numberOfImages,
          imageConfig: generationConfig.imageConfig,
          abortSignal
        });
        result = { text: batchResult.text, images: batchResult.images };
      } else {
        // Standard image generation
        result = await runStreamedImageGeneration({
          prompt: fullPrompt,
          images: images.length > 0 ? images : undefined,
          generationConfig: generationConfigWithAbort
        });
      }
      updateProgress(95);

      // Debug: Log the full result
      console.log('Gemini API Response:', result);
      console.log('Images count:', result.images?.length || 0);
      console.log('Text:', result.text);

      // Process result
      if (result.images && result.images.length > 0) {
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

        if (isVideoMode) {
          dispatch({
            type: 'UPDATE_VIDEO_STATE',
            payload: { generatedVideoUrl: generatedImageUrl }
          });
        }
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
      if ((error as DOMException)?.name === 'AbortError') {
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
      console.error('Generation failed:', error);
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
