/**
 * React Hook for Gemini API Service
 * Provides easy integration with React components
 */

import { useState, useCallback, useRef } from 'react';
import {
  GeminiService,
  GeminiRequest,
  GeminiResponse,
  BatchImageRequest,
  BatchImageResponse,
  ImageEditRequest,
  ImageData,
  GeminiError,
  GeminiConfig,
  GenerationConfig,
  ImageUtils
} from './geminiService';

export interface UseGeminiOptions {
  apiKey: string;
  model?: string;  // Any valid Gemini/Imagen model ID
  onError?: (error: GeminiError) => void;
}

export interface UseGeminiReturn {
  // State
  isLoading: boolean;
  error: GeminiError | null;
  response: GeminiResponse | null;

  // Core methods
  generate: (request: GeminiRequest) => Promise<GeminiResponse>;
  generateText: (prompt: string, images?: ImageData[]) => Promise<string>;
  generateImages: (prompt: string, images?: ImageData[], config?: GenerationConfig) => Promise<GeminiResponse>;

  // Batch methods
  generateBatch: (request: BatchImageRequest) => Promise<BatchImageResponse>;
  generateBatchParallel: (request: BatchImageRequest) => Promise<BatchImageResponse>;

  // Edit methods
  editImage: (request: ImageEditRequest) => Promise<GeminiResponse>;

  // Streaming
  generateStream: (request: GeminiRequest, onChunk: (chunk: Partial<GeminiResponse>) => void) => Promise<void>;

  // Chat
  chat: (
    messages: Array<{ role: 'user' | 'model'; content: string; images?: ImageData[] }>,
    config?: GenerationConfig
  ) => Promise<GeminiResponse>;

  // Utilities
  clearError: () => void;
  clearResponse: () => void;
  service: GeminiService;
}

export function useGemini(options: UseGeminiOptions): UseGeminiReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GeminiError | null>(null);
  const [response, setResponse] = useState<GeminiResponse | null>(null);

  // Create service instance (memoized)
  const serviceRef = useRef<GeminiService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new GeminiService({
      apiKey: options.apiKey,
      model: options.model
    });
  }
  const service = serviceRef.current;

  // Error handler wrapper
  const handleError = useCallback((err: unknown) => {
    const geminiError = err instanceof GeminiError
      ? err
      : new GeminiError(err instanceof Error ? err.message : 'Unknown error');

    setError(geminiError);
    options.onError?.(geminiError);
    throw geminiError;
  }, [options]);

  // Core generate method
  const generate = useCallback(async (request: GeminiRequest): Promise<GeminiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.generate(request);
      setResponse(result);
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Generate text only
  const generateText = useCallback(async (
    prompt: string,
    images?: ImageData[]
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.generateText({ prompt, images });
      setResponse({ text: result, images: [] });
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Generate images
  const generateImages = useCallback(async (
    prompt: string,
    images?: ImageData[],
    config?: GenerationConfig
  ): Promise<GeminiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.generateImages({
        prompt,
        images,
        generationConfig: config
      });
      setResponse(result);
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Batch generation
  const generateBatch = useCallback(async (
    request: BatchImageRequest
  ): Promise<BatchImageResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.generateBatchImages(request);
      setResponse({ text: result.text, images: result.images, usage: result.usage });
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Parallel batch generation
  const generateBatchParallel = useCallback(async (
    request: BatchImageRequest
  ): Promise<BatchImageResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.generateBatchImagesParallel(request);
      setResponse({ text: result.text, images: result.images, usage: result.usage });
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Image editing
  const editImage = useCallback(async (
    request: ImageEditRequest
  ): Promise<GeminiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.editImage(request);
      setResponse(result);
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Streaming generation
  const generateStream = useCallback(async (
    request: GeminiRequest,
    onChunk: (chunk: Partial<GeminiResponse>) => void
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      let finalResponse: GeminiResponse = { text: null, images: [] };

      for await (const chunk of service.generateStream(request)) {
        onChunk(chunk);
        if (chunk.text) finalResponse.text = chunk.text;
        if (chunk.images) finalResponse.images = chunk.images;
      }

      setResponse(finalResponse);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Chat method
  const chat = useCallback(async (
    messages: Array<{ role: 'user' | 'model'; content: string; images?: ImageData[] }>,
    config?: GenerationConfig
  ): Promise<GeminiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await service.chat(messages, config);
      setResponse(result);
      return result;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [service, handleError]);

  // Utility methods
  const clearError = useCallback(() => setError(null), []);
  const clearResponse = useCallback(() => setResponse(null), []);

  return {
    isLoading,
    error,
    response,
    generate,
    generateText,
    generateImages,
    generateBatch,
    generateBatchParallel,
    editImage,
    generateStream,
    chat,
    clearError,
    clearResponse,
    service
  };
}

// Re-export utilities for convenience
export { ImageUtils, GeminiError };
export type {
  GeminiConfig,
  GeminiRequest,
  GeminiResponse,
  BatchImageRequest,
  BatchImageResponse,
  ImageEditRequest,
  ImageData,
  GenerationConfig
};
