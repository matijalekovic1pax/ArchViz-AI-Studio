import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
// @ts-ignore - Vite resolves this correctly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, FileText } from 'lucide-react';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfCanvasViewerProps {
  dataUrl: string;
  className?: string;
}

interface PageEntry {
  pageNum: number;
  canvas: HTMLCanvasElement | null;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ dataUrl, className }) => {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      // Cancel any in-flight render tasks from previous load
      renderTasksRef.current.forEach(task => task.cancel());
      renderTasksRef.current.clear();

      // Destroy previous document
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }

      try {
        const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) throw new Error('Invalid PDF data URL');

        const binary = atob(base64Match[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const pdf = await getDocument({ data: bytes }).promise;
        if (destroyed) { pdf.destroy(); return; }

        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          setError(e?.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      destroyed = true;
      renderTasksRef.current.forEach(task => task.cancel());
      renderTasksRef.current.clear();
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [dataUrl]);

  // Render a page once its canvas node is mounted
  const renderPage = async (pageNum: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !pdfRef.current) return;

    // Cancel any existing render task for this page
    renderTasksRef.current.get(pageNum)?.cancel();

    try {
      const page = await pdfRef.current.getPage(pageNum);
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min((containerWidth - 32) / viewport.width, 2);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const task = page.render({ canvasContext: ctx, viewport: scaledViewport });
      renderTasksRef.current.set(pageNum, task);
      await task.promise;
      renderTasksRef.current.delete(pageNum);
    } catch (e: any) {
      // Ignore cancelled renders
      if (e?.name !== 'RenderingCancelledException') {
        console.warn(`PDF page ${pageNum} render failed:`, e);
      }
    }
  };

  const setCanvasRef = (pageNum: number) => (el: HTMLCanvasElement | null) => {
    canvasRefs.current.set(pageNum, el);
    if (el) renderPage(pageNum, el);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className ?? ''}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="text-sm text-foreground-muted">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className ?? ''}`}>
        <div className="text-center max-w-sm px-4">
          <FileText size={48} className="mx-auto mb-3 opacity-30 text-red-500" />
          <p className="text-sm text-foreground-muted">Failed to render PDF</p>
          <p className="text-xs text-foreground-muted mt-1 opacity-60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto bg-gray-200 h-full w-full ${className ?? ''}`}
    >
      <div className="flex flex-col items-center gap-4 py-4 px-4">
        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
          <div
            key={pageNum}
            className="shadow-lg bg-white"
            style={{ display: 'inline-block' }}
          >
            <canvas ref={setCanvasRef(pageNum)} />
          </div>
        ))}
      </div>
    </div>
  );
};
