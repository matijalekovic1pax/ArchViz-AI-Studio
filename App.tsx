

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, X, Layers, SlidersHorizontal } from 'lucide-react';
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
import { PdfCompressionView } from './components/PdfCompressionView';
import { GenerationMode } from './types';
import { cn } from './lib/utils';
import { VideoLockBanner } from './components/video/VideoLockBanner';
import { MobilePanels, MobilePanelType } from './components/panels/mobile/MobilePanels';
import { UpgradeModal } from './components/billing/UpgradeModal';
import { BillingPage } from './components/billing/BillingPage';
import { TeamDashboard } from './components/billing/TeamDashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import { acceptTeamInvite } from './services/apiGateway';
import { useAuth } from './components/auth/AuthGate';
import { nanoid } from 'nanoid';
import { saveGeneration } from './services/generationStorageService';
import { CREDITS_PER_MODE } from './lib/stripePrices';

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
  const [mobilePanel, setMobilePanel] = useState<MobilePanelType>(null);

  useEffect(() => {
    if (!state.appAlert) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_APP_ALERT', payload: null });
    }, 8000);
    return () => clearTimeout(timer);
  }, [state.appAlert?.id, dispatch]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-accent selection:text-foreground">
      <TopBar onToggleMobilePanel={(panel) => setMobilePanel((prev) => (prev === panel ? null : panel))} />
      <MobilePanels active={mobilePanel} onClose={() => setMobilePanel(null)} />
      {showVideoLockOverlay && (
        <div
          className="fixed inset-y-0 right-0 left-0 lg:left-14 z-[80] bg-black/60 backdrop-blur-md flex items-center justify-center"
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
        <div className="hidden lg:flex h-full">
          <LeftSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="lg:hidden pointer-events-none">
            <div className="fixed top-24 left-3 z-[70] pointer-events-auto">
              <button
                onClick={() => setMobilePanel((prev) => (prev === 'workflow' ? null : 'workflow'))}
                className={cn(
                  "h-11 w-11 rounded-full border shadow-lg flex items-center justify-center transition-all",
                  mobilePanel === 'workflow'
                    ? "bg-foreground text-background border-foreground"
                    : "bg-surface-elevated text-foreground border-border hover:bg-surface-sunken"
                )}
                aria-label="Open workflow panel"
              >
                <Layers size={18} />
              </button>
            </div>
            <div className="fixed top-24 right-3 z-[70] pointer-events-auto">
              <button
                onClick={() => setMobilePanel((prev) => (prev === 'settings' ? null : 'settings'))}
                className={cn(
                  "h-11 w-11 rounded-full border shadow-lg flex items-center justify-center transition-all",
                  mobilePanel === 'settings'
                    ? "bg-foreground text-background border-foreground"
                    : "bg-surface-elevated text-foreground border-border hover:bg-surface-sunken"
                )}
                aria-label="Open settings panel"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>
          {state.mode === 'material-validation' ? (
            <MaterialValidationView />
          ) : state.mode === 'document-translate' ? (
            <DocumentTranslateView />
          ) : state.mode === 'pdf-compression' ? (
            <PdfCompressionView />
          ) : (
            <ImageCanvas />
          )}
          <FloatingGenerateButton />
          {state.mode !== 'document-translate' && state.mode !== 'pdf-compression' && <BottomPanel />}
        </div>
        <div className="hidden lg:flex h-full">
          <RightPanel />
        </div>
      </div>
    </div>
  );
};

/**
 * Watches the history array and fire-and-forgets new items to Supabase Storage.
 * Only persists real output images (not 'source' kind entries, not text-only modes).
 */
function GenerationPersister() {
  const { state } = useAppStore();
  const { user } = useAuth();
  const persisted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    for (const item of state.history) {
      if (persisted.current.has(item.id)) continue;
      if (item.settings?.kind === 'source') continue;
      if (!item.thumbnail?.startsWith('data:image/')) continue;
      persisted.current.add(item.id);
      saveGeneration({
        userId:       user.id,
        orgId:        user.org?.id ?? null,
        mode:         item.mode,
        imageDataUrl: item.thumbnail,
        prompt:       item.prompt ?? undefined,
        creditsUsed:  CREDITS_PER_MODE[item.mode] ?? 4,
      }).catch(() => {}); // fire-and-forget — failure is non-fatal
    }
  }, [state.history, user]);

  return null;
}

function InviteHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;
    params.delete('invite');
    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    acceptTeamInvite(token).catch(() => {});
  }, []);
  return null;
}

function CheckoutHandler() {
  const { dispatch } = useAppStore();
  const { refreshUser } = useAuth();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const credits = params.get('credits');
    if (!checkout && !credits) return;
    params.delete('checkout');
    params.delete('credits');
    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    refreshUser().catch(() => {});
    if (checkout === 'success') {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'info', message: 'Subscription activated! Your credits have been added.' }
      });
    }
    if (credits === 'purchased') {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'info', message: 'Credits purchased! They have been added to your balance.' }
      });
    }
    const video = params.get('video');
    if (video) {
      params.delete('video');
      const videoUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      window.history.replaceState({}, '', videoUrl);
      if (video === 'paid') {
        // Unlock video mode and switch to it
        dispatch({ type: 'UPDATE_VIDEO_STATE', payload: { accessUnlocked: true } });
        dispatch({ type: 'SET_MODE', payload: 'video' });
        dispatch({
          type: 'SET_APP_ALERT',
          payload: { id: nanoid(), tone: 'info', message: 'Payment confirmed! Video generation is now unlocked.' }
        });
      }
    }
  }, []);
  return null;
}

function AppRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (path === '/billing') return <BillingPage />;
  if (path === '/team') return <TeamDashboard />;
  if (path === '/admin') return <AdminPanel />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthGate>
      <AppProvider>
        <InviteHandler />
        <CheckoutHandler />
        <GenerationPersister />
        <AppRouter />
        <UpgradeModal />
      </AppProvider>
    </AuthGate>
  );
}
