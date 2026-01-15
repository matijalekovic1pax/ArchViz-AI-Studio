
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Sparkles, Loader2 } from 'lucide-react';
import { generatePrompt } from '../engine/promptEngine';
import { nanoid } from 'nanoid';

export const FloatingGenerateButton: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const latestStateRef = useRef(state);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // If in chat mode, the chat interface has its own send button.
  if (state.mode === 'generate-text') return null;

  const handleGenerate = () => {
    if (!state.uploadedImage || state.isGenerating) return;
    
    dispatch({ type: 'SET_GENERATING', payload: true });
    
    // Simulate generation
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      dispatch({ type: 'SET_PROGRESS', payload: progress });
      if (progress >= 100) {
        clearInterval(interval);
        dispatch({ type: 'SET_GENERATING', payload: false });
        dispatch({ type: 'SET_PROGRESS', payload: 0 });
        const latestState = latestStateRef.current;
        if (latestState.uploadedImage) {
          dispatch({ 
            type: 'ADD_HISTORY', 
            payload: {
              id: nanoid(),
              timestamp: Date.now(),
              thumbnail: latestState.uploadedImage,
              prompt: generatePrompt(latestState),
              attachments: [],
              mode: latestState.mode
            }
          });
        }
      }
    }, 50);
  };

  const isDisabled = !state.uploadedImage;

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
