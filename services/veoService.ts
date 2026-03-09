/**
 * Veo Service - Google Veo 3.1 Video Generation API Integration
 * All API calls go through the API gateway — no API keys in the client.
 *
 * Supports text-to-video and image-to-video generation
 * Max duration: 8 seconds
 * Resolution: Up to 4K
 * Videos expire after 2 days
 */

import type { VideoGenerationProgress, ImageData } from '../types';
import { veoGenerate, veoCheckStatus, veoDownloadVideo, veoFetchVideo } from './apiGateway';

const POLL_INTERVAL_MS = 3000;

// Error Class
export class VeoError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VeoError';
  }
}

// Request Options
export interface VeoGenerationOptions {
  prompt: string;
  inputImage?: ImageData;
  startFrame?: ImageData; // First frame for interpolation (image-morph mode)
  endFrame?: ImageData;   // Last frame for interpolation (image-morph mode)
  duration?: number; // 5-8 seconds
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  resolution?: '720p' | '1080p' | '4k';
  seed?: number;
  responseCount?: number; // 1-4
  generateAudio?: boolean;
  personGeneration?: 'allow_adult' | 'dont_allow' | 'allow_all';
  negativePrompt?: string;
  onProgress?: (progress: VideoGenerationProgress) => void;
  abortSignal?: AbortSignal;
}

// Response
export interface VeoResponse {
  videoUrl: string;
  thumbnailUrl?: string;
  expiresAt: Date; // 2 days from generation
}

// Service Class
class VeoService {
  constructor() {
    // No API keys needed — gateway handles auth
  }

  /**
   * Generate video using Veo 3.1 model via API gateway
   */
  async generateVideo(options: VeoGenerationOptions): Promise<VeoResponse> {
    const {
      prompt,
      inputImage,
      startFrame,
      endFrame,
      duration = 8,
      aspectRatio = '16:9',
      resolution = '1080p',
      seed,
      responseCount = 1,
      generateAudio = false,
      personGeneration = 'allow_adult',
      negativePrompt,
      onProgress,
      abortSignal
    } = options;

    const isInterpolation = !!(startFrame || endFrame);

    onProgress?.({
      phase: 'initializing',
      progress: 0,
      message: isInterpolation
        ? 'Initializing Veo 3.1 frame interpolation...'
        : 'Initializing Veo 3.1 video generation...'
    });

    try {
      // Validate and adjust duration
      let validDuration: number;
      if (inputImage || isInterpolation) {
        // Image-to-video / interpolation: snap to nearest valid duration (4, 6, or 8)
        if (duration <= 5) validDuration = 4;
        else if (duration <= 7) validDuration = 6;
        else validDuration = 8;
      } else {
        // Text-to-video: clamp to 4-8 range
        validDuration = Math.min(Math.max(4, duration), 8);
      }

      /** Helper: convert an ImageData to { bytesBase64Encoded, mimeType } */
      const toApiImage = (img: ImageData): { bytesBase64Encoded: string; mimeType: string } | undefined => {
        let base64Data: string | undefined;
        let mimeType: string | undefined;

        if (img.dataUrl) {
          const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            [, mimeType, base64Data] = match;
          }
        } else if (img.base64 && img.mimeType) {
          base64Data = img.base64;
          mimeType = img.mimeType;
        }

        if (base64Data && mimeType) {
          return { bytesBase64Encoded: base64Data, mimeType };
        }
      };

      // Prepare image data for the gateway
      const imageData = inputImage ? toApiImage(inputImage) : undefined;
      const firstImageData = startFrame ? toApiImage(startFrame) : undefined;
      const lastImageData = endFrame ? toApiImage(endFrame) : undefined;

      onProgress?.({
        phase: 'processing',
        progress: 20,
        message: 'Sending request to API gateway...'
      });

      // Call the gateway
      const result = await veoGenerate({
        prompt,
        image: imageData,
        firstImage: firstImageData,
        lastImage: lastImageData,
        durationSeconds: validDuration,
        aspectRatio,
        resolution,
        generateAudio,
        personGeneration,
        negativePrompt: negativePrompt || undefined,
        seed,
        numberOfVideos: responseCount > 1 ? Math.min(Math.max(1, responseCount), 4) : undefined,
      });

      // Handle error response
      if (result.status === 'error') {
        throw new VeoError(result.error || 'Video generation failed');
      }

      let rawVideoUrl: string | undefined;

      // If complete immediately
      if (result.status === 'complete') {
        if (result.videoUrl) {
          rawVideoUrl = result.videoUrl;
        } else if (result.needsBinaryFetch && result.operationName) {
          rawVideoUrl = await veoFetchVideo(result.operationName);
        } else if (result.videoBase64) {
          const mime = result.mimeType || 'video/mp4';
          const bytes = Uint8Array.from(atob(result.videoBase64), c => c.charCodeAt(0));
          rawVideoUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        }
      }

      // If still processing, poll for completion
      if (result.status === 'processing' && result.operationName) {
        onProgress?.({
          phase: 'rendering',
          progress: 40,
          message: 'Rendering video...'
        });

        rawVideoUrl = await this.pollForCompletion(
          result.operationName,
          onProgress,
          abortSignal
        );
      }

      if (!rawVideoUrl) {
        throw new VeoError('Unexpected response from API gateway');
      }

      // Proxy-download if it's a remote URL (not already a blob://)
      let playableUrl = rawVideoUrl;
      if (!rawVideoUrl.startsWith('blob:')) {
        onProgress?.({ phase: 'rendering', progress: 92, message: 'Downloading video...' });
        try {
          playableUrl = await veoDownloadVideo(rawVideoUrl);
        } catch {
          playableUrl = rawVideoUrl;
        }
      }

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Video ready!',
        videoUrl: playableUrl
      });

      return {
        videoUrl: playableUrl,
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      };

    } catch (error) {
      if (error instanceof VeoError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new VeoError('Video generation cancelled');
      }

      throw new VeoError(
        error instanceof Error ? error.message : 'Unknown error during video generation',
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Poll for async video generation completion via gateway
   */
  private async pollForCompletion(
    operationName: string,
    onProgress?: (progress: VideoGenerationProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    let attempts = 0;
    const maxAttempts = 120; // 6 minutes max (120 * 3s)

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        throw new VeoError('Video generation cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      attempts++;

      const progress = Math.min(40 + (attempts / maxAttempts) * 50, 90);
      onProgress?.({
        phase: 'rendering',
        progress,
        message: `Generating video... (${Math.floor(attempts * POLL_INTERVAL_MS / 1000)}s elapsed)`,
        estimatedTimeRemaining: Math.max(0, (maxAttempts - attempts) * POLL_INTERVAL_MS / 1000)
      });

      try {
        const status = await veoCheckStatus(operationName);

        if (status.status === 'complete') {
          if (status.videoUrl) return status.videoUrl;
          if (status.needsBinaryFetch && status.operationName) {
            return await veoFetchVideo(status.operationName);
          }
          if (status.videoBase64) {
            const mime = status.mimeType || 'video/mp4';
            const bytes = Uint8Array.from(atob(status.videoBase64), c => c.charCodeAt(0));
            return URL.createObjectURL(new Blob([bytes], { type: mime }));
          }
        }

        if (status.status === 'error') {
          throw new VeoError(status.error || 'Video generation failed');
        }

        // Still processing, continue polling
      } catch (error) {
        if (error instanceof VeoError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new VeoError('Video generation cancelled');
        }
        // Continue polling on network errors
      }
    }

    throw new VeoError('Video generation timed out after 6 minutes');
  }
}

// Singleton instance
let serviceInstance: VeoService | null = null;

/**
 * Initialize Veo service (no API key needed — gateway handles auth)
 */
export function initVeoService(): VeoService {
  serviceInstance = new VeoService();
  return serviceInstance;
}

/**
 * Get Veo service instance
 */
export function getVeoService(): VeoService {
  if (!serviceInstance) {
    serviceInstance = new VeoService();
  }
  return serviceInstance;
}

/**
 * Check if Veo service is initialized
 */
export function isVeoServiceInitialized(): boolean {
  return serviceInstance !== null;
}
