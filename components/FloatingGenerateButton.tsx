
import React from 'react';
import { useAppStore } from '../store';
import { Sparkles, Loader2 } from 'lucide-react';
import { useGeneration } from '../hooks/useGeneration';

export const FloatingGenerateButton: React.FC = () => {
  const { state } = useAppStore();
  const { generate, isReady, cancelGeneration } = useGeneration();

  // Don't show in any mode - TopBar button handles everything
  return null;

  const handleGenerate = async () => {
    if (!state.uploadedImage || state.isGenerating) return;
    await generate();
  };

  const isDisabled = !state.uploadedImage || !isReady;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="relative flex items-center">
        <div className="relative">
          {showGenerateButton ? (
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
          ) : (
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-full shadow-elevated bg-foreground text-background">
              <Loader2 className="animate-spin" size={18} />
              <span className="font-medium">Generating...</span>
            </div>
          )}
          {showCancelButton && (
            <>
              <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 h-2.5 w-8 rounded-full bg-red-500/40 blur-[1px] animate-liquid-bridge" />
              <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-red-500/80 shadow-sm animate-liquid-blob" />
            </>
          )}
        </div>

        {showCancelButton && (
          <div className="ml-2 origin-left animate-cancel-emerge">
            <button
              aria-label="cancel-generation"
              onClick={cancelGeneration}
              className="flex items-center gap-2 px-4 py-3.5 rounded-full shadow-elevated bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all duration-200"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Cancel</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
