/**
 * Gemini API Service
 * All calls go through the API gateway (Cloudflare Worker) — no API keys in the client.
 * Public API is unchanged from the SDK-based version.
 */

import { geminiRequest, geminiStreamRequest, openAIImageRequest } from './apiGateway';
import { type ImageGenerationModel } from '../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
export const IMAGE_MODEL = 'gemini-3-pro-image-preview';
export const TEXT_MODEL = 'gemini-3-pro-preview';
export const OPENAI_IMAGE_MODEL = 'gpt-image-2';

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
}

export interface GeminiResponse {
  text: string | null;
  images: GeneratedImage[];
  finishReason?: string;
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
  abortSignal?: AbortSignal;
  imageGenerationModel?: ImageGenerationModel;
}

export interface BatchImageResponse {
  images: GeneratedImage[];
  text: string | null;
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
    if (this.isOpenAIImageRequest(request)) {
      return this.generateOpenAIImages(request);
    }

    const contents = this.buildContents(request);
    const generationConfig = this.buildGenerationConfig(request.generationConfig, ['TEXT', 'IMAGE']);

    const response = await this.executeWithRetry(() =>
      geminiRequest(this.model, 'generateContent', {
        contents,
        generationConfig,
      }, { signal: request.generationConfig?.abortSignal })
    );

    return this.parseResponse(response);
  }

  async generateText(request: GeminiRequest): Promise<string> {
    const contents = this.buildContents(request);
    const model = request.model || TEXT_MODEL;
    const { imageConfig: _ic, ...configWithoutImage } = request.generationConfig || {};
    const baseConfig = { ...configWithoutImage, responseModalities: ['TEXT'] as Array<'TEXT' | 'IMAGE'> };
    const normalized = this.normalizeThinkingConfig(model, baseConfig);
    const generationConfig = this.buildGenerationConfig(normalized, ['TEXT']);

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
    if (this.isOpenAIImageRequest(request)) {
      return this.generateOpenAIImages(request);
    }

    const imagePrompt = request.prompt.includes('generate') || request.prompt.includes('create')
      ? request.prompt
      : `Generate an image: ${request.prompt}`;

    const contents = this.buildContents({ ...request, prompt: imagePrompt });
    const generationConfig = this.buildGenerationConfig(request.generationConfig, ['TEXT', 'IMAGE']);

    const response = await this.executeWithRetry(() =>
      geminiRequest(IMAGE_MODEL, 'generateContent', {
        contents,
        generationConfig,
      }, { signal: request.generationConfig?.abortSignal })
    );

    return this.parseResponse(response);
  }

  // --------------------------------------------------------------------------
  // Batch Image Generation
  // --------------------------------------------------------------------------

  async generateBatchImages(request: BatchImageRequest): Promise<BatchImageResponse> {
    const numberOfImages = Math.min(Math.max(1, request.numberOfImages), 8);
    const promises: Promise<GeminiResponse>[] = [];

    for (let i = 0; i < numberOfImages; i++) {
      const prompt = numberOfImages > 1
        ? `${request.prompt} (Variation ${i + 1})`
        : request.prompt;

      promises.push(
        this.generateImages({
          prompt,
          images: request.referenceImages,
          imageGenerationModel: request.imageGenerationModel,
          generationConfig: {
            imageConfig: request.imageConfig,
            abortSignal: request.abortSignal
          }
        })
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
      text: combinedText.trim() || null
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

    const config = this.buildGenerationConfig(generationConfig, generationConfig?.responseModalities || ['TEXT', 'IMAGE']);

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
    const maskMode = request.maskMode ?? 'strict';
    const referenceInstructions = referenceCount > 0
      ? ` Additional reference image${referenceCount > 1 ? 's' : ''} follow the source${request.maskImage ? ' and mask' : ''}. Reference relationship: use ${referenceCount > 1 ? 'these references' : 'this reference'} only for the explicit visual target described in the edit prompt, such as material color, pattern, texture scale, roughness, reflectivity, grain direction, joints, seams, object identity, or style cues. Do not copy unrelated reference-image framing, camera angle, background, people, signage, logos, or composition; do not add a reference image as a pasted object unless the edit prompt explicitly asks for object insertion.`
      : '';
    const cameraAndTextLock = [
      'Preserve the original camera position, field of view, horizon, crop, perspective, and aspect ratio unless the edit type explicitly changes the canvas.',
      'Preserve existing text, signage, numbers, logos, labels, UI marks, and graphic blocks as source-faithful shapes. Do not translate, rewrite, correct, invent, blur, or remove text unless the edit prompt explicitly requests text editing.',
      'All unaffected regions must remain visually identical in layout, object count, geometry, material boundaries, shadows, reflections, and scale relationships.'
    ].join(' ');
    const maskScopeInstructions = maskMode === 'guided'
      ? [
          'Use the white mask pixels as spatial guidance for the user-selected target area, not as a hard pasted cutout or alpha edge.',
          'You may naturally reconstruct and blend nearby pixels just beyond the mask where required for texture continuation, shadows, reflections, occlusion, or cleanup.',
          'Preserve unrelated architecture, materials, people, signage, camera, perspective, and overall composition.',
          'Never draw, expose, fill, or preserve the black-and-white mask itself in the final image; no white blobs, blank patches, outlines, labels, or visible mask artifacts.'
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
          '2. A black-and-white selection mask with the same framing as the source image.',
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
      'For removal requests, treat the selection mask as target guidance for the complete subject centered inside the selected area, not as a request to remove only small high-contrast fragments.',
      'If the centered target is a person, remove the entire person silhouette: head, torso, limbs, clothing, hair, hands, feet, carried bags, wheeled luggage, straps, personal items, contact shadows, and reflections.',
      'If the whole person or object extends slightly beyond the white mask, remove those connected parts too when needed so no body, accessory, shadow, or ghosted remnant remains.',
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
          ? `${maskInstructions} Apply the requested edit to the target indicated by the selection mask: ${request.prompt}. Keep the edit focused on the selected content while allowing seamless reconstruction beyond the mask edge when visually necessary.`
          : `${maskInstructions} Edit only the allowed masked area according to this instruction: ${request.prompt}. Maintain seamless blending at the mask boundary.`;
        break;
      case 'outpaint':
        editPrompt = `Extend this image by adding: ${request.prompt}. Match the existing style seamlessly. Continue the source perspective lines, horizon, lighting direction, materials, shadows, reflections, and visible text/signage shapes into the new canvas area. Do not change existing source pixels unless needed only at the extension seam.`;
        break;
      case 'style-transfer':
        editPrompt = `${maskInstructions} Transform only the existing target surface or object finish requested here: ${request.prompt}. This is a material/color/finish edit only, not object generation. Preserve the source image composition, camera, geometry, object count, object positions, silhouettes, edges, seams, signage, people, floors, walls, ceilings, furniture, belts, posts, counters, and all unrelated materials. Do not add, remove, duplicate, enlarge, replace, or rearrange any elements. If a target is ambiguous, edit only the clearly matching existing surface and leave uncertain areas unchanged.`;
        break;
      case 'enhance':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Apply the enhancement primarily to the target indicated by the selection mask. ${highFidelityEnhanceInstructions} User enhancement request: ${request.prompt}.`
          : `${maskInstructions} ${highFidelityEnhanceInstructions} User enhancement request: ${request.prompt}.`;
        break;
      case 'remove':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} ${guidedRemoveTargetInstructions} Remove the unwanted content indicated by the selection mask as requested: ${request.prompt}. Reconstruct the revealed floor, reflections, shadows, texture, and perspective from surrounding context so the object looks like it was never there. Do not leave a flat blank, white patch, masked silhouette, or smudged hole.`
          : `${maskInstructions} ${strictRemoveTargetInstructions} Remove only the content inside the allowed masked area as requested: ${request.prompt}. Fill naturally using the surrounding context while preserving every locked pixel.`;
        break;
      case 'replace':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Replace the target indicated by the selection mask with: ${request.prompt}. Keep the replacement anchored to the selected content while allowing natural blending, contact shadows, reflections, and occlusion beyond the mask edge where necessary.`
          : `${maskInstructions} Replace only the allowed masked area with: ${request.prompt}. Blend seamlessly at the boundary and preserve every locked pixel.`;
        break;
      case 'people':
        editPrompt = maskMode === 'guided'
          ? `${maskInstructions} Edit the human figures and their immediate personal accessories indicated by the selection mask according to this instruction: ${request.prompt}. Do not render any part of the instruction as visible text, captions, labels, handwriting, signage, UI, or graphic overlays. Replace or refine the targeted people only; preserve architecture, floors, furniture, signage, lighting, camera, and perspective. Selected non-person pixels are context and must be naturally reconstructed around the people, not filled with text, white shapes, or decorative marks.`
          : `${maskInstructions} Edit only human figures and their immediate personal accessories inside the allowed masked area according to this instruction: ${request.prompt}. Do not render any part of the instruction as visible text, captions, labels, handwriting, signage, UI, or graphic overlays. Replace or refine the selected people only; preserve architecture, floors, furniture, signage, lighting, camera, perspective, and every locked pixel. Selected non-person pixels are context and must be naturally reconstructed, not filled with text or decorative marks.`;
        break;
    }

    const images: ImageData[] = [request.sourceImage];
    if (request.maskImage) images.push(request.maskImage);
    if (request.referenceImages?.length) images.push(...request.referenceImages);

    if (request.imageGenerationModel === 'chatgpt-image-generation-2') {
      const openAIImages = [request.sourceImage];
      if (request.referenceImages?.length) openAIImages.push(...request.referenceImages);

      return this.generateOpenAIImages({
        prompt: editPrompt,
        images: openAIImages,
        maskImage: request.maskImage,
        imageGenerationModel: request.imageGenerationModel,
        generationConfig: request.generationConfig,
      });
    }

    return this.generate({
      prompt: editPrompt,
      images,
      imageGenerationModel: request.imageGenerationModel,
      generationConfig: request.generationConfig
    });
  }

  async generateBatchImagesParallel(request: BatchImageRequest): Promise<BatchImageResponse> {
    return this.generateBatchImages(request);
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
      const config = this.buildGenerationConfig(normalized, ['TEXT']);
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
    const contents = this.buildContents(request);
    const generationConfig = this.buildGenerationConfig(request.generationConfig, request.generationConfig?.responseModalities || ['TEXT', 'IMAGE']);

    const model = request.model || this.model;
    const response = await geminiStreamRequest(model, {
      contents,
      generationConfig,
    }, { signal: request.generationConfig?.abortSignal });

    const contentType = response.headers.get('content-type') || '';
    if (!response.body || contentType.includes('application/json')) {
      const json = await response.json();
      const parsed = this.parseResponse(json);
      if (parsed.text || parsed.images.length > 0) {
        yield parsed;
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
              images: visibleImages
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
            images: visibleImages
          };
        } catch {
          // Skip malformed final chunk
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  private isOpenAIImageRequest(request: GeminiRequest): boolean {
    return request.imageGenerationModel === 'chatgpt-image-generation-2';
  }

  private async generateOpenAIImages(
    request: GeminiRequest & { numberOfImages?: number; maskImage?: ImageData }
  ): Promise<GeminiResponse> {
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

    return this.parseOpenAIResponse(response);
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
    defaultModalities: Array<'TEXT' | 'IMAGE'>
  ): Record<string, any> {
    if (!config) return { responseModalities: defaultModalities };

    const { abortSignal, responseFormat, ...rest } = config;
    const result: Record<string, any> = {
      ...rest,
      responseModalities: config.responseModalities || defaultModalities,
    };

    return result;
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
      if (!thinkingConfig.thinkingLevel) thinkingConfig.thinkingLevel = 'low';
    } else {
      if ('thinkingLevel' in thinkingConfig) {
        delete (thinkingConfig as { thinkingLevel?: string }).thinkingLevel;
      }
      if (typeof thinkingConfig.thinkingBudget !== 'number' || thinkingConfig.thinkingBudget <= 0) {
        thinkingConfig.thinkingBudget = 256;
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
          undefined,
          undefined,
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
    const images: GeneratedImage[] = Array.isArray(response?.images)
      ? response.images
          .map((image: any): GeneratedImage | null => {
            const base64 = image?.base64 || image?.b64_json;
            if (!base64 || typeof base64 !== 'string') return null;
            const mimeType = (image?.mimeType || image?.mime_type || 'image/png') as ImageMimeType;
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
