/**
 * Veo Service - Google Veo 2 Video Generation API Integration
 *
 * Integrates with Google's Veo 2 model (veo-2.0-generate-exp) via Gemini API
 * Supports text-to-video and image-to-video generation
 * Max duration: 8 seconds
 * Resolution: Up to 4K
 * Videos expire after 2 days
 */

import type { VideoGenerationProgress, ImageData } from '../types';

// API Configuration
const VEO_MODEL = 'veo-3.1-generate-preview';
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 3000;

// Vertex AI Configuration
function getVertexAIEndpoint(projectId: string, region: string = 'us-central1'): string {
  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${VEO_MODEL}:predictLongRunning`;
}

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
  duration?: number; // 5-8 seconds
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  resolution?: '720p' | '1080p' | '4k';
  seed?: number;
  responseCount?: number; // 1-4
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
  private apiKey: string;
  private projectId: string;
  private region: string;
  private maxRetries: number = MAX_RETRIES;

  constructor(apiKey: string, projectId?: string, region: string = 'us-central1') {
    if (!apiKey) {
      throw new VeoError('OAuth 2.0 access token is required for Vertex AI.\n\nGet one by running:\n  gcloud auth print-access-token\n\nThen set it in localStorage or .env file.');
    }
    this.apiKey = apiKey;
    this.projectId = projectId || this.getProjectIdFromEnv();
    this.region = region;

    console.log('🔐 Veo Service initialized with:', {
      projectId: this.projectId,
      region: this.region,
      hasToken: !!this.apiKey,
      tokenLength: this.apiKey?.length || 0
    });
  }

  private getProjectIdFromEnv(): string {
    // @ts-ignore
    const projectId = import.meta.env?.VITE_GOOGLE_PROJECT_ID || localStorage.getItem('google_project_id');
    if (!projectId) {
      throw new VeoError('Google Cloud Project ID is required. Set VITE_GOOGLE_PROJECT_ID in .env or add it to localStorage as "google_project_id".');
    }
    return projectId;
  }

  /**
   * Generate video using Veo 2 model
   */
  async generateVideo(options: VeoGenerationOptions): Promise<VeoResponse> {
    const {
      prompt,
      inputImage,
      duration = 8,
      aspectRatio = '16:9',
      resolution = '1080p',
      seed,
      responseCount = 1,
      onProgress,
      abortSignal
    } = options;

    // Check if Cloudflare Worker proxy is available
    // @ts-ignore
    const proxyUrl = import.meta.env?.VITE_VEO_PROXY_URL || localStorage.getItem('veo_proxy_url');

    if (proxyUrl) {
      console.log('🎬 Using Cloudflare Worker proxy:', proxyUrl);
      return this.generateVideoViaProxy(proxyUrl, options);
    }

    // Validate duration
    // For image-to-video, only 4, 6, or 8 seconds are supported
    // For text-to-video, 5-8 seconds are supported
    let validDuration: number;
    if (inputImage) {
      // Image-to-video: snap to nearest valid duration (4, 6, or 8)
      if (duration <= 5) validDuration = 4;
      else if (duration <= 7) validDuration = 6;
      else validDuration = 8;
    } else {
      // Text-to-video: clamp to 5-8 range
      validDuration = Math.min(Math.max(5, duration), 8);
    }

    // Report initializing
    onProgress?.({
      phase: 'initializing',
      progress: 0,
      message: 'Initializing Veo 2 video generation...'
    });

    try {
      // Build request payload for Veo 3.1 (correct structure)
      const instance: any = {
        prompt: prompt
      };

      // Add input image if provided
      if (inputImage) {
        console.log('🎬 Input image provided:', {
          hasDataUrl: !!inputImage.dataUrl,
          hasMimeType: !!inputImage.mimeType,
          hasBase64: !!inputImage.base64
        });

        // Handle both dataUrl format and separate base64/mimeType format
        let base64Data: string | undefined;
        let mimeType: string | undefined;

        if (inputImage.dataUrl) {
          const base64Match = inputImage.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            [, mimeType, base64Data] = base64Match;
          }
        } else if (inputImage.base64 && inputImage.mimeType) {
          base64Data = inputImage.base64;
          mimeType = inputImage.mimeType;
        }

        if (base64Data && mimeType) {
          instance.image = {
            bytesBase64Encoded: base64Data,
            mimeType: mimeType
          };
          console.log('🎬 Image added to instance:', {
            mimeType,
            base64Length: base64Data.length
          });
        } else {
          console.warn('⚠️ Input image provided but no valid format found');
        }
      }

      // Build parameters object
      const parameters: any = {
        durationSeconds: validDuration
      };

      // Add aspect ratio if specified
      if (aspectRatio) {
        parameters.aspectRatio = aspectRatio;
      }

      // Add response count if specified
      if (responseCount && responseCount > 1) {
        parameters.sampleCount = Math.min(Math.max(1, responseCount), 4);
      }

      // Add seed if provided
      if (seed !== undefined) {
        parameters.seed = seed;
      }

      // Build final payload
      const payload = {
        instances: [instance],
        parameters: parameters
      };

      onProgress?.({
        phase: 'processing',
        progress: 20,
        message: 'Sending request to Veo 3.1 API...'
      });

      // Make API call with retry logic using Vertex AI endpoint
      const endpoint = getVertexAIEndpoint(this.projectId, this.region);
      console.log('🎬 Veo API Endpoint:', endpoint);
      console.log('🎬 Request payload:', JSON.stringify(payload, null, 2));

      const response = await this.executeWithRetry(async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'x-goog-user-project': this.projectId
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new VeoError(
            errorData.error?.message || 'Video generation failed',
            errorData.error?.code,
            res.status,
            errorData
          );
        }

        return res.json();
      });

      console.log('🎬 API Response:', JSON.stringify(response, null, 2));

      onProgress?.({
        phase: 'rendering',
        progress: 60,
        message: 'Rendering video...'
      });

      // :predictLongRunning always returns an operation
      if (!response.name) {
        throw new VeoError('No operation name in response', undefined, undefined, response);
      }

      // Poll for completion
      const videoUrl = await this.pollForCompletion(
        response.name,
        onProgress,
        abortSignal
      );

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Video generation complete!',
        videoUrl
      });

      return {
        videoUrl,
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days
      };

    } catch (error) {
      // Log the actual error for debugging
      console.error('❌ Video generation error:', error);

      if (error instanceof VeoError) {
        throw error;
      }

      // Only report as cancelled if it's actually an abort error
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
   * Generate video via Cloudflare Worker proxy
   * This bypasses CORS issues by using a server-side proxy
   */
  private async generateVideoViaProxy(
    proxyUrl: string,
    options: VeoGenerationOptions
  ): Promise<VeoResponse> {
    const {
      prompt,
      inputImage,
      duration = 8,
      aspectRatio = '16:9',
      onProgress,
      abortSignal
    } = options;

    onProgress?.({
      phase: 'initializing',
      progress: 0,
      message: 'Initializing Veo 3.1 video generation via proxy...'
    });

    try {
      // Prepare image data
      let imageData: { bytesBase64Encoded: string; mimeType: string } | undefined;

      if (inputImage) {
        let base64Data: string | undefined;
        let mimeType: string | undefined;

        if (inputImage.dataUrl) {
          const base64Match = inputImage.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            [, mimeType, base64Data] = base64Match;
          }
        } else if (inputImage.base64 && inputImage.mimeType) {
          base64Data = inputImage.base64;
          mimeType = inputImage.mimeType;
        }

        if (base64Data && mimeType) {
          imageData = {
            bytesBase64Encoded: base64Data,
            mimeType: mimeType
          };
        }
      }

      // Validate duration based on mode
      // For image-to-video, only 4, 6, or 8 seconds are supported
      // For text-to-video, 5-8 seconds are supported
      let validDuration: number;
      if (imageData) {
        // Image-to-video: snap to nearest valid duration (4, 6, or 8)
        if (duration <= 5) validDuration = 4;
        else if (duration <= 7) validDuration = 6;
        else validDuration = 8;
        console.log(`🎬 Image-to-video mode: adjusted duration from ${duration}s to ${validDuration}s`);
      } else {
        // Text-to-video: clamp to 5-8 range
        validDuration = Math.min(Math.max(5, duration), 8);
      }

      onProgress?.({
        phase: 'processing',
        progress: 20,
        message: 'Sending request to Cloudflare Worker...'
      });

      // Call the Cloudflare Worker
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          image: imageData,
          durationSeconds: validDuration,
          aspectRatio,
          projectId: this.projectId,
          accessToken: this.apiKey
        }),
        signal: abortSignal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Proxy error response:', errorData);
        throw new VeoError(
          errorData.error || `Proxy request failed with status ${response.status}`,
          undefined,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      console.log('🎬 Proxy response:', data);

      // Handle error response
      if (data.status === 'error') {
        console.error('❌ Proxy returned error:', data.error);
        throw new VeoError(data.error || 'Video generation failed');
      }

      // If complete immediately, return video URL
      if (data.status === 'complete' && data.videoUrl) {
        console.log('✅ Video completed immediately');
        onProgress?.({
          phase: 'complete',
          progress: 100,
          message: 'Video generation complete!',
          videoUrl: data.videoUrl
        });

        return {
          videoUrl: data.videoUrl,
          expiresAt: new Date(data.expiresAt || Date.now() + 2 * 24 * 60 * 60 * 1000)
        };
      }

      // If still processing, poll for completion
      if (data.status === 'processing' && data.operationName) {
        console.log('⏳ Video still processing, polling for completion...');
        onProgress?.({
          phase: 'processing',
          progress: 30,
          message: 'Video generation in progress...'
        });

        const videoUrl = await this.pollProxyOperation(
          proxyUrl,
          data.operationName,
          onProgress,
          abortSignal
        );

        return {
          videoUrl,
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        };
      }

      // Unexpected response
      throw new VeoError('Unexpected response from proxy: ' + JSON.stringify(data));

    } catch (error) {
      console.error('❌ Proxy video generation error:', error);

      if (error instanceof VeoError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new VeoError('Video generation cancelled');
      }

      throw new VeoError(
        error instanceof Error ? error.message : 'Unknown error during proxy video generation',
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Poll the Cloudflare Worker's status endpoint
   */
  private async pollProxyOperation(
    proxyUrl: string,
    operationName: string,
    onProgress?: (progress: VideoGenerationProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const maxAttempts = 120; // 6 minutes max (120 * 3s)
    const pollInterval = 3000; // 3 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        throw new VeoError('Video generation cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      const progress = Math.min(30 + (attempts / maxAttempts) * 60, 90);
      onProgress?.({
        phase: 'processing',
        progress,
        message: `Generating video... (${Math.floor(attempts * pollInterval / 1000)}s elapsed)`,
        estimatedTimeRemaining: Math.max(0, (maxAttempts - attempts) * pollInterval / 1000)
      });

      try {
        // Call GET endpoint with operation name
        const statusUrl = `${proxyUrl}?operation=${encodeURIComponent(operationName)}&token=${encodeURIComponent(this.apiKey)}&project=${encodeURIComponent(this.projectId)}`;

        console.log(`🔄 Polling attempt ${attempts}/${maxAttempts}`);

        const response = await fetch(statusUrl, {
          method: 'GET',
          signal: abortSignal
        });

        if (!response.ok) {
          console.warn(`⚠️ Status check returned ${response.status}, retrying...`);
          continue;
        }

        const data = await response.json();

        if (data.status === 'complete' && data.videoUrl) {
          console.log('✅ Video generation complete!');
          onProgress?.({
            phase: 'complete',
            progress: 100,
            message: 'Video generation complete!',
            videoUrl: data.videoUrl
          });
          return data.videoUrl;
        }

        if (data.status === 'error') {
          throw new VeoError(data.error || 'Video generation failed');
        }

        // Still processing, continue polling
        console.log('⏳ Still processing...');

      } catch (error) {
        if (error instanceof VeoError) {
          throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          throw new VeoError('Video generation cancelled');
        }
        console.warn('⚠️ Polling attempt failed:', error);
        // Continue polling on network errors
      }
    }

    throw new VeoError('Video generation timed out after 6 minutes');
  }

  /**
   * Poll for async video generation completion
   */
  private async pollForCompletion(
    operationName: string,
    onProgress?: (progress: VideoGenerationProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max (60 * 3s)

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        console.log('⚠️ Abort signal detected, cancelling polling');
        throw new VeoError('Video generation cancelled');
      }

      await this.sleep(POLL_INTERVAL_MS);
      attempts++;

      console.log(`🎬 Poll attempt ${attempts} of ${maxAttempts}`);

      const progress = Math.min(60 + (attempts / maxAttempts) * 30, 90);
      onProgress?.({
        phase: 'rendering',
        progress,
        message: 'Rendering video...',
        estimatedTimeRemaining: (maxAttempts - attempts) * (POLL_INTERVAL_MS / 1000)
      });

      try {
        // Vertex AI operations endpoint
        // The operation name is the full resource path returned by the API
        // Format: projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{operation}
        const operationUrl = `https://${this.region}-aiplatform.googleapis.com/v1/${operationName}`;
        console.log('🎬 Polling operation URL:', operationUrl);

        const response = await fetch(operationUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'x-goog-user-project': this.projectId
          },
          signal: abortSignal
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Polling failed with status', response.status, ':', errorText);
          throw new VeoError(
            `Failed to check operation status: ${errorText}`,
            undefined,
            response.status
          );
        }

        const data = await response.json();

        console.log('🎬 Poll attempt', attempts, 'of', maxAttempts, '- Operation status:', {
          done: data.done,
          hasError: !!data.error,
          hasResponse: !!data.response
        });

        if (data.done) {
          if (data.error) {
            console.error('❌ Operation error:', data.error);
            throw new VeoError(data.error.message, data.error.code);
          }

          console.log('✅ Operation complete, extracting video URL...');
          return this.extractVideoUrl(data.response);
        }
      } catch (error) {
        if (error instanceof VeoError) {
          console.error('❌ VeoError during polling:', error.message);
          throw error;
        }
        // Continue polling on network errors
        console.warn('⚠️ Network error during polling, will retry:', error);
      }
    }

    throw new VeoError('Video generation timed out');
  }

  /**
   * Extract video URL from API response
   */
  private extractVideoUrl(response: any): string {
    console.log('🎬 Extracting video URL from response:', JSON.stringify(response, null, 2));

    // Veo predictLongRunning response format
    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];

      // Try different possible field names
      const videoUrl = prediction.videoUrl || prediction.videoUri || prediction.video_url || prediction.video_uri;

      if (videoUrl) {
        console.log('🎬 Found video URL:', videoUrl);
        return videoUrl;
      }

      // Check for nested video object
      if (prediction.video) {
        const url = prediction.video.url || prediction.video.uri;
        if (url) {
          console.log('🎬 Found video URL in nested object:', url);
          return url;
        }
      }
    }

    // Legacy format - check for video in candidates
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.videoData || part.fileData) {
            const videoData = part.videoData || part.fileData;
            if (videoData.fileUri || videoData.uri || videoData.url) {
              return videoData.fileUri || videoData.uri || videoData.url;
            }
          }
        }
      }
    }

    // Check for direct video URL
    if (response.video?.url || response.videoUrl) {
      return response.video?.url || response.videoUrl;
    }

    console.error('❌ No video URL found in response');
    throw new VeoError('No video URL found in response', undefined, undefined, response);
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

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (isRetryable && attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new VeoError('Request failed after retries');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof VeoError) {
      // Retry on rate limits and server errors
      return (
        error.status === 429 ||
        error.status === 500 ||
        error.status === 503 ||
        error.code === 'RESOURCE_EXHAUSTED' ||
        error.code === 'UNAVAILABLE'
      );
    }

    // Retry on network errors
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
let serviceInstance: VeoService | null = null;

/**
 * Initialize Veo service
 */
export function initVeoService(apiKey: string, projectId?: string, region: string = 'us-central1'): VeoService {
  serviceInstance = new VeoService(apiKey, projectId, region);
  return serviceInstance;
}

/**
 * Get Veo service instance
 */
export function getVeoService(): VeoService {
  if (!serviceInstance) {
    throw new VeoError('Veo service not initialized. Call initVeoService() first.');
  }
  return serviceInstance;
}

/**
 * Check if Veo service is initialized
 */
export function isVeoServiceInitialized(): boolean {
  return serviceInstance !== null;
}

/**
 * Get OAuth 2.0 access token from environment or localStorage
 *
 * For Vertex AI, you need an OAuth 2.0 access token, not an API key.
 *
 * To get a token:
 * 1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
 * 2. Run: gcloud auth print-access-token
 * 3. Set the token in localStorage or VITE_VERTEX_AI_TOKEN
 */
export function getVeoApiKey(): string | null {
  // Priority 1: Vertex AI specific token
  // @ts-ignore
  if (import.meta.env?.VITE_VERTEX_AI_TOKEN) {
    // @ts-ignore
    return import.meta.env.VITE_VERTEX_AI_TOKEN;
  }

  // Priority 2: localStorage vertex token
  const vertexToken = localStorage.getItem('vertex_ai_token');
  if (vertexToken) {
    return vertexToken;
  }

  // Priority 3: Generic Google API key (may not work for Vertex AI)
  // @ts-ignore
  if (import.meta.env?.VITE_GOOGLE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_GOOGLE_API_KEY;
  }

  // Priority 4: localStorage (Gemini key - may not work for Vertex AI)
  return localStorage.getItem('gemini_api_key');
}
