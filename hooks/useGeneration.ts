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
  GeminiResponse,
  ImageData,
  ImageEditRequest,
  GeneratedImage
} from '../services/geminiService';
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

export interface GenerationOptions {
  prompt?: string;
  attachments?: string[];
  numberOfImages?: number;
}

export interface UseGenerationReturn {
  generate: (options?: GenerationOptions) => Promise<void>;
  generateFromState: () => Promise<void>;
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

    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });

    try {
      // Build prompt from state or use provided prompt
      const basePrompt = options.prompt || (
        state.mode === 'material-validation'
          ? 'Validate the material schedule and BoQ. Summarize issues, mismatches, and missing items.'
          : generatePrompt(state)
      );
      const modePrefix = getModePromptPrefix(state.mode);
      const fullPrompt = modePrefix + basePrompt;

      const sourceImage = state.sourceImage || state.uploadedImage;
      const baseImage = state.mode === 'render-3d' ? sourceImage : state.uploadedImage;

      // Collect images from state and attachments
      const images: ImageData[] = [];

      // Add uploaded image if available
      if (baseImage) {
        const imgData = dataUrlToImageData(baseImage);
        if (imgData) {
          images.push(imgData);
        }
      }

      // Add attachments
      if (options.attachments) {
        for (const attachment of options.attachments) {
          const imgData = dataUrlToImageData(attachment);
          if (imgData) {
            images.push(imgData);
          }
        }
      }

      const isMultiAngleMode = state.mode === 'multi-angle';
      const isUpscaleMode = state.mode === 'upscale';
      const isVisualEditMode = state.mode === 'visual-edit';
      const isVideoMode = state.mode === 'video';

      let progressInterval: ReturnType<typeof setInterval> | null = null;
      if (!isMultiAngleMode && !isUpscaleMode) {
        let currentProgress = 0;
        progressInterval = setInterval(() => {
          currentProgress = Math.min(currentProgress + 5, 90);
          dispatch({ type: 'SET_PROGRESS', payload: currentProgress });
        }, 500);
      }

      // Build generation config
      const generationConfig = buildGenerationConfig(state);

      let result: GeminiResponse;

      // Handle different modes
      const isTextOnlyMode = TEXT_ONLY_MODES.includes(state.mode);
      if (isTextOnlyMode) {
        if (state.mode === 'material-validation') {
          dispatch({
            type: 'UPDATE_MATERIAL_VALIDATION',
            payload: { isRunning: true, aiSummary: null, lastRunAt: Date.now() }
          });
        }
        // Text-only generation (analysis modes)
        const text = await service.generateText({
          prompt: fullPrompt || 'Analyze the provided materials and return a concise validation summary.',
          images,
          generationConfig
        });
        result = { text, images: [] };
      } else if (isMultiAngleMode) {
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
          const view = angleViews[i];
          const anglePrompt = `${fullPrompt} Angle ${i + 1}: azimuth ${view.azimuth} deg, elevation ${view.elevation} deg.`;
          const angleResult = await service.generateImages({
            prompt: anglePrompt,
            images: images.length > 0 ? images : undefined,
            generationConfig
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
          dispatch({ type: 'SET_PROGRESS', payload: progress });
        }

        dispatch({ type: 'UPDATE_WORKFLOW', payload: { multiAngleOutputs: outputs } });
        result = { text: null, images: imagesOut };
      } else if (isUpscaleMode) {
        const wf = state.workflow;
        const queued = wf.upscaleBatch.map((item) => ({ ...item }));
        const imagesOut: GeneratedImage[] = [];

        for (let i = 0; i < queued.length; i++) {
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

          const upscalePrompt = `${fullPrompt} Scale factor ${wf.upscaleFactor}.`;
          const upscaleResult = await service.generateImages({
            prompt: upscalePrompt,
            images: [source],
            generationConfig
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
          dispatch({ type: 'SET_PROGRESS', payload: progress });
          dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleBatch: [...queued] } });
        }

        result = { text: null, images: imagesOut };
      } else if (isVisualEditMode) {
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
          generationConfig
        });
      } else if (isVideoMode) {
        result = await service.generateImages({
          prompt: fullPrompt,
          images: images.length > 0 ? images : undefined,
          generationConfig
        });
      } else if (options.numberOfImages && options.numberOfImages > 1) {
        // Batch image generation
        const batchResult = await service.generateBatchImages({
          prompt: fullPrompt,
          referenceImages: images.length > 0 ? images : undefined,
          numberOfImages: options.numberOfImages,
          imageConfig: generationConfig.imageConfig
        });
        result = { text: batchResult.text, images: batchResult.images };
      } else {
        // Standard image generation
        result = await service.generateImages({
          prompt: fullPrompt,
          images: images.length > 0 ? images : undefined,
          generationConfig
        });
      }

      if (progressInterval) {
        clearInterval(progressInterval);
      }
      dispatch({ type: 'SET_PROGRESS', payload: 100 });

      // Debug: Log the full result
      console.log('Gemini API Response:', result);
      console.log('Images count:', result.images?.length || 0);
      console.log('Text:', result.text);

      // Process result
      if (result.images && result.images.length > 0) {
        const sourceForHistory = state.sourceImage;
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
              attachments: options.attachments || [],
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

        // Add to history
        dispatch({
          type: 'ADD_HISTORY',
          payload: {
            id: nanoid(),
            timestamp: Date.now(),
            thumbnail: generatedImageUrl,
            prompt: basePrompt,
            attachments: options.attachments || [],
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
          dispatch({
            type: 'UPDATE_MATERIAL_VALIDATION',
            payload: { aiSummary: result.text, isRunning: false }
          });
        }
      }

      if (state.mode === 'material-validation') {
        dispatch({
          type: 'UPDATE_MATERIAL_VALIDATION',
          payload: { isRunning: false }
        });
      }

      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: 0 });

    } catch (error) {
      console.error('Generation failed:', error);
      if (state.mode === 'material-validation') {
        dispatch({
          type: 'UPDATE_MATERIAL_VALIDATION',
          payload: { isRunning: false }
        });
      }
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: 0 });

      // Could dispatch an error action here
      // dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [state, dispatch, dataUrlToImageData, buildGenerationConfig, getModePromptPrefix]);

  /**
   * Generate using only state (no custom options)
   */
  const generateFromState = useCallback(async () => {
    return generate();
  }, [generate]);

  return {
    generate,
    generateFromState,
    isReady,
    setApiKey
  };
}

export default useGeneration;
