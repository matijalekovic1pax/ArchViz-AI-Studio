/**
 * Gemini API Service
 * Handles all communication with Google's Gemini API for multimodal AI generation
 * Supports: text + images input, text + images output, batch image generation
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

// Model can be any valid Gemini/Imagen model ID string
// Common models:
//   - 'gemini-2.0-flash-exp' (fast, multimodal)
//   - 'gemini-1.5-pro' (advanced reasoning)
//   - 'imagen-3.0-generate-002' (image generation)
//   - Or any custom/preview model ID
export type GeminiModel = string;

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export interface GeminiConfig {
  apiKey: string;
  model?: GeminiModel;
  baseUrl?: string;
}

export interface ImageData {
  base64: string;          // Base64-encoded image data (without data URI prefix)
  mimeType: ImageMimeType;
  width?: number;
  height?: number;
}

export interface GeminiRequest {
  prompt: string;
  images?: ImageData[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
}

export interface GenerationConfig {
  temperature?: number;       // 0.0 - 2.0, default 1.0
  topP?: number;              // 0.0 - 1.0
  topK?: number;              // 1 - 100
  maxOutputTokens?: number;   // Max tokens in response
  stopSequences?: string[];
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: object;    // For structured JSON output
}

export interface SafetySetting {
  category:
    | 'HARM_CATEGORY_HARASSMENT'
    | 'HARM_CATEGORY_HATE_SPEECH'
    | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
    | 'HARM_CATEGORY_DANGEROUS_CONTENT';
  threshold:
    | 'BLOCK_NONE'
    | 'BLOCK_ONLY_HIGH'
    | 'BLOCK_MEDIUM_AND_ABOVE'
    | 'BLOCK_LOW_AND_ABOVE';
}

export interface GeminiResponse {
  text: string | null;
  images: GeneratedImage[];
  usage?: UsageMetadata;
  finishReason?: string;
  safetyRatings?: SafetyRating[];
}

export interface GeneratedImage {
  base64: string;
  mimeType: ImageMimeType;
  dataUrl: string;           // Complete data URL for direct use in <img> tags
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface SafetyRating {
  category: string;
  probability: string;
}

export interface BatchImageRequest {
  prompt: string;
  referenceImages?: ImageData[];
  numberOfImages: number;     // 1-4 for Gemini
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  generationConfig?: GenerationConfig;
}

export interface BatchImageResponse {
  images: GeneratedImage[];
  text: string | null;
  usage?: UsageMetadata;
}

export interface ImageEditRequest {
  sourceImage: ImageData;
  maskImage?: ImageData;      // For inpainting
  prompt: string;
  editType: 'inpaint' | 'outpaint' | 'style-transfer' | 'enhance';
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
  /**
   * Convert a File to ImageData
   */
  static async fileToImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        const mimeType = file.type as ImageMimeType;

        // Get dimensions
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

  /**
   * Convert a data URL to ImageData
   */
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

  /**
   * Convert ImageData to a data URL
   */
  static imageDataToDataUrl(imageData: ImageData): string {
    return `data:${imageData.mimeType};base64,${imageData.base64}`;
  }

  /**
   * Convert a URL to ImageData (fetches and converts)
   */
  static async urlToImageData(url: string): Promise<ImageData> {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'image', { type: blob.type });
    return this.fileToImageData(file);
  }

  /**
   * Resize an image to fit within max dimensions while maintaining aspect ratio
   */
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

  /**
   * Compress an image to reduce file size
   */
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
// Main Gemini Service
// ============================================================================

export class GeminiService {
  private apiKey: string;
  private model: GeminiModel;
  private baseUrl: string;

  constructor(config: GeminiConfig) {
    if (!config.apiKey) {
      throw new GeminiError('API key is required');
    }
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-2.0-flash-exp';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Update the model being used
   */
  setModel(model: GeminiModel): void {
    this.model = model;
  }

  /**
   * Get the current model
   */
  getModel(): GeminiModel {
    return this.model;
  }

  // --------------------------------------------------------------------------
  // Core Generation Methods
  // --------------------------------------------------------------------------

  /**
   * Main generation method - supports text + images input, text + images output
   */
  async generate(request: GeminiRequest): Promise<GeminiResponse> {
    const parts = this.buildRequestParts(request);

    const requestBody = {
      contents: [{
        parts
      }],
      generationConfig: {
        ...request.generationConfig,
        // Enable image generation in response
        responseModalities: ['TEXT', 'IMAGE']
      },
      safetySettings: request.safetySettings || this.getDefaultSafetySettings()
    };

    const response = await this.makeRequest(requestBody);
    return this.parseResponse(response);
  }

  /**
   * Generate text-only response (no images in output)
   */
  async generateText(request: GeminiRequest): Promise<string> {
    const parts = this.buildRequestParts(request);

    const requestBody = {
      contents: [{
        parts
      }],
      generationConfig: {
        ...request.generationConfig,
        responseModalities: ['TEXT']
      },
      safetySettings: request.safetySettings || this.getDefaultSafetySettings()
    };

    const response = await this.makeRequest(requestBody);
    const parsed = this.parseResponse(response);
    return parsed.text || '';
  }

  /**
   * Generate images with optional text response
   * This is the main method for image generation
   */
  async generateImages(request: GeminiRequest): Promise<GeminiResponse> {
    // For image generation, modify the prompt to request images
    const imagePrompt = request.prompt.includes('generate') || request.prompt.includes('create')
      ? request.prompt
      : `Generate an image: ${request.prompt}`;

    const parts = this.buildRequestParts({ ...request, prompt: imagePrompt });

    const requestBody = {
      contents: [{
        parts
      }],
      generationConfig: {
        ...request.generationConfig,
        responseModalities: ['TEXT', 'IMAGE']
      },
      safetySettings: request.safetySettings || this.getDefaultSafetySettings()
    };

    const response = await this.makeRequest(requestBody);
    return this.parseResponse(response);
  }

  // --------------------------------------------------------------------------
  // Batch Image Generation
  // --------------------------------------------------------------------------

  /**
   * Generate multiple images in a single batch request
   * Gemini supports generating up to 4 images per request
   */
  async generateBatchImages(request: BatchImageRequest): Promise<BatchImageResponse> {
    const numberOfImages = Math.min(Math.max(1, request.numberOfImages), 4);

    // Build prompt that explicitly requests multiple images
    let prompt = request.prompt;
    if (numberOfImages > 1) {
      prompt = `Generate ${numberOfImages} different variations of the following: ${request.prompt}.
Each image should be unique but maintain the same theme and quality.`;
    }

    // Add aspect ratio instruction if specified
    if (request.aspectRatio) {
      prompt += ` The images should have a ${request.aspectRatio} aspect ratio.`;
    }

    const parts = this.buildRequestParts({
      prompt,
      images: request.referenceImages,
      generationConfig: request.generationConfig
    });

    const requestBody = {
      contents: [{
        parts
      }],
      generationConfig: {
        ...request.generationConfig,
        responseModalities: ['TEXT', 'IMAGE'],
        // Request multiple candidates for batch generation
        candidateCount: 1 // Gemini handles multiple images in single response
      },
      safetySettings: this.getDefaultSafetySettings()
    };

    const response = await this.makeRequest(requestBody);
    const parsed = this.parseResponse(response);

    return {
      images: parsed.images,
      text: parsed.text,
      usage: parsed.usage
    };
  }

  /**
   * Generate multiple images in parallel using separate requests
   * Use this when you need more than 4 images or want maximum variation
   */
  async generateBatchImagesParallel(
    request: BatchImageRequest,
    maxConcurrent: number = 3
  ): Promise<BatchImageResponse> {
    const numberOfImages = request.numberOfImages;
    const batches: Promise<GeminiResponse>[] = [];

    // Create individual requests for each image
    for (let i = 0; i < numberOfImages; i++) {
      const variedPrompt = `${request.prompt} (Variation ${i + 1} of ${numberOfImages})`;

      batches.push(
        this.generateImages({
          prompt: variedPrompt,
          images: request.referenceImages,
          generationConfig: {
            ...request.generationConfig,
            // Add slight temperature variation for diversity
            temperature: (request.generationConfig?.temperature || 1.0) + (i * 0.05)
          }
        })
      );
    }

    // Execute in batches to respect rate limits
    const results: GeminiResponse[] = [];
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const batch = batches.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    // Collect all images from results
    const allImages: GeneratedImage[] = [];
    let combinedText = '';
    let totalUsage: UsageMetadata = {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0
    };

    for (const result of results) {
      allImages.push(...result.images);
      if (result.text) {
        combinedText += result.text + '\n';
      }
      if (result.usage) {
        totalUsage.promptTokenCount += result.usage.promptTokenCount;
        totalUsage.candidatesTokenCount += result.usage.candidatesTokenCount;
        totalUsage.totalTokenCount += result.usage.totalTokenCount;
      }
    }

    return {
      images: allImages,
      text: combinedText.trim() || null,
      usage: totalUsage
    };
  }

  // --------------------------------------------------------------------------
  // Image Editing Methods
  // --------------------------------------------------------------------------

  /**
   * Edit an existing image based on a prompt
   */
  async editImage(request: ImageEditRequest): Promise<GeminiResponse> {
    let editPrompt = request.prompt;

    // Construct edit-specific prompt
    switch (request.editType) {
      case 'inpaint':
        editPrompt = `Edit this image by replacing the masked area with: ${request.prompt}. Maintain seamless blending with the surrounding area.`;
        break;
      case 'outpaint':
        editPrompt = `Extend this image by adding: ${request.prompt}. Ensure the extension seamlessly matches the existing image style.`;
        break;
      case 'style-transfer':
        editPrompt = `Transform this image to have the following style: ${request.prompt}. Maintain the composition and subject matter.`;
        break;
      case 'enhance':
        editPrompt = `Enhance this image: ${request.prompt}. Improve quality while preserving the original content.`;
        break;
    }

    const images: ImageData[] = [request.sourceImage];
    if (request.maskImage) {
      images.push(request.maskImage);
    }

    return this.generate({
      prompt: editPrompt,
      images,
      generationConfig: request.generationConfig
    });
  }

  // --------------------------------------------------------------------------
  // Streaming Support
  // --------------------------------------------------------------------------

  /**
   * Generate content with streaming response
   * Yields partial results as they become available
   */
  async *generateStream(request: GeminiRequest): AsyncGenerator<Partial<GeminiResponse>> {
    const parts = this.buildRequestParts(request);

    const requestBody = {
      contents: [{
        parts
      }],
      generationConfig: {
        ...request.generationConfig,
        responseModalities: ['TEXT', 'IMAGE']
      },
      safetySettings: request.safetySettings || this.getDefaultSafetySettings()
    };

    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new GeminiError(
        errorData.error?.message || 'Stream request failed',
        errorData.error?.code,
        response.status,
        errorData
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new GeminiError('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const accumulatedImages: GeneratedImage[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const parsed = this.parseStreamChunk(chunk);

            if (parsed.text) {
              accumulatedText += parsed.text;
            }
            if (parsed.images?.length) {
              accumulatedImages.push(...parsed.images);
            }

            yield {
              text: accumulatedText,
              images: accumulatedImages
            };
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Chat/Conversation Support
  // --------------------------------------------------------------------------

  /**
   * Send a message in a conversation context
   */
  async chat(
    messages: Array<{ role: 'user' | 'model'; content: string; images?: ImageData[] }>,
    generationConfig?: GenerationConfig
  ): Promise<GeminiResponse> {
    const contents = messages.map(msg => ({
      role: msg.role,
      parts: [
        { text: msg.content },
        ...(msg.images?.map(img => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        })) || [])
      ]
    }));

    const requestBody = {
      contents,
      generationConfig: {
        ...generationConfig,
        responseModalities: ['TEXT', 'IMAGE']
      },
      safetySettings: this.getDefaultSafetySettings()
    };

    const response = await this.makeRequest(requestBody);
    return this.parseResponse(response);
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  private buildRequestParts(request: GeminiRequest): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Add images first (helps model understand context)
    if (request.images && request.images.length > 0) {
      for (const image of request.images) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.base64
          }
        });
      }
    }

    // Add text prompt
    parts.push({ text: request.prompt });

    return parts;
  }

  private async makeRequest(body: object): Promise<unknown> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new GeminiError(
        errorData.error?.message || `Request failed with status ${response.status}`,
        errorData.error?.code,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  private parseResponse(response: unknown): GeminiResponse {
    const data = response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType: string; data: string };
          }>;
        };
        finishReason?: string;
        safetyRatings?: SafetyRating[];
      }>;
      usageMetadata?: UsageMetadata;
    };

    const result: GeminiResponse = {
      text: null,
      images: [],
      usage: data.usageMetadata,
      finishReason: data.candidates?.[0]?.finishReason,
      safetyRatings: data.candidates?.[0]?.safetyRatings
    };

    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.text) {
        result.text = (result.text || '') + part.text;
      }

      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType as ImageMimeType;
        const base64 = part.inlineData.data;
        result.images.push({
          base64,
          mimeType,
          dataUrl: `data:${mimeType};base64,${base64}`
        });
      }
    }

    return result;
  }

  private parseStreamChunk(chunk: unknown): Partial<GeminiResponse> {
    const data = chunk as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
    };

    const result: Partial<GeminiResponse> = {
      text: '',
      images: []
    };

    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.text) {
        result.text = part.text;
      }

      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType as ImageMimeType;
        const base64 = part.inlineData.data;
        result.images!.push({
          base64,
          mimeType,
          dataUrl: `data:${mimeType};base64,${base64}`
        });
      }
    }

    return result;
  }

  private getDefaultSafetySettings(): SafetySetting[] {
    return [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ];
  }
}

// ============================================================================
// Singleton Instance & Factory
// ============================================================================

let serviceInstance: GeminiService | null = null;

/**
 * Initialize the Gemini service with your API key
 * Call this once at app startup
 */
export function initGeminiService(config: GeminiConfig): GeminiService {
  serviceInstance = new GeminiService(config);
  return serviceInstance;
}

/**
 * Get the initialized Gemini service instance
 * Throws if not initialized
 */
export function getGeminiService(): GeminiService {
  if (!serviceInstance) {
    throw new GeminiError('Gemini service not initialized. Call initGeminiService first.');
  }
  return serviceInstance;
}

/**
 * Check if the service has been initialized
 */
export function isGeminiServiceInitialized(): boolean {
  return serviceInstance !== null;
}

// ============================================================================
// Convenience Exports
// ============================================================================

export default GeminiService;
