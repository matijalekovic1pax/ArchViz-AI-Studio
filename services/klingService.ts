/**
 * Kling Service - Kling AI 2.6 Video Generation API Integration
 *
 * Integrates with Kling AI via third-party providers (PiAPI, UlazAI, WaveSpeedAI)
 * Supports text-to-video and image-to-video generation with camera controls
 * Max duration: 10 seconds
 * Resolution: Up to 1080p
 * Camera controls: Pan, tilt, roll, zoom with spatio-temporal precision
 */

import type { VideoGenerationProgress, ImageData, KlingProvider, CameraMotionType } from '../types';

// API Configuration
const KLING_ENDPOINTS = {
  piapi: 'https://api.piapi.ai/api/kling/v1/video/generation',
  ulazai: 'https://api.ulazai.com/v1/kling/video/generate',
  wavespeedai: 'https://api.wavespeed.ai/v1/kling/generate'
};

const MAX_RETRIES = 3;
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
  private apiKey: string;
  private provider: KlingProvider;
  private maxRetries: number = MAX_RETRIES;

  constructor(apiKey: string, provider: KlingProvider = 'piapi') {
    if (!apiKey) {
      throw new KlingError('API key is required');
    }
    this.apiKey = apiKey;
    this.provider = provider;
  }

  /**
   * Set the provider
   */
  setProvider(provider: KlingProvider): void {
    this.provider = provider;
  }

  /**
   * Generate video using Kling AI
   */
  async generateVideo(options: KlingGenerationOptions): Promise<KlingResponse> {
    const {
      prompt,
      inputImage,
      duration = 10,
      aspectRatio = '16:9',
      resolution = '1080p',
      camera,
      quality = 'standard',
      seed,
      onProgress,
      abortSignal
    } = options;

    // Validate duration (Kling: 5 or 10s)
    const validDuration = duration > 7 ? 10 : 5;

    // Report initializing
    onProgress?.({
      phase: 'initializing',
      progress: 0,
      message: `Initializing Kling AI video generation via ${this.provider.toUpperCase()}...`
    });

    try {
      // Build request payload based on provider
      const payload = this.buildPayload({
        prompt,
        inputImage,
        duration: validDuration,
        aspectRatio,
        resolution,
        camera,
        quality,
        seed
      });

      onProgress?.({
        phase: 'processing',
        progress: 20,
        message: 'Sending request to Kling AI...'
      });

      // Create video generation task
      const taskId = await this.createGenerationTask(payload, abortSignal);

      onProgress?.({
        phase: 'rendering',
        progress: 40,
        message: 'Rendering video...'
      });

      // Poll for completion
      const result = await this.pollForCompletion(taskId, onProgress, abortSignal);

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Video generation complete!',
        videoUrl: result.videoUrl
      });

      return result;

    } catch (error) {
      if (error instanceof KlingError) {
        throw error;
      }

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
   * Build request payload based on provider
   */
  private buildPayload(options: Omit<KlingGenerationOptions, 'onProgress' | 'abortSignal'>): any {
    const { prompt, inputImage, duration, aspectRatio, resolution, camera, quality, seed } = options;

    // Base payload structure varies by provider
    switch (this.provider) {
      case 'piapi':
        return this.buildPiAPIPayload(options);
      case 'ulazai':
        return this.buildUlazAIPayload(options);
      case 'wavespeedai':
        return this.buildWaveSpeedAIPayload(options);
      default:
        throw new KlingError(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Build PiAPI payload
   */
  private buildPiAPIPayload(options: Omit<KlingGenerationOptions, 'onProgress' | 'abortSignal'>): any {
    const { prompt, inputImage, duration, aspectRatio, camera } = options;

    const payload: any = {
      model: 'kling-v1-5',
      prompt: prompt,
      duration: duration,
      aspect_ratio: aspectRatio,
      mode: inputImage ? 'image2video' : 'text2video'
    };

    if (inputImage) {
      payload.image_url = inputImage.dataUrl;
    }

    // Camera controls
    if (camera && camera.type !== 'static') {
      payload.camera_control = {
        type: this.mapCameraType(camera.type),
        speed: camera.speed,
        direction: camera.direction,
        smoothness: camera.smoothness / 100 // Normalize to 0-1
      };
    }

    return payload;
  }

  /**
   * Build UlazAI payload
   */
  private buildUlazAIPayload(options: Omit<KlingGenerationOptions, 'onProgress' | 'abortSignal'>): any {
    const { prompt, inputImage, duration, aspectRatio, camera, quality } = options;

    const payload: any = {
      text: prompt,
      duration: `${duration}s`,
      ratio: aspectRatio,
      mode: inputImage ? 'img2video' : 'txt2video',
      quality: quality
    };

    if (inputImage) {
      payload.image = inputImage.dataUrl;
    }

    // Camera controls
    if (camera && camera.type !== 'static') {
      payload.camera_movement = {
        type: camera.type,
        strength: camera.speed === 'fast' ? 1.0 : camera.speed === 'slow' ? 0.3 : 0.6,
        angle: camera.direction
      };
    }

    return payload;
  }

  /**
   * Build WaveSpeedAI payload
   */
  private buildWaveSpeedAIPayload(options: Omit<KlingGenerationOptions, 'onProgress' | 'abortSignal'>): any {
    const { prompt, inputImage, duration, aspectRatio, camera, seed } = options;

    const payload: any = {
      prompt: prompt,
      image: inputImage?.dataUrl,
      video_length: duration,
      aspect_ratio: aspectRatio,
      seed: seed
    };

    // Camera controls
    if (camera && camera.type !== 'static') {
      payload.camera = {
        motion: camera.type,
        direction: camera.direction,
        speed: camera.speed,
        smoothness: camera.smoothness
      };
    }

    return payload;
  }

  /**
   * Map camera motion type to provider-specific format
   */
  private mapCameraType(type: CameraMotionType): string {
    const mapping: Record<CameraMotionType, string> = {
      'static': 'static',
      'pan': 'pan',
      'orbit': 'orbit',
      'dolly': 'dolly',
      'crane': 'crane',
      'drone': 'drone',
      'rotate': 'rotate',
      'push-in': 'zoom_in',
      'pull-out': 'zoom_out',
      'custom': 'custom'
    };
    return mapping[type] || 'static';
  }

  /**
   * Create generation task
   */
  private async createGenerationTask(payload: any, abortSignal?: AbortSignal): Promise<string> {
    const endpoint = KLING_ENDPOINTS[this.provider];

    const response = await this.executeWithRetry(async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: abortSignal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new KlingError(
          errorData.message || errorData.error || 'Failed to create generation task',
          errorData.code,
          res.status,
          errorData
        );
      }

      return res.json();
    });

    // Extract task ID based on provider response format
    const taskId = response.task_id || response.id || response.taskId;
    if (!taskId) {
      throw new KlingError('No task ID received from API');
    }

    return taskId;
  }

  /**
   * Poll for task completion
   */
  private async pollForCompletion(
    taskId: string,
    onProgress?: (progress: VideoGenerationProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<KlingResponse> {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (120 * 5s)

    // Provider-specific status endpoints
    const statusEndpoints = {
      piapi: `https://api.piapi.ai/api/kling/v1/video/${taskId}`,
      ulazai: `https://api.ulazai.com/v1/kling/video/status/${taskId}`,
      wavespeedai: `https://api.wavespeed.ai/v1/kling/status/${taskId}`
    };

    const statusEndpoint = statusEndpoints[this.provider];

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        throw new KlingError('Video generation cancelled');
      }

      await this.sleep(POLL_INTERVAL_MS);
      attempts++;

      const progress = Math.min(40 + (attempts / maxAttempts) * 50, 95);
      onProgress?.({
        phase: 'rendering',
        progress,
        message: 'Rendering video...',
        estimatedTimeRemaining: (maxAttempts - attempts) * (POLL_INTERVAL_MS / 1000)
      });

      try {
        const response = await fetch(statusEndpoint, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          signal: abortSignal
        });

        if (!response.ok) {
          throw new KlingError('Failed to check task status', undefined, response.status);
        }

        const data = await response.json();

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
        if (error instanceof KlingError) {
          throw error;
        }
        // Continue polling on network errors
      }
    }

    throw new KlingError('Video generation timed out');
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        const isRetryable = this.isRetryableError(error);

        if (isRetryable && attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new KlingError('Request failed after retries');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof KlingError) {
      return (
        error.status === 429 ||
        error.status === 500 ||
        error.status === 503 ||
        error.code === 'RATE_LIMIT' ||
        error.code === 'SERVER_ERROR'
      );
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let serviceInstance: KlingService | null = null;

/**
 * Initialize Kling service
 */
export function initKlingService(apiKey: string, provider: KlingProvider = 'piapi'): KlingService {
  serviceInstance = new KlingService(apiKey, provider);
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

/**
 * Get API key from environment or localStorage
 */
export function getKlingApiKey(provider: KlingProvider): string | null {
  // Check provider-specific environment variable first
  const envKey = `VITE_KLING_${provider.toUpperCase()}_API_KEY`;
  if (import.meta.env?.[envKey]) {
    return import.meta.env[envKey];
  }

  // Check generic Kling key
  if (import.meta.env?.VITE_KLING_API_KEY) {
    return import.meta.env.VITE_KLING_API_KEY;
  }

  // localStorage fallback
  return localStorage.getItem(`kling_${provider}_api_key`) || localStorage.getItem('kling_api_key');
}
