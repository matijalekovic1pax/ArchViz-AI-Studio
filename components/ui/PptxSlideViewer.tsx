import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { init } from 'pptx-preview';

interface PptxSlideViewerProps {
  dataUrl: string;
  className?: string;
}

interface ViewerDimensions {
  width: number;
  height: number;
}

const MIN_VIEWER_WIDTH = 360;
const MAX_VIEWER_WIDTH = 1180;

export const PptxSlideViewer: React.FC<PptxSlideViewerProps> = ({ dataUrl, className }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const viewerHostRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<ViewerDimensions | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const updateDimensions = () => {
      const availableWidth = Math.max(0, shell.clientWidth - 64);
      const availableHeight = Math.max(0, shell.clientHeight - 136);
      const width = Math.max(MIN_VIEWER_WIDTH, Math.min(MAX_VIEWER_WIDTH, availableWidth));
      const height = Math.max(240, Math.min(availableHeight, Math.round(width * 9 / 16)));

      setDimensions((current) => {
        if (current && Math.abs(current.width - width) < 24 && Math.abs(current.height - height) < 24) {
          return current;
        }
        return { width, height };
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(shell);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions || !viewerHostRef.current) return;

    let cancelled = false;
    const host = viewerHostRef.current;

    const resetPreviewer = () => {
      previewerRef.current?.destroy?.();
      previewerRef.current = null;
      host.innerHTML = '';
    };

    const loadPresentation = async () => {
      setLoading(true);
      setError(null);
      setSlideCount(0);
      setCurrentSlide(0);
      resetPreviewer();

      try {
        const arrayBuffer = await dataUrlToArrayBuffer(dataUrl);
        if (cancelled) return;

        const previewer = init(host, {
          width: dimensions.width,
          height: dimensions.height,
          mode: 'slide',
        });
        previewerRef.current = previewer;

        const pptx = await previewer.load(arrayBuffer);
        if (cancelled) {
          previewer.destroy();
          return;
        }

        const totalSlides = Math.max(0, pptx?.slides?.length ?? previewer.slideCount ?? 0);
        if (totalSlides === 0) {
          throw new Error('No slides found in this presentation.');
        }

        previewer.renderSingleSlide(0);
        setSlideCount(totalSlides);
        setCurrentSlide(0);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          resetPreviewer();
          setError(err instanceof Error ? err.message : 'Failed to render PowerPoint preview.');
          setLoading(false);
        }
      }
    };

    loadPresentation();

    return () => {
      cancelled = true;
      resetPreviewer();
    };
  }, [dataUrl, dimensions]);

  const renderSlide = (slideIndex: number) => {
    if (!previewerRef.current || slideIndex < 0 || slideIndex >= slideCount) return;
    previewerRef.current.renderSingleSlide(slideIndex);
    setCurrentSlide(slideIndex);
  };

  return (
    <div ref={shellRef} className={`relative h-full w-full overflow-hidden bg-gray-200 ${className ?? ''}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 py-5">
        <div
          ref={viewerHostRef}
          className="pptx-slide-viewer-host max-w-full overflow-hidden rounded bg-black shadow-xl"
          style={{
            width: dimensions?.width ?? MAX_VIEWER_WIDTH,
            height: dimensions?.height ?? 664,
          }}
        />

        {!loading && !error && slideCount > 0 && (
          <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={() => renderSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Previous slide"
              title="Previous slide"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-16 text-center text-xs font-semibold text-gray-700">
              {currentSlide + 1} / {slideCount}
            </span>
            <button
              type="button"
              onClick={() => renderSlide(currentSlide + 1)}
              disabled={currentSlide >= slideCount - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Next slide"
              title="Next slide"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200/85">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="text-sm text-foreground-muted">Rendering presentation preview...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="max-w-sm px-4 text-center">
            <FileText size={52} className="mx-auto mb-4 text-red-500 opacity-30" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Failed to render presentation</h3>
            <p className="text-sm text-foreground-muted">
              This PowerPoint file could not be rendered in the browser preview. You can still translate it.
            </p>
            {error && <p className="mt-2 text-xs text-foreground-muted opacity-70">{error}</p>}
          </div>
        </div>
      )}

      <style>{`
        .pptx-slide-viewer-host .pptx-preview-wrapper {
          background: #111827 !important;
          margin: 0 auto !important;
          overflow: hidden !important;
        }
        .pptx-slide-viewer-host .pptx-preview-slide-wrapper {
          box-shadow: none !important;
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
};

async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const commaIndex = dataUrl.indexOf(',');
  const metadata = commaIndex >= 0 ? dataUrl.slice(0, commaIndex).toLowerCase() : '';
  if (dataUrl.slice(0, 5).toLowerCase() !== 'data:' || commaIndex < 0 || !metadata.includes(';base64')) {
    throw new Error('Invalid presentation data URL.');
  }

  const base64 = dataUrl.slice(commaIndex + 1).replace(/\s/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLength);
  const chunkSize = 32768;
  let offset = 0;

  for (let start = 0; start < base64.length; start += chunkSize) {
    const binary = atob(base64.slice(start, start + chunkSize));
    for (let i = 0; i < binary.length && offset < byteLength; i++) {
      bytes[offset++] = binary.charCodeAt(i);
    }
  }

  return bytes.buffer;
}
