

import React, { useEffect } from 'react';
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
  const { state } = useAppStore();

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-accent selection:text-foreground">
      <TopBar />
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
          <BottomPanel />
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
