export const AI_SLOP_UPSCALER_SUGGESTION_EVENT = 'archviz:assistant-ai-slop-suggestion';

export interface AiSlopUpscalerSuggestionDetail {
  id: string;
  score?: number;
  summary?: string;
  indicators?: string[];
}
