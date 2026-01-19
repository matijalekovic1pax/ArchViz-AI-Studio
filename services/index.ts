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
  GeminiModel,
  GeminiRequest,
  GeminiResponse,
  GenerationConfig,
  SafetySetting,
  ImageData,
  ImageMimeType,
  GeneratedImage,
  UsageMetadata,
  SafetyRating,
  BatchImageRequest,
  BatchImageResponse,
  ImageEditRequest
} from './geminiService';

// React Hook exports
export { useGemini } from './useGemini';
export type { UseGeminiOptions, UseGeminiReturn } from './useGemini';
