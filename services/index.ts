/**
 * Services Index
 * Central export point for all services
 */

// Gemini Service exports
export {
  GeminiService,
  GeminiError,
  ImageUtils,
  initGeminiService,
  getGeminiService,
  isGeminiServiceInitialized
} from './geminiService';

export type {
  GeminiConfig,
  GeminiRequest,
  GeminiResponse,
  GenerationConfig,
  ImageConfig,
  ImageData,
  ImageMimeType,
  GeneratedImage,
  BatchImageRequest,
  BatchImageResponse,
  ImageEditRequest
} from './geminiService';

// React Hook exports
export { useGemini } from './useGemini';
export type { UseGeminiOptions, UseGeminiReturn } from './useGemini';
