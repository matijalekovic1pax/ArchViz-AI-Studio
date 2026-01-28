

import React, { useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { AppProvider, useAppStore } from './store';
import { AuthGate } from './components/auth/AuthGate';
import { TopBar } from './components/panels/TopBar';
import { LeftSidebar } from './components/panels/left/LeftSidebar';
import { RightPanel } from './components/panels/right/RightPanel';
import { BottomPanel } from './components/panels/bottom/BottomPanel';
import { ImageCanvas } from './components/canvas/ImageCanvas';
import { FloatingGenerateButton } from './components/FloatingGenerateButton';
import { MaterialValidationView } from './components/MaterialValidationView';
import { DocumentTranslateView } from './components/DocumentTranslateView';
import { GenerationMode } from './types';
import { cn } from './lib/utils';
import { VideoLockBanner } from './components/video/VideoLockBanner';

const ShortcutsListener: React.FC = () => {
  const { state, dispatch } = useAppStore();

  useEffect(() => {
    // Session protection: Warn user before closing tab
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if there is an uploaded image or some history
      if (state.uploadedImage || state.history.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires this to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if input is focused
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // Cmd/Ctrl + Enter = Generate
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (state.uploadedImage && !state.isGenerating) {
           const btn = document.querySelector('button[aria-label="generate-trigger"]') as HTMLButtonElement;
           if (btn) btn.click();
        }
      }

      // Mode Switching (Cmd + 1-9)
      if (e.metaKey || e.ctrlKey) {
        const modes: GenerationMode[] = [
          'render-3d', 'render-cad', 'masterplan', 'visual-edit', 
          'exploded', 'section', 'render-sketch', 'upscale', 'img-to-cad', 'img-to-3d', 'video'
        ];
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9 && modes[num - 1]) {
           dispatch({ type: 'SET_MODE', payload: modes[num - 1] });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.uploadedImage, state.isGenerating, state.history.length, dispatch]);

  return null;
};

const Layout: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const showVideoLockOverlay = state.mode === 'video' && !state.workflow.videoState.accessUnlocked;

  useEffect(() => {
    if (!state.appAlert) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_APP_ALERT', payload: null });
    }, 8000);
    return () => clearTimeout(timer);
  }, [state.appAlert?.id, dispatch]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-accent selection:text-foreground">
      <TopBar />
      {showVideoLockOverlay && (
        <div
          className="fixed inset-y-0 right-0 z-[80] bg-black/60 backdrop-blur-md flex items-center justify-center"
          style={{ left: 56, width: 'calc(100% - 56px)' }}
        >
          <div className="w-[92vw] max-w-md pointer-events-auto">
            <VideoLockBanner />
          </div>
        </div>
      )}
      {state.appAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] w-[92vw] max-w-xl">
          <div
            role="alert"
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur bg-surface-elevated/95",
              state.appAlert.tone === 'warning' && "border-amber-200 text-amber-900 bg-amber-50/95",
              state.appAlert.tone === 'error' && "border-red-200 text-red-900 bg-red-50/95"
            )}
          >
            <div className={cn(
              "mt-0.5",
              state.appAlert.tone === 'warning' && "text-amber-600",
              state.appAlert.tone === 'error' && "text-red-600"
            )}>
              {state.appAlert.tone === 'info' ? <Info size={16} /> : <AlertTriangle size={16} />}
            </div>
            <div className="text-sm font-medium flex-1">{state.appAlert.message}</div>
            <button
              className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
              onClick={() => dispatch({ type: 'SET_APP_ALERT', payload: null })}
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <ShortcutsListener />
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          {state.mode === 'material-validation' ? (
             <MaterialValidationView />
          ) : state.mode === 'document-translate' ? (
             <DocumentTranslateView />
          ) : (
             <ImageCanvas />
          )}
          <FloatingGenerateButton />
          {state.mode !== 'document-translate' && <BottomPanel />}
        </div>
        <RightPanel />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthGate>
      <AppProvider>
        <Layout />
      </AppProvider>
    </AuthGate>
  );
}
