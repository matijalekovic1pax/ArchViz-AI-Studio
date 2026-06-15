import type { GenerationProgressStage } from '../types';

export const GENERATION_STAGE_LABEL_KEYS: Record<GenerationProgressStage, string> = {
  preparing: 'generation.stages.preparing',
  aiLayer: 'generation.stages.aiLayer',
  generation: 'generation.stages.generation',
  transfer: 'generation.stages.transfer',
  finalizing: 'generation.stages.finalizing',
  complete: 'generation.stages.complete',
};

export const getGenerationProgressPercent = (progress: number): number =>
  Math.round(Math.min(100, Math.max(0, progress)));
