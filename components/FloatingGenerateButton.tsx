
import React from 'react';
import { useAppStore } from '../store';
import { Sparkles, Loader2 } from 'lucide-react';
import { useGeneration } from '../hooks/useGeneration';

export const FloatingGenerateButton: React.FC = () => {
  const { state } = useAppStore();
  const { generate, isReady } = useGeneration();

  // If in chat mode, the chat interface has its own send button.
  if (state.mode === 'generate-text') return null;

  const handleGenerate = async () => {
    if (!state.uploadedImage || state.isGenerating) return;
    await generate();
  };

  const isDisabled = !state.uploadedImage || !isReady;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <button
        aria-label="generate-trigger"
        onClick={handleGenerate}
        disabled={isDisabled || state.isGenerating}
        className={`
          flex items-center gap-3 px-8 py-3.5 rounded-full shadow-elevated transition-all duration-300
          ${isDisabled
            ? 'bg-surface-sunken text-foreground-muted cursor-not-allowed'
            : 'bg-foreground text-background hover:scale-105 active:scale-95'
          }
        `}
      >
        {state.isGenerating ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            <span className="font-medium">Generating... {state.progress}%</span>
          </>
        ) : (
          <>
            <Sparkles size={18} />
            <span className="font-medium tracking-wide">Generate Render</span>
          </>
        )}
      </button>
    </div>
  );
};
