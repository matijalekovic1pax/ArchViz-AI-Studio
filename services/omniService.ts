/**
 * Omni Service - Google Gemini Omni Flash video generation
 * All API calls go through the API gateway — no API keys in the client.
 *
 * Unlike Veo (a predictLongRunning model), Omni runs on the stateful
 * Interactions API. The gateway starts a background interaction and returns an
 * interaction id, which doubles as the handle for editing or extending the
 * generated video in a later turn.
 *
 * Duration: 3-10 seconds (prompt-driven — the API has no duration parameter)
 * Resolution: 360p / 720p / 1080p / 4K at 24 FPS
 * Aspect ratio: 16:9 or 9:16
 */

import type { VideoGenerationProgress, ImageData, OmniVideoTask } from '../types';
import {
  omniGenerate,
  omniCheckStatus,
  omniFetchVideo,
  veoDownloadVideo,
  type OmniStatusResult,
} from './apiGateway';

const POLL_INTERVAL_MS = 3000;

export const OMNI_MODEL_ID = 'gemini-omni-1.1-flash';

// Error Class
export class OmniError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'OmniError';
  }
}

// Request Options
export interface OmniGenerationOptions {
  prompt: string;
  inputImage?: ImageData;
  /** Extra style/subject references — maps to the reference_to_video task */
  referenceImages?: ImageData[];
  aspectRatio?: '16:9' | '9:16';
  resolution?: '360p' | '720p' | '1080p' | '4k';
  task?: OmniVideoTask;
  /** Chain onto a previous interaction to edit or extend that video */
  previousInteractionId?: string;
  onProgress?: (progress: VideoGenerationProgress) => void;
  abortSignal?: AbortSignal;
}

// Response
export interface OmniResponse {
  videoUrl: string;
  thumbnailUrl?: string;
  /** Handle for editing/extending this video in a follow-up request */
  interactionId?: string;
  expiresAt: Date;
}

/** Convert an ImageData to the gateway's image payload shape */
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

const base64ToBlobUrl = (base64: string, mimeType = 'video/mp4'): string => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
};

// Service Class
class OmniService {
  constructor() {
    // No API keys needed — gateway handles auth
  }

  /**
   * Generate video using Gemini Omni Flash via API gateway
   */
  async generateVideo(options: OmniGenerationOptions): Promise<OmniResponse> {
    const {
      prompt,
      inputImage,
      referenceImages,
      aspectRatio = '16:9',
      resolution = '1080p',
      task,
      previousInteractionId,
      onProgress,
      abortSignal,
    } = options;

    onProgress?.({
      phase: 'initializing',
      progress: 0,
      message: previousInteractionId
        ? 'Continuing the Omni Flash interaction...'
        : 'Initializing Gemini Omni Flash video generation...',
    });

    try {
      const imageData = inputImage ? toApiImage(inputImage) : undefined;
      const referenceData = (referenceImages || [])
        .map(toApiImage)
        .filter((img): img is { bytesBase64Encoded: string; mimeType: string } => !!img);

      onProgress?.({
        phase: 'processing',
        progress: 20,
        message: 'Sending request to API gateway...',
      });

      const result = await omniGenerate({
        prompt,
        image: imageData,
        referenceImages: referenceData.length > 0 ? referenceData : undefined,
        model: OMNI_MODEL_ID,
        task,
        aspectRatio,
        resolution,
        previousInteractionId,
      });

      if (result.status === 'error') {
        throw new OmniError(result.error || 'Video generation failed');
      }

      let completed: OmniStatusResult | undefined;

      if (result.status === 'complete') {
        completed = result;
      } else if (result.status === 'processing' && result.interactionId) {
        onProgress?.({
          phase: 'rendering',
          progress: 40,
          message: 'Rendering video...',
        });
        completed = await this.pollForCompletion(result.interactionId, onProgress, abortSignal);
      }

      if (!completed) {
        throw new OmniError('Unexpected response from API gateway');
      }

      onProgress?.({ phase: 'rendering', progress: 92, message: 'Downloading video...' });
      const playableUrl = await this.resolveVideoUrl(completed);

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Video ready!',
        videoUrl: playableUrl,
      });

      return {
        videoUrl: playableUrl,
        interactionId: completed.interactionId,
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      if (error instanceof OmniError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new OmniError('Video generation cancelled');
      }

      throw new OmniError(
        error instanceof Error ? error.message : 'Unknown error during video generation',
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Turn a completed status payload into a URL the <video> element can play
   */
  private async resolveVideoUrl(completed: OmniStatusResult): Promise<string> {
    // Small clips come back inline
    if (completed.videoBase64) {
      return base64ToBlobUrl(completed.videoBase64, completed.mimeType);
    }

    // Anything else is streamed as binary through the gateway, which knows how
    // to authenticate against the Files API
    if (completed.interactionId) {
      try {
        return await omniFetchVideo(completed.interactionId);
      } catch (error) {
        if (!completed.videoUrl) throw error;
      }
    }

    if (completed.videoUrl) {
      try {
        return await veoDownloadVideo(completed.videoUrl);
      } catch {
        return completed.videoUrl;
      }
    }

    throw new OmniError('No video was returned by the model');
  }

  /**
   * Poll the stored interaction until it completes
   */
  private async pollForCompletion(
    interactionId: string,
    onProgress?: (progress: VideoGenerationProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<OmniStatusResult> {
    let attempts = 0;
    const maxAttempts = 120; // 6 minutes max (120 * 3s)

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        throw new OmniError('Video generation cancelled');
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      attempts++;

      const progress = Math.min(40 + (attempts / maxAttempts) * 50, 90);
      onProgress?.({
        phase: 'rendering',
        progress,
        message: `Generating video... (${Math.floor((attempts * POLL_INTERVAL_MS) / 1000)}s elapsed)`,
        estimatedTimeRemaining: Math.max(0, ((maxAttempts - attempts) * POLL_INTERVAL_MS) / 1000),
      });

      try {
        const status = await omniCheckStatus(interactionId);

        if (status.status === 'complete') {
          return { ...status, interactionId: status.interactionId || interactionId };
        }

        if (status.status === 'error') {
          throw new OmniError(status.error || 'Video generation failed');
        }

        // Still processing, continue polling
      } catch (error) {
        if (error instanceof OmniError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new OmniError('Video generation cancelled');
        }
        // Continue polling on network errors
      }
    }

    throw new OmniError('Video generation timed out after 6 minutes');
  }
}

// Singleton instance
let serviceInstance: OmniService | null = null;

/**
 * Initialize Omni service (no API key needed — gateway handles auth)
 */
export function initOmniService(): OmniService {
  serviceInstance = new OmniService();
  return serviceInstance;
}

/**
 * Get Omni service instance
 */
export function getOmniService(): OmniService {
  if (!serviceInstance) {
    serviceInstance = new OmniService();
  }
  return serviceInstance;
}

/**
 * Check if Omni service is initialized
 */
export function isOmniServiceInitialized(): boolean {
  return serviceInstance !== null;
}
