/**
 * Gemini API Service
 * All calls go through the API gateway (Cloudflare Worker) — no API keys in the client.
 * Public API is unchanged from the SDK-based version.
 */

import { geminiRequest, geminiStreamRequest } from './apiGateway';

// ============================================================================
// Types & Interfaces
// ============================================================================

export const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
export const IMAGE_MODEL = 'gemini-3-pro-image-preview';
export const TEXT_MODEL = 'gemini-3-pro-preview';

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
  prompt: string;
  editType: 'inpaint' | 'outpaint' | 'style-transfer' | 'enhance' | 'remove' | 'replace';
  generationConfig?: GenerationConfig;
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
    const baseConfig = { ...request.generationConfig, responseModalities: ['TEXT'] as Array<'TEXT' | 'IMAGE'> };
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

    switch (request.editType) {
      case 'inpaint':
        editPrompt = `Edit this image by replacing the masked area with: ${request.prompt}. Maintain seamless blending.`;
        break;
      case 'outpaint':
        editPrompt = `Extend this image by adding: ${request.prompt}. Match the existing style seamlessly.`;
        break;
      case 'style-transfer':
        editPrompt = `Transform this image to have the following style: ${request.prompt}. Maintain composition.`;
        break;
      case 'enhance':
        editPrompt = `Enhance this image: ${request.prompt}. Improve quality while preserving content.`;
        break;
      case 'remove':
        editPrompt = `Remove the following from this image: ${request.prompt}. Fill naturally.`;
        break;
      case 'replace':
        editPrompt = `Replace the selected area with: ${request.prompt}. Blend seamlessly.`;
        break;
    }

    const images: ImageData[] = [request.sourceImage];
    if (request.maskImage) images.push(request.maskImage);

    return this.generate({
      prompt: editPrompt,
      images,
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
      const normalized = this.normalizeThinkingConfig(TEXT_MODEL, {
        ...request.generationConfig,
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

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
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
              if ('text' in part && part.text) {
                accumulatedText += part.text;
              }
              const imageData = part.inlineData || part.inline_data;
              if (imageData) {
                const mimeType = imageData.mimeType as ImageMimeType;
                const base64 = imageData.data as string;
                if (base64) {
                  accumulatedImages.push({
                    base64,
                    mimeType,
                    dataUrl: `data:${mimeType};base64,${base64}`
                  });
                }
              }
            }

            yield {
              text: accumulatedText || null,
              images: accumulatedImages
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
            if ('text' in part && part.text) {
              accumulatedText += part.text;
            }
            const imageData = part.inlineData || part.inline_data;
            if (imageData) {
              const mimeType = imageData.mimeType as ImageMimeType;
              const base64 = imageData.data as string;
              if (base64) {
                accumulatedImages.push({
                  base64,
                  mimeType,
                  dataUrl: `data:${mimeType};base64,${base64}`
                });
              }
            }
          }
          yield {
            text: accumulatedText || null,
            images: accumulatedImages
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

    const { abortSignal, imageConfig, ...rest } = config;
    const result: Record<string, any> = {
      ...rest,
      responseModalities: config.responseModalities || defaultModalities,
    };
    if (imageConfig) result.imageConfig = imageConfig;
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

    for (const chunk of chunks) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if ('text' in part && part.text) {
          result.text = (result.text || '') + part.text;
        }

        const imageData = part.inlineData || part.inline_data;
        if (imageData) {
          const mimeType = imageData.mimeType as ImageMimeType;
          const base64 = imageData.data as string;
          if (base64) {
            result.images.push({
              base64,
              mimeType,
              dataUrl: `data:${mimeType};base64,${base64}`
            });
          }
        }
      }
    }

    return result;
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
