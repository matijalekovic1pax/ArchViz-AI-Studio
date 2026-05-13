import React, { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';

interface DocxPageViewerProps {
  dataUrl: string;
  className?: string;
}

export const DocxPageViewer: React.FC<DocxPageViewerProps> = ({ dataUrl, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const renderDocument = async () => {
      setLoading(true);
      setError(null);
      container.innerHTML = '';

      try {
        const bytes = dataUrlToBytes(dataUrl);
        if (cancelled) return;

        await renderAsync(bytes, container, container, {
          className: 'docx-page-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderComments: false,
          renderAltChunks: true,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: false,
        });

        if (cancelled) return;

        const fitPages = () => fitPagesToContainer(container);
        fitPages();
        requestAnimationFrame(fitPages);
        window.setTimeout(fitPages, 150);
        window.setTimeout(fitPages, 600);

        resizeObserver = new ResizeObserver(fitPages);
        resizeObserver.observe(container);

        container.querySelectorAll('img').forEach((image) => {
          image.addEventListener('load', fitPages, { once: true });
        });

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          container.innerHTML = '';
          setError(err instanceof Error ? err.message : 'Failed to render Word preview.');
          setLoading(false);
        }
      }
    };

    renderDocument();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      container.innerHTML = '';
    };
  }, [dataUrl]);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gray-200 ${className ?? ''}`}>
      <div
        ref={containerRef}
        className="docx-page-viewer-host h-full w-full overflow-y-auto overflow-x-hidden px-3 py-6 sm:px-5"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200/85">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="text-sm text-foreground-muted">Rendering Word preview...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="max-w-sm px-4 text-center">
            <FileText size={52} className="mx-auto mb-4 text-red-500 opacity-30" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Failed to render Word document</h3>
            <p className="text-sm text-foreground-muted">
              This Word file could not be rendered in the browser preview. You can still translate it.
            </p>
            <p className="mt-2 text-xs text-foreground-muted opacity-70">{error}</p>
          </div>
        </div>
      )}

      <style>{`
        .docx-page-viewer-host .docx-wrapper,
        .docx-page-viewer-host .docx-page-preview-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow: visible !important;
        }
        .docx-page-viewer-host .docx-page-scale-frame {
          flex: 0 0 auto !important;
          margin: 0 auto 24px !important;
          overflow: visible !important;
          position: relative !important;
        }
        .docx-page-viewer-host section.docx-page-preview,
        .docx-page-viewer-host .docx-page-preview-wrapper section.docx-page-preview {
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16) !important;
          margin: 0 !important;
          max-width: none !important;
        }
      `}</style>
    </div>
  );
};

function fitPagesToContainer(container: HTMLElement) {
  const wrapper = container.querySelector<HTMLElement>('.docx-page-preview-wrapper, .docx-wrapper');
  const pages = Array.from(container.querySelectorAll<HTMLElement>('section.docx-page-preview'));

  if (!wrapper || pages.length === 0) {
    return;
  }

  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.width = '100%';
  wrapper.style.maxWidth = '100%';
  wrapper.style.minWidth = '0';
  wrapper.style.overflow = 'visible';

  const containerStyles = window.getComputedStyle(container);
  const horizontalPadding =
    parseFloat(containerStyles.paddingLeft || '0') + parseFloat(containerStyles.paddingRight || '0');
  const availableWidth = Math.max(240, container.clientWidth - horizontalPadding - 8);
  const pageSizes = pages.map((page) => getPageSize(page));
  const widestPage = Math.max(...pageSizes.map((size) => size.width));
  const scale = widestPage > 0 ? Math.min(1, availableWidth / widestPage) : 1;

  pages.forEach((page, index) => {
    const size = pageSizes[index];
    const frame = ensureScaleFrame(page);

    frame.style.width = `${Math.round(size.width * scale)}px`;
    frame.style.height = `${Math.round(size.height * scale)}px`;
    frame.style.margin = index === pages.length - 1 ? '0 auto' : '0 auto 24px';

    page.style.position = 'absolute';
    page.style.left = '0';
    page.style.top = '0';
    page.style.width = `${size.width}px`;
    page.style.height = `${size.height}px`;
    page.style.margin = '0';
    page.style.transform = `scale(${scale})`;
    page.style.transformOrigin = 'top left';
  });
}

function ensureScaleFrame(page: HTMLElement): HTMLElement {
  const parent = page.parentElement;
  if (parent?.classList.contains('docx-page-scale-frame')) {
    return parent;
  }

  const frame = document.createElement('div');
  frame.className = 'docx-page-scale-frame';
  page.before(frame);
  frame.appendChild(page);
  return frame;
}

function getPageSize(page: HTMLElement) {
  const storedWidth = Number(page.dataset.docxOriginalWidth);
  const storedHeight = Number(page.dataset.docxOriginalHeight);

  if (storedWidth > 0 && storedHeight > 0) {
    return { width: storedWidth, height: storedHeight };
  }

  const width = Math.ceil(page.offsetWidth || page.scrollWidth || page.getBoundingClientRect().width);
  const height = Math.ceil(page.offsetHeight || page.scrollHeight || page.getBoundingClientRect().height);

  page.dataset.docxOriginalWidth = String(width);
  page.dataset.docxOriginalHeight = String(height);

  return { width, height };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  const metadata = commaIndex >= 0 ? dataUrl.slice(0, commaIndex).toLowerCase() : '';
  if (dataUrl.slice(0, 5).toLowerCase() !== 'data:' || commaIndex < 0 || !metadata.includes(';base64')) {
    throw new Error('Invalid Word document data URL.');
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

  return bytes;
}
