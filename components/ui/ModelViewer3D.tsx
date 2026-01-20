import React, { useEffect, useRef } from 'react';

interface ModelViewer3DProps {
  modelUrl?: string | null;
  autoRotate?: boolean;
  showGrid?: boolean;
  height?: string;
}

// Load model-viewer script once
let scriptLoaded = false;
const loadModelViewerScript = () => {
  if (scriptLoaded) return Promise.resolve();

  return new Promise<void>((resolve) => {
    if (document.querySelector('script[src*="model-viewer"]')) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    document.head.appendChild(script);
  });
};

export const ModelViewer3D: React.FC<ModelViewer3DProps> = ({
  modelUrl = null,
  autoRotate = true,
  height = '300px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    loadModelViewerScript().then(() => setReady(true));
  }, []);

  useEffect(() => {
    setError(null);
  }, [modelUrl]);

  // Check file extension
  const getExtension = (url: string): string => {
    if (url.startsWith('blob:')) {
      return (window as any).__modelExtension || 'glb';
    }
    const match = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
    return match ? match[1] : 'glb';
  };

  const isSupported = modelUrl ? ['glb', 'gltf'].includes(getExtension(modelUrl)) : true;

  if (!ready) {
    return (
      <div className="flex flex-col">
        <div
          className="bg-[#1a1a1a] border border-border rounded-lg overflow-hidden flex items-center justify-center"
          style={{ height }}
        >
          <span className="text-xs text-foreground-muted">Loading viewer...</span>
        </div>
      </div>
    );
  }

  if (modelUrl && !isSupported) {
    const ext = getExtension(modelUrl);
    return (
      <div className="flex flex-col">
        <div
          className="bg-[#1a1a1a] border border-border rounded-lg overflow-hidden flex flex-col items-center justify-center gap-2"
          style={{ height }}
        >
          <span className="text-xs text-foreground-muted">Format .{ext} not supported</span>
          <span className="text-[10px] text-foreground-muted opacity-60">Use GLB or GLTF files</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div
        ref={containerRef}
        className="bg-[#1a1a1a] border border-border rounded-lg overflow-hidden relative"
        style={{ height }}
      >
        {modelUrl ? (
          <model-viewer
            src={modelUrl}
            auto-rotate={autoRotate ? '' : undefined}
            camera-controls
            shadow-intensity="1"
            environment-image="neutral"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1a1a1a',
            }}
            onError={() => setError('Failed to load model')}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-foreground-muted opacity-30 mb-2"
            >
              <path d="M12 3L2 7.5L12 12L22 7.5L12 3Z" />
              <path d="M2 12L12 16.5L22 12" />
              <path d="M2 16.5L12 21L22 16.5" />
            </svg>
            <span className="text-xs text-foreground-muted opacity-50">No model loaded</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}
      </div>
      <div className="text-[10px] text-foreground-muted text-center mt-2 opacity-60">
        Drag to rotate • Scroll to zoom • Right-drag to pan
      </div>
    </div>
  );
};

// TypeScript declaration for model-viewer custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          'auto-rotate'?: string;
          'camera-controls'?: boolean;
          'shadow-intensity'?: string;
          'environment-image'?: string;
          poster?: string;
          onError?: () => void;
        },
        HTMLElement
      >;
    }
  }
}
