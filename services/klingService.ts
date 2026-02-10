/**
 * Kling Service - Kling AI 2.6 Video Generation API Integration
 * All API calls go through the API gateway — no API keys in the client.
 *
 * Integrates with Kling AI via third-party providers (PiAPI, UlazAI, WaveSpeedAI)
 * Supports text-to-video and image-to-video generation with camera controls
 * Max duration: 10 seconds
 * Resolution: Up to 1080p
 */

import type { VideoGenerationProgress, ImageData, KlingProvider, CameraMotionType } from '../types';
import { klingGenerate, klingCheckStatus } from './apiGateway';

const POLL_INTERVAL_MS = 5000;

// Error Class
export class KlingError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'KlingError';
  }
}

// Camera Control Options
export interface KlingCameraControl {
  type: CameraMotionType;
  direction: number; // 0-360 degrees
  speed: 'slow' | 'normal' | 'fast';
  smoothness: number; // 0-100
}

// Request Options
export interface KlingGenerationOptions {
  prompt: string;
  inputImage?: ImageData;
  duration?: number; // 5 or 10 seconds
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  resolution?: '720p' | '1080p';
  camera?: KlingCameraControl;
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
  seed?: number;
  onProgress?: (progress: VideoGenerationProgress) => void;
  abortSignal?: AbortSignal;
}

// Response
export interface KlingResponse {
  videoUrl: string;
  thumbnailUrl?: string;
}

// Service Class
class KlingService {
  private provider: KlingProvider;

  constructor(provider: KlingProvider = 'piapi') {
    this.provider = provider;
  }

  /**
   * Set the provider
   */
  setProvider(provider: KlingProvider): void {
    this.provider = provider;
  }

  /**
   * Generate video using Kling AI via API gateway
   */
  async generateVideo(options: KlingGenerationOptions): Promise<KlingResponse> {
    const {
      prompt,
      inputImage,
      duration = 10,
      aspectRatio = '16:9',
      camera,
      quality = 'standard',
      seed,
      onProgress,
      abortSignal
    } = options;

    // Validate duration (Kling: 5 or 10s)
    const validDuration = duration > 7 ? 10 : 5;

    onProgress?.({
      phase: 'initializing',
      progress: 0,
      message: `Initializing Kling AI video generation via ${this.provider.toUpperCase()}...`
    });

    try {
      onProgress?.({
        phase: 'processing',
        progress: 20,
        message: 'Sending request to API gateway...'
      });

      // Extract image data URL if provided
      let inputImageUrl: string | undefined;
      if (inputImage?.dataUrl) {
        inputImageUrl = inputImage.dataUrl;
      } else if (inputImage?.base64 && inputImage?.mimeType) {
        inputImageUrl = `data:${inputImage.mimeType};base64,${inputImage.base64}`;
      }

      // Call the gateway
      const { taskId, provider } = await klingGenerate({
        provider: this.provider,
        prompt,
        inputImage: inputImageUrl,
        duration: validDuration,
        aspectRatio,
        quality,
        camera: camera && camera.type !== 'static' ? {
          type: camera.type,
          direction: camera.direction,
          speed: camera.speed,
          smoothness: camera.smoothness
        } : undefined,
        seed,
      });

      onProgress?.({
        phase: 'rendering',
        progress: 40,
        message: 'Rendering video...'
      });

      // Poll for completion
      const result = await this.pollForCompletion(taskId, provider, onProgress, abortSignal);

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Video generation complete!',
        videoUrl: result.videoUrl
      });

      return result;

    } catch (error) {
      if (error instanceof KlingError) throw error;

      if (abortSignal?.aborted) {
        throw new KlingError('Video generation cancelled');
      }

      throw new KlingError(
        error instanceof Error ? error.message : 'Unknown error during video generation',
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Poll for task completion via gateway
   */
  private async pollForCompletion(
    taskId: string,
    provider: string,
    onProgress?: (progress: VideoGenerationProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<KlingResponse> {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (120 * 5s)

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        throw new KlingError('Video generation cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      attempts++;

      const progress = Math.min(40 + (attempts / maxAttempts) * 50, 95);
      onProgress?.({
        phase: 'rendering',
        progress,
        message: 'Rendering video...',
        estimatedTimeRemaining: (maxAttempts - attempts) * (POLL_INTERVAL_MS / 1000)
      });

      try {
        const data = await klingCheckStatus(taskId, provider);

        // Check completion status (varies by provider)
        const status = data.status || data.state;
        const isComplete = status === 'succeeded' || status === 'completed' || status === 'success';
        const isFailed = status === 'failed' || status === 'error';

        if (isComplete) {
          const videoUrl = data.video_url || data.videoUrl || data.result?.video_url || data.output;
          const thumbnailUrl = data.thumbnail_url || data.thumbnailUrl || data.result?.thumbnail_url;

          if (!videoUrl) {
            throw new KlingError('No video URL in completion response');
          }

          return { videoUrl, thumbnailUrl };
        }

        if (isFailed) {
          throw new KlingError(data.error || data.message || 'Video generation failed');
        }

      } catch (error) {
        if (error instanceof KlingError) throw error;
        // Continue polling on network errors
      }
    }

    throw new KlingError('Video generation timed out');
  }
}

// Singleton instance
let serviceInstance: KlingService | null = null;

/**
 * Initialize Kling service (no API key needed — gateway handles auth)
 */
export function initKlingService(provider: KlingProvider = 'piapi'): KlingService {
  serviceInstance = new KlingService(provider);
  return serviceInstance;
}

/**
 * Get Kling service instance
 */
export function getKlingService(): KlingService {
  if (!serviceInstance) {
    throw new KlingError('Kling service not initialized. Call initKlingService() first.');
  }
  return serviceInstance;
}

/**
 * Check if Kling service is initialized
 */
export function isKlingServiceInitialized(): boolean {
  return serviceInstance !== null;
}
