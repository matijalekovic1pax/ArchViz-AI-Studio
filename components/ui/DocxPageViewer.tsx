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
      container.innerHTML = '';
    };
  }, [dataUrl]);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gray-200 ${className ?? ''}`}>
      <div
        ref={containerRef}
        className="docx-page-viewer-host h-full w-full overflow-auto px-4 py-6 sm:px-8"
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
        .docx-page-viewer-host .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
        }
        .docx-page-viewer-host section.docx-page-preview,
        .docx-page-viewer-host .docx-page-preview-wrapper section.docx-page-preview {
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16) !important;
          margin: 0 auto 24px !important;
        }
      `}</style>
    </div>
  );
};

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
