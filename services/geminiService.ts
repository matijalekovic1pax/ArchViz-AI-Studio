/**
 * Gemini API Service
 * All calls go through the API gateway (Cloudflare Worker) — no API keys in the client.
 * Public API is unchanged from the SDK-based version.
 */

import { geminiRequest, geminiStreamRequest, openAIImageRequest } from './apiGateway';
import { type ImageGenerationModel } from '../types';
import { adaptPromptForImageGenerationModel } from '../engine/promptEngine';

// ============================================================================
// Types & Interfaces
// ============================================================================

export const DEFAULT_MODEL = 'gemini-3-pro-image';
export const IMAGE_MODEL = 'gemini-3-pro-image';
export const TEXT_MODEL = 'gemini-3.5-flash';
export const AUTO_SELECTION_MODEL = 'gemini-3.5-flash';
export const PROMPT_OPTIMIZER_MODEL = 'gemini-3.5-flash';
export const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const ADAPTED_IMAGE_PROMPT_PATTERN = /^\s*Model:\s*(?:Nano Banana 2|Nano Banana Pro|regular Nano Banana|ChatGPT Image Generation 2)\b/i;
const PROMPT_OPTIMIZER_MIN_PROMPT_CHARS_WITHOUT_IMAGES = 420;
const PROMPT_OPTIMIZER_MAX_INPUT_CHARS = 14000;
const PROMPT_OPTIMIZER_MAX_OUTPUT_TOKENS = 900;
const OUTPUT_VERIFICATION_MAX_PROMPT_CHARS = 10000;
const OUTPUT_VERIFICATION_MAX_OUTPUT_TOKENS = 900;
export const OUTPUT_VERIFICATION_MIN_SCORE = 85;

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export interface GeminiConfig {
  model?: string;
}

export interface ImageData {
  base64: string;
  mimeType: ImageMimeType;
  width?: number;
  height?: number;
}

export interface AttachmentData {
  base64: string;
  mimeType: string;
  name?: string;
}

export interface GeminiRequest {
  prompt: string;
  images?: ImageData[];
  attachments?: AttachmentData[];
  generationConfig?: GenerationConfig;
  model?: string;
  imageGenerationModel?: ImageGenerationModel;
}

interface InternalGeminiRequest extends GeminiRequest {
  maskImage?: ImageData;
  promptOptimized?: boolean;
  skipPromptOptimization?: boolean;
}

type ImagePromptKind = 'generation' | 'batch' | 'edit' | 'grid';
export type ImageGenerationProgressPhase = 'ai-middle-layer' | 'generation' | 'image-transfer' | 'verification' | 'complete';

export interface ImageGenerationProgress {
  phase: ImageGenerationProgressPhase;
  progress: number;
  message?: string;
}

export type ImageGenerationProgressCallback = (progress: ImageGenerationProgress) => void;

interface PromptOptimizationContext {
  promptKind: ImagePromptKind;
  imageGenerationModel?: ImageGenerationModel;
  hasMaskImage?: boolean;
  hasReferenceImages?: boolean;
  originalUserPrompt?: string;
}

export interface ImageConfig {
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  imageSize?: '1K' | '2K' | '4K';
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  abortSignal?: AbortSignal;
  responseModalities?: Array<'TEXT' | 'IMAGE'>;
  imageConfig?: ImageConfig;
  responseFormat?: {
    image?: ImageConfig;
  };
  thinkingConfig?: {
    thinkingBudget?: number;
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  };
  openAI?: {
    background?: 'opaque' | 'auto';
  };
  onProgress?: ImageGenerationProgressCallback;
}

export interface GeminiResponse {
  text: string | null;
  images: GeneratedImage[];
  finishReason?: string;
  optimizedPrompt?: string;
  outputVerification?: ImageOutputVerificationResult;
  outputVerifications?: ImageOutputVerificationResult[];
  outputVerificationAttempts?: number;
}

export interface GeneratedImage {
  base64: string;
  mimeType: ImageMimeType;
  dataUrl: string;
}

export interface BatchImageRequest {
  prompt: string;
  referenceImages?: ImageData[];
  numberOfImages: number;
  imageConfig?: ImageConfig;
  openAI?: GenerationConfig['openAI'];
  abortSignal?: AbortSignal;
  imageGenerationModel?: ImageGenerationModel;
  onProgress?: ImageGenerationProgressCallback;
  promptAlreadyOptimized?: boolean;
}

export interface BatchImageResponse {
  images: GeneratedImage[];
  text: string | null;
  optimizedPrompt?: string;
  outputVerifications?: ImageOutputVerificationResult[];
  outputVerificationAttempts?: number;
}

export interface ImageOutputVerificationRequest {
  prompt: string;
  generatedImage: ImageData;
  referenceImages?: ImageData[];
  originalPrompt?: string;
  threshold?: number;
  generationConfig?: GenerationConfig;
}

export interface ImageOutputVerificationResult {
  score: number;
  passed: boolean;
  summary: string;
  issues: string[];
  revisedPrompt?: string;
  aiSlopDetected?: boolean;
  aiSlopConfidence?: number;
  aiSlopIndicators?: string[];
  aiSlopSuggestion?: string;
}

export interface BatchTextResult {
  text: string | null;
  error?: string;
}

export interface BatchTextOptions {
  displayName?: string;
  pollIntervalMs?: number;
}

export interface ImageEditRequest {
  sourceImage: ImageData;
  maskImage?: ImageData;
  maskMode?: 'strict' | 'guided';
  referenceImages?: ImageData[];
  prompt: string;
  editType: 'inpaint' | 'outpaint' | 'style-transfer' | 'enhance' | 'remove' | 'replace' | 'people';
  activeTool?: string;
  generationConfig?: GenerationConfig;
  imageGenerationModel?: ImageGenerationModel;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

// ============================================================================
// Image Utilities
// ============================================================================

export class ImageUtils {
  static async fileToImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        const mimeType = file.type as ImageMimeType;

        const img = new Image();
        img.onload = () => {
          resolve({
            base64,
            mimeType,
            width: img.width,
            height: img.height
          });
        };
        img.onerror = () => resolve({ base64, mimeType });
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  static dataUrlToImageData(dataUrl: string): ImageData {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format');
    }
    return {
      base64: matches[2],
      mimeType: matches[1] as ImageMimeType
    };
  }

  static imageDataToDataUrl(imageData: ImageData): string {
    return `data:${imageData.mimeType};base64,${imageData.base64}`;
  }

  static async convertImageFormat(imageData: ImageData, mimeType: ImageMimeType): Promise<ImageData> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL(mimeType);
        resolve({
          ...ImageUtils.dataUrlToImageData(dataUrl),
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => resolve(imageData);
      img.src = ImageUtils.imageDataToDataUrl(imageData);
    });
  }

  static async urlToImageData(url: string): Promise<ImageData> {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'image', { type: blob.type });
    return this.fileToImageData(file);
  }

  static async resizeImage(
    imageData: ImageData,
    maxWidth: number,
    maxHeight: number
  ): Promise<ImageData> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(imageData.mimeType);
        resolve({
          ...ImageUtils.dataUrlToImageData(dataUrl),
          width,
          height
        });
      };
      img.src = ImageUtils.imageDataToDataUrl(imageData);
    });
  }

  static async compressImage(
    imageData: ImageData,
    quality: number = 0.8
  ): Promise<ImageData> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const mimeType = imageData.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve({
          ...ImageUtils.dataUrlToImageData(dataUrl),
          width: img.width,
          height: img.height
        });
      };
      img.src = ImageUtils.imageDataToDataUrl(imageData);
    });
  }
}

// ============================================================================
// Main Gemini Service (REST through gateway)
// ============================================================================

export class GeminiService {
  private model: string;
  private maxRetries = 3;

  constructor(config: GeminiConfig = {}) {
    this.model = config.model || DEFAULT_MODEL;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  // --------------------------------------------------------------------------
  // Core Generation Methods
  // --------------------------------------------------------------------------

  async generate(request: GeminiRequest): Promise<GeminiResponse> {
    const wantsImage = (request.generationConfig?.responseModalities || ['TEXT', 'IMAGE']).includes('IMAGE');
    const preparedRequest = wantsImage
      ? await this.prepareImageRequest(request, 'generation')
      : request;

    if (this.isOpenAIImageRequest(preparedRequest)) {
      return this.withOptimizedPrompt(await this.generateOpenAIImages(preparedRequest), preparedRequest);
    }

    const contents = this.buildContents(preparedRequest);
    const generationConfig = this.buildGenerationConfig(preparedRequest.generationConfig, ['TEXT', 'IMAGE'], this.model);

    this.emitProgress(preparedRequest.generationConfig, 'generation', 5, 'Starting image model request...');
    const response = await this.executeWithRetry(() =>
      geminiRequest(this.model, 'generateContent', {
        contents,
        generationConfig,
      }, { signal: preparedRequest.generationConfig?.abortSignal })
    );
    this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 35, 'Receiving generated image...');

    const parsed = this.parseResponse(response);
    this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 100, 'Image transfer complete.');
    this.emitProgress(preparedRequest.generationConfig, 'complete', 100);
    return this.withOptimizedPrompt(parsed, preparedRequest);
  }

  async generateText(request: GeminiRequest): Promise<string> {
    const contents = this.buildContents(request);
    const model = request.model || TEXT_MODEL;
    const { imageConfig: _ic, ...configWithoutImage } = request.generationConfig || {};
    const baseConfig = { ...configWithoutImage, responseModalities: ['TEXT'] as Array<'TEXT' | 'IMAGE'> };
    const normalized = this.normalizeThinkingConfig(model, baseConfig);
    const generationConfig = this.buildGenerationConfig(normalized, ['TEXT'], model);

    const response = await this.executeWithRetry(() =>
      geminiRequest(model, 'generateContent', {
        contents,
        generationConfig,
      }, { signal: request.generationConfig?.abortSignal })
    );

    const parsed = this.parseResponse(response);
    return parsed.text || '';
  }

  async generateImages(request: GeminiRequest): Promise<GeminiResponse> {
    const preparedRequest = await this.prepareImageRequest(request, 'generation');

    if (this.isOpenAIImageRequest(preparedRequest)) {
      return this.withOptimizedPrompt(await this.generateOpenAIImages(preparedRequest), preparedRequest);
    }

    const imagePrompt = /\b(generate|create|edit|convert|transform|model:|task:|output artifact:)\b/i.test(preparedRequest.prompt)
      ? preparedRequest.prompt
      : `Generate an image: ${preparedRequest.prompt}`;

    const contents = this.buildContents({ ...preparedRequest, prompt: imagePrompt });
    const generationConfig = this.buildGenerationConfig(preparedRequest.generationConfig, ['TEXT', 'IMAGE'], IMAGE_MODEL);

    this.emitProgress(preparedRequest.generationConfig, 'generation', 5, 'Starting image model request...');
    const response = await this.executeWithRetry(() =>
      geminiRequest(IMAGE_MODEL, 'generateContent', {
        contents,
        generationConfig,
      }, { signal: preparedRequest.generationConfig?.abortSignal })
    );
    this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 35, 'Receiving generated image...');

    const parsed = this.parseResponse(response);
    this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 100, 'Image transfer complete.');
    this.emitProgress(preparedRequest.generationConfig, 'complete', 100);
    return this.withOptimizedPrompt(parsed, preparedRequest);
  }

  // --------------------------------------------------------------------------
  // Batch Image Generation
  // --------------------------------------------------------------------------

  async generateBatchImages(request: BatchImageRequest): Promise<BatchImageResponse> {
    const numberOfImages = Math.min(Math.max(1, request.numberOfImages), 8);
    const promises: Promise<GeminiResponse>[] = [];
    const preparedBaseRequest = await this.prepareImageRequest({
      prompt: request.prompt,
      images: request.referenceImages,
      imageGenerationModel: request.imageGenerationModel,
      generationConfig: {
        imageConfig: request.imageConfig,
        openAI: request.openAI,
        abortSignal: request.abortSignal,
        onProgress: request.onProgress
      },
      promptOptimized: request.promptAlreadyOptimized,
      skipPromptOptimization: request.promptAlreadyOptimized
    }, 'batch');

    for (let i = 0; i < numberOfImages; i++) {
      const prompt = numberOfImages > 1
        ? `${preparedBaseRequest.prompt} Variation ${i + 1}: keep the same intent and references, but choose a distinct, plausible visual interpretation.`
        : preparedBaseRequest.prompt;

      promises.push(
        this.generateImages({
          prompt,
          images: request.referenceImages,
          imageGenerationModel: request.imageGenerationModel,
          promptOptimized: true,
          skipPromptOptimization: true,
          generationConfig: {
            imageConfig: request.imageConfig,
            openAI: request.openAI,
            abortSignal: request.abortSignal,
            onProgress: request.onProgress
          }
        } as InternalGeminiRequest)
      );
    }

    const results = await Promise.allSettled(promises);
    const allImages: GeneratedImage[] = [];
    let combinedText = '';

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allImages.push(...result.value.images);
        if (result.value.text) {
          combinedText += result.value.text + '\n';
        }
      }
    }

    return {
      images: allImages,
      text: combinedText.trim() || null,
      optimizedPrompt: this.getOptimizedPromptForResponse(preparedBaseRequest)
    };
  }

  // --------------------------------------------------------------------------
  // Chat/Conversation Support
  // --------------------------------------------------------------------------

  async chat(
    messages: Array<{ role: 'user' | 'model'; content: string; images?: ImageData[] }>,
    generationConfig?: GenerationConfig
  ): Promise<GeminiResponse> {
    const contents = messages.map(msg => {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: msg.content }
      ];
      if (msg.images) {
        for (const img of msg.images) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        }
      }
      return { role: msg.role, parts };
    });

    const config = this.buildGenerationConfig(generationConfig, generationConfig?.responseModalities || ['TEXT', 'IMAGE'], this.model);

    const response = await this.executeWithRetry(() =>
      geminiRequest(this.model, 'generateContent', {
        contents,
        generationConfig: config,
      }, { signal: generationConfig?.abortSignal })
    );

    return this.parseResponse(response);
  }

  // --------------------------------------------------------------------------
  // Image Editing
  // --------------------------------------------------------------------------

  async editImage(request: ImageEditRequest): Promise<GeminiResponse> {
    let editPrompt = request.prompt;
    const referenceCount = request.referenceImages?.length || 0;
    const maskMode = request.maskMode ?? 'guided';
    const referenceInstructions = referenceCount > 0
      ? ` Additional reference image${referenceCount > 1 ? 's' : ''} follow the source${request.maskImage ? ' and selection guidance' : ''}. Reference relationship: use ${referenceCount > 1 ? 'these references' : 'this reference'} only for the explicit visual target described in the edit prompt, such as material color, pattern, texture scale, roughness, reflectivity, grain direction, joints, seams, object identity, or style cues. Do not copy unrelated reference-image framing, camera angle, background, people, signage, logos, or composition; do not add a reference image as a pasted object unless the edit prompt explicitly asks for object insertion.`
      : '';
    const cameraAndTextLock = [
      'Preserve the original camera position, field of view, horizon, crop, perspective, and aspect ratio unless the edit type explicitly changes the canvas.',
      'Preserve existing text, signage, numbers, logos, labels, UI marks, and graphic blocks as source-faithful shapes. Do not translate, rewrite, correct, invent, blur, or remove text unless the edit prompt explicitly requests text editing.',
      'All unaffected regions must remain visually identical in layout, object count, geometry, material boundaries, shadows, reflections, and scale relationships.'
    ].join(' ');
    const maskScopeInstructions = maskMode === 'guided'
      ? [
          'Use the bright selection pixels as spatial guidance for the user-selected target area, not as a hard pasted cutout, clipping stencil, or alpha edge.',
          'The selected shape is a pointer to the intended object, surface, or area. If that target naturally continues slightly beyond the bright pixels, refine and blend those nearby connected pixels as needed.',
          'You may naturally reconstruct and blend nearby pixels beyond the selection where required for texture continuation, material falloff, shadows, reflections, occlusion, or cleanup.',
          'Preserve unrelated architecture, materials, people, signage, camera, perspective, and overall composition.',
          'Never draw, expose, fill, or preserve the selection guidance itself in the final image; no white blobs, blank patches, outlines, labels, or visible mask artifacts.'
        ].join(' ')
      : [
          'White mask pixels are the ONLY editable pixels. Black mask pixels are locked and must remain visually identical to the original source image.',
          'Never draw, expose, fill, or preserve the black-and-white mask itself in the final image; no white blobs, blank patches, outlines, labels, or visible mask artifacts.'
        ].join(' ');
    const maskInstructions = request.maskImage
      ? [
          referenceCount > 0
            ? 'You are given input images in this exact order:'
            : 'You are given two input images in this exact order:',
          '1. The original source image.',
          maskMode === 'guided'
            ? '2. A soft selection guidance map with the same framing as the source image; bright areas mark the intended target focus.'
            : '2. A black-and-white selection mask with the same framing as the source image.',
          cameraAndTextLock,
          maskScopeInstructions,
          'Return a complete edited image with the same camera, framing, perspective, and aspect ratio as the source image.',
          referenceInstructions
        ].join(' ')
      : `Return a complete edited image. ${cameraAndTextLock}${referenceInstructions}`;
    const highFidelityEnhanceInstructions = [
      'Perform a conservative restoration and quality pass, not a redraw or redesign.',
      'Treat the source image as the exact visual blueprint: same object count, same object positions, same silhouettes, same scale relationships, same crop, same camera, and same perspective.',
      'Preserve fine architectural details exactly: ceiling slats, panels, mullions, columns, signage blocks, lights, railings, furniture, plants, reflections, floor joints, texture patterns, material colors, and material finishes.',
      'Preserve every person exactly in count, location, pose, clothing color, and silhouette. Do not merge people, remove people, invent faces, alter limbs, or simplify crowds.',
      'Preserve signage and text marks as source-faithful shapes. Do not rewrite, translate, invent, or make illegible text newly readable unless it is already readable in the source.',
      'Allowed changes are only optical-quality improvements: reduce noise and compression artifacts, recover local contrast, sharpen existing edges, clarify already-visible microdetail, and smooth obvious rendering artifacts.',
      'For blurry, tiny, distant, or ambiguous areas, keep the same shapes and approximate detail rather than inventing new content. When enhancement conflicts with preservation, preserve.'
    ].join(' ');
    const guidedRemoveTargetInstructions = [
      'For removal requests, treat the selection guidance as target guidance for the complete subject centered inside the selected area, not as a request to remove only small high-contrast fragments.',
      'If the centered target is a person, remove the entire person silhouette: head, torso, limbs, clothing, hair, hands, feet, carried bags, wheeled luggage, straps, personal items, contact shadows, and reflections.',
      'If the whole person or object extends slightly beyond the bright guidance area, remove those connected parts too when needed so no body, accessory, shadow, or ghosted remnant remains.',
      'Do not remove only luggage, bags, shadows, or accessories while leaving the selected person or main object visible.',
      'Treat selected floor, wall, kiosk, ceiling, sign, and architectural pixels as reconstruction context unless they are clearly the central selected subject.'
    ].join(' ');
    const strictRemoveTargetInstructions = [
      'For removal requests, remove the complete target content inside the editable area rather than only small high-contrast fragments.',
      'If the editable area contains a person, remove all visible person parts and personal accessories inside that area, then reconstruct the background naturally.',
      'Do not remove only luggage, bags, shadows, or accessories while leaving the targeted person or main object visible inside the editable area.'
    ].join(' ');

    switch (request.editType) {
      case 'inpaint':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Apply the requested edit to the target indicated by the selection guidance: ${request.prompt}. Keep the edit focused on the intended selected target while allowing seamless reconstruction beyond the guidance edge when visually necessary.`
          : `${maskInstructions} Edit only the allowed masked area according to this instruction: ${request.prompt}. Maintain seamless blending at the mask boundary.`;
        break;
      case 'outpaint':
        editPrompt = `Extend this image by adding: ${request.prompt}. Match the existing style seamlessly. Continue the source perspective lines, horizon, lighting direction, materials, shadows, reflections, and visible text/signage shapes into the new canvas area. Do not change existing source pixels unless needed only at the extension seam.`;
        break;
      case 'style-transfer':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Transform the existing target surface or object finish indicated by the selection guidance: ${request.prompt}. This is a material/color/finish edit only, not object generation. Re-render the finish physically into the existing scene; do not paste, tile, or overlay the material/reference image as a flat texture. Treat the selection as a pointer to the intended material or object, not as the exact visible boundary of the final change. If the same selected surface or object continues slightly beyond the bright guidance area, continue the finish naturally across the connected visible target where needed for a seamless result. Preserve the source image composition, camera, geometry, object count, object positions, signage, people, floors, walls, ceilings, furniture, belts, posts, counters, and unrelated materials. Do not add, remove, duplicate, enlarge, replace, or rearrange any elements. If a target is ambiguous, edit only the clearly matching existing surface or object and leave uncertain areas unchanged.`
          : `${maskInstructions} Transform only the existing target surface or object finish requested here: ${request.prompt}. This is a material/color/finish edit only, not object generation. Re-render the finish physically into the existing scene; do not paste, tile, or overlay the material/reference image as a flat texture. Preserve the source image composition, camera, geometry, object count, object positions, silhouettes, edges, seams, signage, people, floors, walls, ceilings, furniture, belts, posts, counters, and all unrelated materials. Do not add, remove, duplicate, enlarge, replace, or rearrange any elements. If a target is ambiguous, edit only the clearly matching existing surface and leave uncertain areas unchanged.`;
        break;
      case 'enhance':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Apply the enhancement primarily to the target indicated by the selection guidance. ${highFidelityEnhanceInstructions} User enhancement request: ${request.prompt}.`
          : `${maskInstructions} ${highFidelityEnhanceInstructions} User enhancement request: ${request.prompt}.`;
        break;
      case 'remove':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} ${guidedRemoveTargetInstructions} Remove the unwanted content indicated by the selection guidance as requested: ${request.prompt}. Reconstruct the revealed floor, reflections, shadows, texture, and perspective from surrounding context so the object looks like it was never there. Do not leave a flat blank, white patch, masked silhouette, or smudged hole.`
          : `${maskInstructions} ${strictRemoveTargetInstructions} Remove only the content inside the allowed masked area as requested: ${request.prompt}. Fill naturally using the surrounding context while preserving every locked pixel.`;
        break;
      case 'replace':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Replace the target indicated by the selection guidance with: ${request.prompt}. Keep the replacement anchored to the selected target while allowing natural blending, contact shadows, reflections, and occlusion beyond the guidance edge where necessary.`
          : `${maskInstructions} Replace only the allowed masked area with: ${request.prompt}. Blend seamlessly at the boundary and preserve every locked pixel.`;
        break;
      case 'people':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Edit, add, replace, or refine human figures and their immediate personal accessories indicated by the selection guidance according to this instruction: ${request.prompt}. Do not render any part of the instruction as visible text, captions, labels, handwriting, signage, UI, or graphic overlays. When the instruction asks for automatic repopulation or new people, selected non-person pixels may guide plausible people placement; otherwise replace or refine targeted people only. Preserve architecture, floors, furniture, signage, lighting, camera, and perspective. Selected non-person pixels are context and must be naturally reconstructed around the people, not filled with text, white shapes, or decorative marks.`
          : `${maskInstructions} Edit, add, replace, or refine human figures and their immediate personal accessories according to this instruction: ${request.prompt}. Do not render any part of the instruction as visible text, captions, labels, handwriting, signage, UI, or graphic overlays. When the instruction asks for automatic repopulation or new people, place them only in plausible walkable, queuing, standing, or seated areas; otherwise target existing people only. Preserve architecture, floors, furniture, signage, lighting, camera, perspective, and all unrelated pixels. Non-person pixels are placement and reconstruction context, not targets for unrelated changes.`;
        break;
    }

    const images: ImageData[] = [request.sourceImage];
    if (request.maskImage) images.push(request.maskImage);
    if (request.referenceImages?.length) images.push(...request.referenceImages);
    const editIntentTool: Record<ImageEditRequest['editType'], string> = {
      inpaint: 'select',
      outpaint: 'extend',
      'style-transfer': 'material',
      enhance: 'adjust',
      remove: 'remove',
      replace: 'object',
      people: 'people'
    };
    this.emitProgress(request.generationConfig, 'ai-middle-layer', 8, 'Preparing image edit prompt...');
    const adaptedEditPrompt = adaptPromptForImageGenerationModel(
      editPrompt,
      request.imageGenerationModel || 'nano-banana',
      {
        mode: 'visual-edit',
        activeTool: request.activeTool || editIntentTool[request.editType],
        hasSourceImage: true,
        hasReferenceImages: referenceCount > 0,
        promptKind: 'edit'
      }
    );
    this.emitProgress(request.generationConfig, 'ai-middle-layer', 35, 'Image edit prompt prepared.');
    this.emitProgress(request.generationConfig, 'ai-middle-layer', 55, 'Optimizing prompt for image model...');
    const optimizedEditPrompt = await this.optimizePromptForImageGeneration(
      adaptedEditPrompt,
      images,
      request.generationConfig,
      {
        promptKind: 'edit',
        imageGenerationModel: request.imageGenerationModel,
        hasMaskImage: Boolean(request.maskImage),
        hasReferenceImages: referenceCount > 0,
        originalUserPrompt: request.prompt
      }
    );
    this.emitProgress(request.generationConfig, 'ai-middle-layer', 100, 'AI middle layer complete.');

    if (request.imageGenerationModel === 'chatgpt-image-generation-2') {
      const openAISourceImage = request.maskImage && request.sourceImage.mimeType !== request.maskImage.mimeType
        ? await ImageUtils.convertImageFormat(request.sourceImage, request.maskImage.mimeType)
        : request.sourceImage;
      const openAIImages = [openAISourceImage];
      if (request.maskImage && maskMode === 'guided') openAIImages.push(request.maskImage);
      if (request.referenceImages?.length) openAIImages.push(...request.referenceImages);

      const result = await this.generateOpenAIImages({
        prompt: optimizedEditPrompt,
        images: openAIImages,
        maskImage: maskMode === 'strict' ? request.maskImage : undefined,
        imageGenerationModel: request.imageGenerationModel,
        generationConfig: request.generationConfig,
      });
      return optimizedEditPrompt !== adaptedEditPrompt
        ? { ...result, optimizedPrompt: optimizedEditPrompt }
        : result;
    }

    return this.generate({
      prompt: optimizedEditPrompt,
      images,
      imageGenerationModel: request.imageGenerationModel,
      promptOptimized: optimizedEditPrompt !== adaptedEditPrompt,
      skipPromptOptimization: true,
      generationConfig: request.generationConfig
    } as InternalGeminiRequest);
  }

  async generateBatchImagesParallel(request: BatchImageRequest): Promise<BatchImageResponse> {
    return this.generateBatchImages(request);
  }

  async verifyImageOutput(request: ImageOutputVerificationRequest): Promise<ImageOutputVerificationResult> {
    const threshold = request.threshold ?? OUTPUT_VERIFICATION_MIN_SCORE;
    const referenceImages = request.referenceImages || [];
    const images = [...referenceImages, request.generatedImage];

    this.emitProgress(request.generationConfig, 'verification', 8, 'Checking generated image...');
    const raw = await this.generateText({
      model: PROMPT_OPTIMIZER_MODEL,
      prompt: this.buildOutputVerificationPrompt(request, referenceImages.length, threshold),
      images,
      generationConfig: {
        temperature: 0.05,
        topP: 0.8,
        maxOutputTokens: OUTPUT_VERIFICATION_MAX_OUTPUT_TOKENS,
        responseModalities: ['TEXT'],
        thinkingConfig: { thinkingLevel: 'high' },
        abortSignal: request.generationConfig?.abortSignal
      }
    });
    this.emitProgress(request.generationConfig, 'verification', 100, 'Output verification complete.');

    return this.parseOutputVerificationResult(raw, request.prompt, threshold);
  }

  // --------------------------------------------------------------------------
  // Batch Text Generation (uses batches API)
  // --------------------------------------------------------------------------

  async generateBatchText(
    requests: GeminiRequest[],
    options: BatchTextOptions = {}
  ): Promise<BatchTextResult[]> {
    if (!requests.length) return [];
    const pollIntervalMs = options.pollIntervalMs ?? 5000;

    const src = requests.map((request) => {
      const contents = this.buildContents(request);
      const { imageConfig: _ic, ...configWithoutImage } = request.generationConfig || {};
      const normalized = this.normalizeThinkingConfig(TEXT_MODEL, {
        ...configWithoutImage,
        responseModalities: ['TEXT'] as Array<'TEXT' | 'IMAGE'>
      });
      const config = this.buildGenerationConfig(normalized, ['TEXT'], TEXT_MODEL);
      return { contents, config };
    });

    // Create batch job via gateway passthrough
    const batchJob = await this.executeWithRetry(() =>
      geminiRequest(TEXT_MODEL, 'batchGenerateContent', {
        requests: src.map(s => ({
          model: `models/${TEXT_MODEL}`,
          contents: s.contents,
          generationConfig: s.config,
        }))
      })
    );

    // If it returns inline responses directly (sync batch)
    if (batchJob.responses) {
      return batchJob.responses.map((resp: any) => {
        if (resp?.candidates?.[0]) {
          const parsed = this.parseResponse(resp);
          return { text: parsed.text };
        }
        return { text: null, error: 'Batch item returned no response.' };
      });
    }

    // Async batch: poll for completion
    let job = batchJob;
    while (true) {
      const state = typeof job.state === 'string' ? job.state : job.state?.name;
      if (state === 'JOB_STATE_SUCCEEDED' || state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') {
        break;
      }
      await this.sleep(pollIntervalMs);
      const { geminiGetOperation } = await import('./apiGateway');
      job = await geminiGetOperation(job.name);
    }

    const finalState = typeof job.state === 'string' ? job.state : job.state?.name;
    if (finalState !== 'JOB_STATE_SUCCEEDED') {
      throw new GeminiError(`Batch job failed: ${finalState || 'unknown'}`);
    }

    const dest = job.dest || {};
    const inlineResponses = dest.inlinedResponses || dest.inlined_responses || dest.inlineResponses || [];

    return inlineResponses.map((response: any) => {
      if (response?.response) {
        const parsed = this.parseResponse(response.response);
        return { text: parsed.text };
      }
      if (response?.error) {
        return { text: null, error: response.error?.message || 'Batch item failed.' };
      }
      return { text: null, error: 'Batch item returned no response.' };
    });
  }

  // --------------------------------------------------------------------------
  // Streaming Support
  // --------------------------------------------------------------------------

  async *generateStream(request: GeminiRequest): AsyncGenerator<Partial<GeminiResponse>> {
    const wantsImage = (request.generationConfig?.responseModalities || ['TEXT', 'IMAGE']).includes('IMAGE');
    const preparedRequest = wantsImage
      ? await this.prepareImageRequest(request, 'generation')
      : request;

    if (wantsImage && this.isOpenAIImageRequest(preparedRequest)) {
      yield this.withOptimizedPrompt(await this.generateOpenAIImages(preparedRequest), preparedRequest);
      return;
    }

    const contents = this.buildContents(preparedRequest);
    const model = preparedRequest.model || this.model;
    const generationConfig = this.buildGenerationConfig(
      preparedRequest.generationConfig,
      preparedRequest.generationConfig?.responseModalities || ['TEXT', 'IMAGE'],
      model
    );

    if (wantsImage && this.usesNonStreamingImageGeneration(model)) {
      this.emitProgress(preparedRequest.generationConfig, 'generation', 5, 'Starting image model request...');
      const response = await this.executeWithRetry(() =>
        geminiRequest(model, 'generateContent', {
          contents,
          generationConfig,
        }, { signal: preparedRequest.generationConfig?.abortSignal })
      );
      this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 35, 'Receiving generated image...');
      const parsed = this.parseResponse(response);
      this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 100, 'Image transfer complete.');
      this.emitProgress(preparedRequest.generationConfig, 'complete', 100);
      if (parsed.text || parsed.images.length > 0) {
        yield this.withOptimizedPrompt(parsed, preparedRequest);
      }
      return;
    }

    this.emitProgress(preparedRequest.generationConfig, 'generation', 5, 'Starting image stream...');
    const response = await geminiStreamRequest(model, {
      contents,
      generationConfig,
    }, { signal: preparedRequest.generationConfig?.abortSignal });
    this.emitProgress(preparedRequest.generationConfig, 'generation', 25, 'Image stream connected.');

    const contentType = response.headers.get('content-type') || '';
    if (!response.body || contentType.includes('application/json')) {
      const json = await response.json();
      const parsed = this.parseResponse(json);
      if (parsed.text || parsed.images.length > 0) {
        yield this.withOptimizedPrompt(parsed, preparedRequest);
      }
      return;
    }

    let accumulatedText = '';
    const accumulatedImages: GeneratedImage[] = [];
    let lastThoughtImage: GeneratedImage | null = null;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const STREAM_READ_TIMEOUT_MS = 30_000;

    let streamChunkCount = 0;

    while (true) {
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Stream stalled: no data received for 30 seconds. Please check your connection and try again.')),
            STREAM_READ_TIMEOUT_MS,
          ),
        ),
      ]);
      if (done) break;
      streamChunkCount += 1;
      if (accumulatedImages.length === 0) {
        this.emitProgress(
          preparedRequest.generationConfig,
          'generation',
          Math.min(82, 30 + streamChunkCount * 6),
          'Generating image...'
        );
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const chunk = JSON.parse(jsonStr);
            const parts = chunk.candidates?.[0]?.content?.parts || [];

            for (const part of parts) {
              const isThought = this.isThoughtPart(part);

              if (!isThought && 'text' in part && part.text) {
                accumulatedText += part.text;
              }
              const imageData = part.inlineData || part.inline_data;
              if (imageData) {
                const mimeType = imageData.mimeType as ImageMimeType;
                const base64 = imageData.data as string;
                if (base64) {
                  const generatedImage = {
                    base64,
                    mimeType,
                    dataUrl: `data:${mimeType};base64,${base64}`
                  };
                  if (isThought) {
                    lastThoughtImage = generatedImage;
                  } else {
                    accumulatedImages.push(generatedImage);
                    this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 85, 'Receiving generated image...');
                  }
                }
              }
            }

            const visibleImages = accumulatedImages.length > 0
              ? accumulatedImages
              : lastThoughtImage
                ? [lastThoughtImage]
                : [];
            yield {
              text: accumulatedText || null,
              images: visibleImages,
              optimizedPrompt: this.getOptimizedPromptForResponse(preparedRequest)
            };
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    }

    // Flush any remaining data left in the buffer after stream ends
    if (buffer.trim() && buffer.startsWith('data: ')) {
      const jsonStr = buffer.slice(6).trim();
      if (jsonStr && jsonStr !== '[DONE]') {
        try {
          const chunk = JSON.parse(jsonStr);
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            const isThought = this.isThoughtPart(part);

            if (!isThought && 'text' in part && part.text) {
              accumulatedText += part.text;
            }
            const imageData = part.inlineData || part.inline_data;
            if (imageData) {
              const mimeType = imageData.mimeType as ImageMimeType;
              const base64 = imageData.data as string;
              if (base64) {
                const generatedImage = {
                  base64,
                  mimeType,
                  dataUrl: `data:${mimeType};base64,${base64}`
                };
                if (isThought) {
                  lastThoughtImage = generatedImage;
                } else {
                  accumulatedImages.push(generatedImage);
                  this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 85, 'Receiving generated image...');
                }
              }
            }
          }
          const visibleImages = accumulatedImages.length > 0
            ? accumulatedImages
            : lastThoughtImage
              ? [lastThoughtImage]
              : [];
          yield {
            text: accumulatedText || null,
            images: visibleImages,
            optimizedPrompt: this.getOptimizedPromptForResponse(preparedRequest)
          };
        } catch {
          // Skip malformed final chunk
        }
      }
    }
    this.emitProgress(preparedRequest.generationConfig, 'image-transfer', 100, 'Image transfer complete.');
    this.emitProgress(preparedRequest.generationConfig, 'complete', 100);
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  private emitProgress(
    generationConfig: GenerationConfig | undefined,
    phase: ImageGenerationProgressPhase,
    progress: number,
    message?: string
  ): void {
    generationConfig?.onProgress?.({
      phase,
      progress: Math.min(100, Math.max(0, progress)),
      message
    });
  }

  private getOptimizedPromptForResponse(request: GeminiRequest | InternalGeminiRequest): string | undefined {
    const prompt = request.prompt?.trim();
    return (request as InternalGeminiRequest).promptOptimized && prompt ? prompt : undefined;
  }

  private withOptimizedPrompt<T extends GeminiResponse>(
    response: T,
    request: GeminiRequest | InternalGeminiRequest
  ): T {
    const optimizedPrompt = this.getOptimizedPromptForResponse(request);
    return optimizedPrompt ? { ...response, optimizedPrompt } : response;
  }

  private async prepareImageRequest(
    request: InternalGeminiRequest,
    promptKind: ImagePromptKind = 'generation'
  ): Promise<InternalGeminiRequest> {
    if (request.promptOptimized) {
      this.emitProgress(request.generationConfig, 'ai-middle-layer', 100, 'Prompt already prepared.');
      return request;
    }

    this.emitProgress(request.generationConfig, 'ai-middle-layer', 8, 'Preparing image prompt...');
    const prompt = this.prepareImagePrompt(request, promptKind);
    const preparedRequest: InternalGeminiRequest = { ...request, prompt };
    this.emitProgress(request.generationConfig, 'ai-middle-layer', 35, 'Image prompt prepared.');

    if (request.skipPromptOptimization) {
      this.emitProgress(request.generationConfig, 'ai-middle-layer', 100, 'AI middle layer complete.');
      return preparedRequest;
    }

    if (!this.shouldOptimizePromptForImageGeneration(prompt, request.images)) {
      this.emitProgress(request.generationConfig, 'ai-middle-layer', 100, 'AI middle layer complete.');
      return preparedRequest;
    }

    this.emitProgress(request.generationConfig, 'ai-middle-layer', 55, 'Optimizing prompt for image model...');
    const optimizedPrompt = await this.optimizePromptForImageGeneration(
      prompt,
      request.images,
      request.generationConfig,
      {
        promptKind,
        imageGenerationModel: request.imageGenerationModel,
        hasMaskImage: Boolean(request.maskImage),
        hasReferenceImages: Boolean(request.images && request.images.length > 1)
      }
    );
    this.emitProgress(request.generationConfig, 'ai-middle-layer', 100, 'AI middle layer complete.');

    return {
      ...preparedRequest,
      prompt: optimizedPrompt,
      promptOptimized: optimizedPrompt !== prompt
    };
  }

  private async optimizePromptForImageGeneration(
    prompt: string,
    images: ImageData[] | undefined,
    generationConfig: GenerationConfig | undefined,
    context: PromptOptimizationContext
  ): Promise<string> {
    if (!this.shouldOptimizePromptForImageGeneration(prompt, images)) {
      return prompt;
    }

    try {
      const optimized = await this.generateText({
        model: PROMPT_OPTIMIZER_MODEL,
        prompt: this.buildPromptOptimizerPrompt(prompt, images, context),
        images,
        generationConfig: {
          temperature: 0.18,
          topP: 0.85,
          maxOutputTokens: PROMPT_OPTIMIZER_MAX_OUTPUT_TOKENS,
          responseModalities: ['TEXT'],
          thinkingConfig: { thinkingLevel: 'high' },
          abortSignal: generationConfig?.abortSignal
        }
      });

      return this.cleanOptimizedPrompt(optimized, prompt);
    } catch (error) {
      console.warn('Prompt optimizer failed; using the original image prompt.', error);
      return prompt;
    }
  }

  private shouldOptimizePromptForImageGeneration(prompt: string, images?: ImageData[]): boolean {
    const normalized = prompt.trim();
    if (!normalized) return false;
    if (ADAPTED_IMAGE_PROMPT_PATTERN.test(normalized)) return true;
    if (images && images.length > 0) return true;
    return normalized.length >= PROMPT_OPTIMIZER_MIN_PROMPT_CHARS_WITHOUT_IMAGES;
  }

  private buildPromptOptimizerPrompt(
    appPrompt: string,
    images: ImageData[] | undefined,
    context: PromptOptimizationContext
  ): string {
    const imageCount = images?.length || 0;
    const imageRelationship = imageCount === 0
      ? 'No images are attached.'
      : context.hasMaskImage
        ? `Attached images: image 1 is the source/current image, image 2 is the mask or selection guidance, and any later images are secondary references.`
        : imageCount === 1
          ? 'Attached image: image 1 is the primary source or visual reference.'
          : `Attached images: image 1 is the primary source/current image, and images 2-${imageCount} are secondary references.`;
    const modelName = context.imageGenerationModel === 'chatgpt-image-generation-2'
      ? 'ChatGPT Image Generation 2'
      : 'Nano Banana Pro / Gemini image';
    const originalUserLine = context.originalUserPrompt?.trim()
      ? `Original user request, before app expansion:\n${this.truncatePromptForOptimizer(context.originalUserPrompt.trim(), 1800)}`
      : '';

    return [
      'You are the prompt optimization layer inside an architectural image generation app.',
      'Your job is to read the app-generated prompt and inspect the attached images, infer the user intent, then rewrite the prompt for the final image model in natural human language.',
      '',
      `Final image model: ${modelName}.`,
      `Prompt kind: ${context.promptKind}.`,
      imageRelationship,
      originalUserLine,
      '',
      'Rewrite goals:',
      '- Keep the essential user intent and the most important visual priorities.',
      '- Preserve source-image relationships, camera, composition, spatial layout, geometry, and existing design when the prompt says the source is locked.',
      '- For edit or mask requests, keep the selected/masked area scope clear and preserve unaffected regions.',
      '- Keep exact visible text, signage, logos, or labels only when the prompt explicitly requires them.',
      '- Keep the few most important material, style, lighting, atmosphere, and quality cues.',
      '- Remove redundant rule lists, internal labels, priority systems, legalistic phrasing, excessive negative instructions, and over-specific micro-control.',
      '- Do not invent new requirements, new objects, new camera moves, or new design changes.',
      '',
      'Output requirements:',
      '- Return one concise prompt only.',
      '- Use natural language, as if an art director is briefing a renderer.',
      '- Prefer one paragraph, two short paragraphs only if the mask/reference relationship needs clarity.',
      '- Do not use markdown, bullets, JSON, quotes, headings, or meta commentary.',
      '- Target roughly 60-180 words, unless the request is extremely simple.',
      '',
      'App-generated prompt to rewrite:',
      this.truncatePromptForOptimizer(appPrompt, PROMPT_OPTIMIZER_MAX_INPUT_CHARS)
    ].filter(Boolean).join('\n');
  }

  private buildOutputVerificationPrompt(
    request: ImageOutputVerificationRequest,
    referenceImageCount: number,
    threshold: number
  ): string {
    const imageRelationship = referenceImageCount === 0
      ? 'Attached image 1 is the generated output to evaluate.'
      : `Attached images 1-${referenceImageCount} are the source/reference inputs. Attached image ${referenceImageCount + 1} is the generated output to evaluate.`;
    const originalPromptLine = request.originalPrompt?.trim()
      ? `Original user/app prompt before middle-layer tuning:\n${this.truncatePromptForOptimizer(request.originalPrompt.trim(), 2000)}`
      : '';

    return [
      'You are the output verification layer inside an architectural image generation app.',
      'Evaluate whether the generated output image satisfies the prompt and respects the attached source/reference images.',
      imageRelationship,
      '',
      'Score the generated output from 0 to 100.',
      `A score of ${threshold} or higher means the image is precise and effective enough to show to the user.`,
      'Score strictly but practically: preserve-source failures, wrong camera/composition, missing requested style/lighting, architectural drift, broken geometry, unwanted text changes, and obvious artifacts should reduce the score.',
      'Do not penalize harmless variation when the prompt asks for a render variation.',
      '',
      'Also detect AI regeneration distortion separately from the pass/fail score.',
      'Mark aiSlopDetected true only when the generated output visibly contains AI degradation such as wavy or wiggly architectural lines, melted/smeared detail, haze or fog not requested, blotchy discoloration, warped signage/text, malformed repeated geometry, distorted people, or over-smoothed regenerated texture.',
      'Do not mark aiSlopDetected true for normal low resolution, intentional stylization, depth-of-field blur, natural atmospheric lighting, or minor compression.',
      'If detected, list the clearest visual indicators and write one short suggestion that this image would benefit from AI Slop upscaling/restoration.',
      '',
      'If the score is below the threshold, write a revised prompt that can be sent directly to the image model with the same reference images. The revised prompt should be natural, concise, and focused on correcting the observed issues while preserving the original intent.',
      'If the score is at or above the threshold, revisedPrompt must be an empty string.',
      '',
      originalPromptLine,
      '',
      'Prompt used for the generated output:',
      this.truncatePromptForOptimizer(request.prompt, OUTPUT_VERIFICATION_MAX_PROMPT_CHARS),
      '',
      'Return only valid JSON with this exact shape:',
      '{"score": number, "summary": "one sentence", "issues": ["issue 1"], "revisedPrompt": "prompt or empty string", "aiSlopDetected": boolean, "aiSlopConfidence": number, "aiSlopIndicators": ["indicator"], "aiSlopSuggestion": "short suggestion or empty string"}'
    ].filter(Boolean).join('\n');
  }

  private truncatePromptForOptimizer(prompt: string, maxChars: number): string {
    if (prompt.length <= maxChars) return prompt;
    const headLength = Math.floor(maxChars * 0.68);
    const tailLength = maxChars - headLength;
    return `${prompt.slice(0, headLength)}\n\n[...middle of app prompt omitted for brevity...]\n\n${prompt.slice(-tailLength)}`;
  }

  private cleanOptimizedPrompt(optimized: string, fallbackPrompt: string): string {
    const strippedFence = optimized
      .replace(/```(?:text|markdown|md)?\s*([\s\S]*?)```/gi, '$1')
      .replace(/^\s*(?:optimized prompt|rewritten prompt|final prompt)\s*:\s*/i, '')
      .trim();
    const withoutWrappingQuotes = strippedFence
      .replace(/^["'`]+/, '')
      .replace(/["'`]+$/, '')
      .trim();
    const normalized = withoutWrappingQuotes.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const refusalPattern = /\b(?:i can(?:not|'t)|i'm unable|i am unable|sorry)\b/i;

    if (normalized.length < 24 || refusalPattern.test(normalized)) {
      return fallbackPrompt;
    }

    return normalized;
  }

  private parseOutputVerificationResult(
    raw: string,
    fallbackPrompt: string,
    threshold: number
  ): ImageOutputVerificationResult {
    const normalized = raw
      .replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1')
      .trim();
    const jsonText = normalized.match(/\{[\s\S]*\}/)?.[0] || normalized;

    try {
      const parsed = JSON.parse(jsonText) as {
        score?: unknown;
        summary?: unknown;
        issues?: unknown;
        revisedPrompt?: unknown;
        aiSlopDetected?: unknown;
        aiSlopConfidence?: unknown;
        aiSlopIndicators?: unknown;
        aiSlopSuggestion?: unknown;
      };
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      const validScore = Number.isFinite(score) ? score : 0;
      const aiSlopConfidence = Math.max(0, Math.min(100, Math.round(Number(parsed.aiSlopConfidence))));
      const validAiSlopConfidence = Number.isFinite(aiSlopConfidence) ? aiSlopConfidence : undefined;
      const issues = Array.isArray(parsed.issues)
        ? parsed.issues
            .map((issue) => typeof issue === 'string' ? issue.trim() : '')
            .filter(Boolean)
            .slice(0, 6)
        : [];
      const aiSlopIndicators = Array.isArray(parsed.aiSlopIndicators)
        ? parsed.aiSlopIndicators
            .map((indicator) => typeof indicator === 'string' ? indicator.trim() : '')
            .filter(Boolean)
            .slice(0, 5)
        : [];
      const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : validScore >= threshold
          ? 'The generated image satisfies the prompt.'
          : 'The generated image does not satisfy the prompt closely enough.';
      const revisedPrompt = typeof parsed.revisedPrompt === 'string'
        ? this.cleanOptimizedPrompt(parsed.revisedPrompt, fallbackPrompt)
        : fallbackPrompt;
      const aiSlopDetected =
        parsed.aiSlopDetected === true ||
        (typeof parsed.aiSlopDetected === 'string' && ['true', 'yes'].includes(parsed.aiSlopDetected.trim().toLowerCase()));
      const aiSlopSuggestion = typeof parsed.aiSlopSuggestion === 'string'
        ? parsed.aiSlopSuggestion.trim()
        : '';

      return {
        score: validScore,
        passed: validScore >= threshold,
        summary,
        issues,
        revisedPrompt: validScore >= threshold ? undefined : revisedPrompt,
        aiSlopDetected,
        aiSlopConfidence: validAiSlopConfidence,
        aiSlopIndicators,
        aiSlopSuggestion: aiSlopDetected && aiSlopSuggestion ? aiSlopSuggestion : undefined
      };
    } catch {
      return {
        score: 0,
        passed: false,
        summary: 'Output verification returned an unreadable response.',
        issues: ['The verifier could not produce a valid score for the generated image.'],
        revisedPrompt: fallbackPrompt,
        aiSlopDetected: false
      };
    }
  }

  private isOpenAIImageRequest(request: GeminiRequest): boolean {
    return request.imageGenerationModel === 'chatgpt-image-generation-2';
  }

  private prepareImagePrompt(
    request: GeminiRequest & { maskImage?: ImageData },
    promptKind: ImagePromptKind = 'generation'
  ): string {
    const prompt = request.prompt || '';
    if (!prompt.trim() || ADAPTED_IMAGE_PROMPT_PATTERN.test(prompt)) return prompt;

    return adaptPromptForImageGenerationModel(
      prompt,
      request.imageGenerationModel || 'nano-banana',
      {
        mode: request.maskImage ? 'visual-edit' : 'generate-text',
        hasSourceImage: Boolean(request.images?.length),
        hasReferenceImages: Boolean(request.images && request.images.length > 1),
        promptKind
      }
    );
  }

  private async generateOpenAIImages(
    request: GeminiRequest & { numberOfImages?: number; maskImage?: ImageData }
  ): Promise<GeminiResponse> {
    this.emitProgress(request.generationConfig, 'generation', 5, 'Starting image model request...');
    const response = await this.executeWithRetry(() =>
      openAIImageRequest({
        model: OPENAI_IMAGE_MODEL,
        prompt: request.prompt,
        images: request.images,
        maskImage: request.maskImage,
        numberOfImages: request.numberOfImages || 1,
        generationConfig: request.generationConfig,
      }, { signal: request.generationConfig?.abortSignal })
    );
    this.emitProgress(request.generationConfig, 'image-transfer', 35, 'Receiving generated image...');

    const parsed = this.parseOpenAIResponse(response);
    this.emitProgress(request.generationConfig, 'image-transfer', 100, 'Image transfer complete.');
    this.emitProgress(request.generationConfig, 'complete', 100);
    return parsed;
  }

  private buildContents(request: GeminiRequest): Array<{ role: 'user'; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }> {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    const attachments = request.attachments || [];
    const hasNonImageAttachment = attachments.some((attachment) => !attachment.mimeType.startsWith('image/'));

    if (hasNonImageAttachment) {
      if (request.prompt) parts.push({ text: request.prompt });
      for (const attachment of attachments) {
        parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
      }
      if (request.images) {
        for (const image of request.images) {
          parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
        }
      }
    } else {
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
        }
      }
      if (request.images) {
        for (const image of request.images) {
          parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
        }
      }
      if (request.prompt) parts.push({ text: request.prompt });
    }

    return [{ role: 'user', parts }];
  }

  /** Build REST API generationConfig from our GenerationConfig type */
  private buildGenerationConfig(
    config: GenerationConfig | undefined,
    defaultModalities: Array<'TEXT' | 'IMAGE'>,
    model = this.model
  ): Record<string, any> {
    const requestedModalities = config?.responseModalities || defaultModalities;
    const normalizedConfig = this.normalizeThinkingConfig(model, {
      ...(config || {}),
      responseModalities: requestedModalities,
    });

    const {
      abortSignal,
      responseFormat,
      openAI,
      imageConfig,
      responseModalities,
      thinkingConfig,
      onProgress,
      ...rest
    } = normalizedConfig;
    const wantsImage = (responseModalities || requestedModalities).includes('IMAGE');
    const responseImageConfig = responseFormat?.image || imageConfig;
    const result: Record<string, any> = {
      ...rest,
    };
    if (!wantsImage && thinkingConfig && Object.keys(thinkingConfig).length > 0) {
      result.thinkingConfig = thinkingConfig;
    }
    if (wantsImage && responseImageConfig) {
      if (this.usesResponseFormatImageConfig(model)) {
        result.responseFormat = { image: responseImageConfig };
      } else {
        result.imageConfig = responseImageConfig;
      }
    }

    return result;
  }

  private usesNonStreamingImageGeneration(model: string): boolean {
    return this.usesGemini3ImageApiShape(model);
  }

  private usesResponseFormatImageConfig(model: string): boolean {
    return this.usesGemini3ImageApiShape(model);
  }

  private usesGemini3ImageApiShape(model: string): boolean {
    const modelId = model.toLowerCase();
    return modelId.startsWith('gemini-3') && modelId.includes('image');
  }

  private normalizeThinkingConfig(model: string, config: GenerationConfig): GenerationConfig {
    const modelId = model.toLowerCase();
    const isGemini3 = modelId.startsWith('gemini-3');
    const isGemini25 = modelId.startsWith('gemini-2.5');

    if (!isGemini3 && !isGemini25) return config;

    const incomingThinking = config.thinkingConfig || {};
    const thinkingConfig: GenerationConfig['thinkingConfig'] = { ...incomingThinking };

    if (isGemini3) {
      if ('thinkingBudget' in thinkingConfig) {
        delete (thinkingConfig as { thinkingBudget?: number }).thinkingBudget;
      }
      if (
        !thinkingConfig.thinkingLevel ||
        thinkingConfig.thinkingLevel === 'minimal' ||
        thinkingConfig.thinkingLevel === 'low'
      ) {
        thinkingConfig.thinkingLevel = 'medium';
      }
    } else {
      if ('thinkingLevel' in thinkingConfig) {
        delete (thinkingConfig as { thinkingLevel?: string }).thinkingLevel;
      }
      if (
        typeof thinkingConfig.thinkingBudget !== 'number' ||
        (thinkingConfig.thinkingBudget <= 0 && thinkingConfig.thinkingBudget !== -1)
      ) {
        thinkingConfig.thinkingBudget = -1;
      }
    }

    return { ...config, thinkingConfig };
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message?.toLowerCase() || '';
        const isRetryable =
          errorMessage.includes('rate') ||
          errorMessage.includes('429') ||
          errorMessage.includes('500') ||
          errorMessage.includes('503') ||
          errorMessage.includes('timeout');

        if (isRetryable && attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.sleep(delay);
          continue;
        }

        throw new GeminiError(
          lastError.message || 'Request failed',
          (lastError as Error & { code?: string }).code,
          (lastError as Error & { status?: number }).status,
          lastError
        );
      }
    }

    throw lastError || new GeminiError('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseResponse(response: any): GeminiResponse {
    // Handle JSON array responses (streamGenerateContent without ?alt=sse)
    const chunks = Array.isArray(response) ? response : [response];

    const result: GeminiResponse = {
      text: null,
      images: [],
      finishReason: chunks[chunks.length - 1]?.candidates?.[0]?.finishReason
    };
    const thoughtImages: GeneratedImage[] = [];

    for (const chunk of chunks) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        const isThought = this.isThoughtPart(part);

        if (!isThought && 'text' in part && part.text) {
          result.text = (result.text || '') + part.text;
        }

        const imageData = part.inlineData || part.inline_data;
        if (imageData) {
          const mimeType = imageData.mimeType as ImageMimeType;
          const base64 = imageData.data as string;
          if (base64) {
            const generatedImage = {
              base64,
              mimeType,
              dataUrl: `data:${mimeType};base64,${base64}`
            };
            if (isThought) {
              thoughtImages.push(generatedImage);
            } else {
              result.images.push(generatedImage);
            }
          }
        }
      }
    }

    if (result.images.length === 0 && thoughtImages.length > 0) {
      result.images.push(thoughtImages[thoughtImages.length - 1]);
    }

    return result;
  }

  private parseOpenAIResponse(response: any): GeminiResponse {
    const outputFormat = response?.output_format || response?.outputFormat || 'png';
    const defaultMimeType = (outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`) as ImageMimeType;
    const responseImages = Array.isArray(response?.images)
      ? response.images
      : Array.isArray(response?.data)
        ? response.data
        : [];
    const images: GeneratedImage[] = responseImages.length > 0
      ? responseImages
          .map((image: any): GeneratedImage | null => {
            const base64 = image?.base64 || image?.b64_json;
            if (!base64 || typeof base64 !== 'string') return null;
            const mimeType = (image?.mimeType || image?.mime_type || defaultMimeType) as ImageMimeType;
            return {
              base64,
              mimeType,
              dataUrl: image?.dataUrl || `data:${mimeType};base64,${base64}`,
            };
          })
          .filter((image: GeneratedImage | null): image is GeneratedImage => Boolean(image))
      : [];

    return {
      text: typeof response?.text === 'string' ? response.text : null,
      images,
      finishReason: response?.finishReason,
    };
  }

  private isThoughtPart(part: any): boolean {
    return part?.thought === true;
  }
}

// ============================================================================
// Singleton Instance & Factory
// ============================================================================

let serviceInstance: GeminiService | null = null;

export function initGeminiService(config: GeminiConfig = {}): GeminiService {
  serviceInstance = new GeminiService(config);
  return serviceInstance;
}

export function getGeminiService(): GeminiService {
  if (!serviceInstance) {
    throw new GeminiError('Gemini service not initialized. Call initGeminiService first.');
  }
  return serviceInstance;
}

export function isGeminiServiceInitialized(): boolean {
  return serviceInstance !== null;
}

export default GeminiService;
