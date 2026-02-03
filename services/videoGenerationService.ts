/**
 * Video Generation Service - Unified Interface
 *
 * Abstracts Veo and Kling services, routing requests to the appropriate API
 * Handles model capability detection and API key management
 * Provides a single interface for video generation across different providers
 */

import type {
  VideoState,
  VideoGenerationProgress,
  ImageData,
  KlingProvider
} from '../types';

import {
  initVeoService,
  getVeoService,
  isVeoServiceInitialized,
  getVeoApiKey,
  type VeoGenerationOptions,
  type VeoResponse,
  VeoError
} from './veoService';

import {
  initKlingService,
  getKlingService,
  isKlingServiceInitialized,
  getKlingApiKey,
  type KlingGenerationOptions,
  type KlingResponse,
  KlingError
} from './klingService';

// Unified Generation Options
export interface VideoGenerationOptions {
  model: 'veo-2' | 'kling-2.6';
  prompt: string;
  inputImage?: ImageData;
  keyframes?: ImageData[];
  duration: number;
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  motionAmount: number;
  camera: VideoState['camera'];
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  transitionEffect: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'none';
  seed?: number;
  generateAudio?: boolean;
  personGeneration?: 'allow_adult' | 'dont_allow' | 'allow_all';
  klingProvider: KlingProvider;
  onProgress?: (progress: VideoGenerationProgress) => void;
  abortSignal?: AbortSignal;
}

// Unified Response
export interface VideoGenerationResponse {
  videoUrl: string;
  thumbnailUrl?: string;
  model: 'veo-2' | 'kling-2.6';
  expiresAt?: Date;
}

// Model Capabilities
export interface ModelCapabilities {
  maxDuration: number;
  maxResolution: '720p' | '1080p' | '4k';
  supportsCameraControls: boolean;
  supportedAspectRatios: Array<'16:9' | '9:16' | '1:1' | '4:3' | '21:9'>;
  supportsMultipleKeyframes: boolean;
}

// Error Class
export class VideoGenerationError extends Error {
  constructor(
    message: string,
    public model?: 'veo-2' | 'kling-2.6',
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VideoGenerationError';
  }
}

/**
 * Video Generation Service Class
 */
class VideoGenerationService {
  /**
   * Generate video using the specified model
   */
  async generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResponse> {
    const { model, klingProvider, onProgress } = options;

    // Ensure appropriate service is initialized
    await this.ensureServiceInitialized(model, klingProvider);

    // Route to appropriate service
    if (model === 'veo-2') {
      return this.generateWithVeo(options);
    } else if (model === 'kling-2.6') {
      return this.generateWithKling(options);
    } else {
      throw new VideoGenerationError(`Unsupported model: ${model}`);
    }
  }

  /**
   * Generate video using Veo 2
   */
  private async generateWithVeo(options: VideoGenerationOptions): Promise<VideoGenerationResponse> {
    const veoService = getVeoService();

    const veoOptions: VeoGenerationOptions = {
      prompt: options.prompt,
      inputImage: options.inputImage,
      duration: Math.min(options.duration, 8), // Veo max: 8s
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
      seed: options.seed,
      generateAudio: options.generateAudio,
      personGeneration: options.personGeneration,
      responseCount: 1,
      onProgress: options.onProgress,
      abortSignal: options.abortSignal
    };

    try {
      const response: VeoResponse = await veoService.generateVideo(veoOptions);

      return {
        videoUrl: response.videoUrl,
        thumbnailUrl: response.thumbnailUrl,
        model: 'veo-2',
        expiresAt: response.expiresAt
      };
    } catch (error) {
      if (error instanceof VeoError) {
        throw new VideoGenerationError(
          error.message,
          'veo-2',
          error.code,
          error.details
        );
      }
      throw error;
    }
  }

  /**
   * Generate video using Kling AI
   */
  private async generateWithKling(options: VideoGenerationOptions): Promise<VideoGenerationResponse> {
    const klingService = getKlingService();

    // Kling doesn't support 4K, cap at 1080p
    const resolution = options.resolution === '4k' ? '1080p' : options.resolution;

    const klingOptions: KlingGenerationOptions = {
      prompt: options.prompt,
      inputImage: options.inputImage,
      duration: Math.min(options.duration, 10), // Kling max: 10s
      aspectRatio: options.aspectRatio,
      resolution: resolution,
      camera: options.camera,
      quality: options.quality,
      seed: options.seed,
      onProgress: options.onProgress,
      abortSignal: options.abortSignal
    };

    try {
      const response: KlingResponse = await klingService.generateVideo(klingOptions);

      return {
        videoUrl: response.videoUrl,
        thumbnailUrl: response.thumbnailUrl,
        model: 'kling-2.6'
      };
    } catch (error) {
      if (error instanceof KlingError) {
        throw new VideoGenerationError(
          error.message,
          'kling-2.6',
          error.code,
          error.details
        );
      }
      throw error;
    }
  }

  /**
   * Ensure the appropriate service is initialized
   */
  private async ensureServiceInitialized(
    model: 'veo-2' | 'kling-2.6',
    klingProvider: KlingProvider
  ): Promise<void> {
    if (model === 'veo-2') {
      if (!isVeoServiceInitialized()) {
        const apiKey = getVeoApiKey();
        if (!apiKey) {
          throw new VideoGenerationError(
            'Google API key not found. Please set VITE_GOOGLE_API_KEY or add it in settings.',
            'veo-2'
          );
        }
        // Get project ID from environment or localStorage
        // @ts-ignore
        const projectId = import.meta.env?.VITE_GOOGLE_PROJECT_ID || localStorage.getItem('google_project_id');
        // @ts-ignore
        const region = import.meta.env?.VITE_GOOGLE_REGION || 'us-central1';

        if (!projectId) {
          throw new VideoGenerationError(
            'Google Cloud Project ID not found. Please set VITE_GOOGLE_PROJECT_ID in .env or add "google_project_id" to localStorage.',
            'veo-2'
          );
        }

        initVeoService(apiKey, projectId, region);
      }
    } else if (model === 'kling-2.6') {
      if (!isKlingServiceInitialized()) {
        const apiKey = getKlingApiKey(klingProvider);
        if (!apiKey) {
          throw new VideoGenerationError(
            `Kling API key not found for ${klingProvider}. Please add it in settings.`,
            'kling-2.6'
          );
        }
        initKlingService(apiKey, klingProvider);
      } else {
        // Update provider if different
        const klingService = getKlingService();
        klingService.setProvider(klingProvider);
      }
    }
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: 'veo-2' | 'kling-2.6'): ModelCapabilities {
    if (model === 'veo-2') {
      return {
        maxDuration: 8,
        maxResolution: '4k',
        supportsCameraControls: false,
        supportedAspectRatios: ['16:9', '9:16'],
        supportsMultipleKeyframes: false
      };
    } else {
      return {
        maxDuration: 10,
        maxResolution: '1080p',
        supportsCameraControls: true,
        supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '21:9'],
        supportsMultipleKeyframes: true
      };
    }
  }

  /**
   * Validate generation options against model capabilities
   */
  validateOptions(options: VideoGenerationOptions): { valid: boolean; errors: string[] } {
    const capabilities = this.getModelCapabilities(options.model);
    const errors: string[] = [];

    // Check duration
    if (options.duration > capabilities.maxDuration) {
      errors.push(`${options.model} supports max ${capabilities.maxDuration}s videos (requested: ${options.duration}s)`);
    }

    // Check resolution
    if (options.resolution === '4k' && capabilities.maxResolution !== '4k') {
      errors.push(`${options.model} does not support 4K resolution (max: ${capabilities.maxResolution})`);
    }

    // Check camera controls
    if (!capabilities.supportsCameraControls && options.camera.type !== 'static') {
      errors.push(`${options.model} does not support camera controls`);
    }

    // Check aspect ratio
    if (!capabilities.supportedAspectRatios.includes(options.aspectRatio)) {
      errors.push(`${options.model} does not support ${options.aspectRatio} aspect ratio`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Auto-adjust options to fit model capabilities
   */
  adjustOptionsForModel(options: VideoGenerationOptions): VideoGenerationOptions {
    const capabilities = this.getModelCapabilities(options.model);
    const fallbackAspectRatio = capabilities.supportedAspectRatios[0];

    return {
      ...options,
      duration: Math.min(options.duration, capabilities.maxDuration),
      resolution: options.resolution === '4k' && capabilities.maxResolution !== '4k'
        ? capabilities.maxResolution
        : options.resolution,
      aspectRatio: capabilities.supportedAspectRatios.includes(options.aspectRatio)
        ? options.aspectRatio
        : fallbackAspectRatio,
      camera: !capabilities.supportsCameraControls
        ? { ...options.camera, type: 'static' }
        : options.camera
    };
  }
}

// Singleton instance
let serviceInstance: VideoGenerationService | null = null;

/**
 * Get video generation service instance
 */
export function getVideoGenerationService(): VideoGenerationService {
  if (!serviceInstance) {
    serviceInstance = new VideoGenerationService();
  }
  return serviceInstance;
}

/**
 * Initialize video generation service
 * Note: This doesn't require immediate initialization since API keys are loaded per-model
 */
export function initVideoGenerationService(): VideoGenerationService {
  serviceInstance = new VideoGenerationService();
  return serviceInstance;
}

/**
 * Check if any video service is initialized
 */
export function isVideoServiceInitialized(): boolean {
  return isVeoServiceInitialized() || isKlingServiceInitialized();
}
