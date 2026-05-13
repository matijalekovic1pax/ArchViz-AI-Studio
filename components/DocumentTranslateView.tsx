import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import * as XLSX from 'xlsx';
import { PdfCanvasViewer } from './ui/PdfCanvasViewer';
import { parsePptxPreview } from '../services/pptxParserService';

export const DocumentTranslateView: React.FC = () => {
  const { state } = useAppStore();
  const { t } = useTranslation();
  const { sourceDocument, progress, translatedDocumentUrl, error } = state.workflow.documentTranslate;

  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [docxHtmlContent, setDocxHtmlContent] = useState<string | null>(null);
  const [xlsxHtmlContent, setXlsxHtmlContent] = useState<string | null>(null);
  const [pptxHtmlContent, setPptxHtmlContent] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (!sourceDocument) {
      setDocumentPreviewUrl(null);
      setDocxHtmlContent(null);
      setXlsxHtmlContent(null);
      setPptxHtmlContent(null);
      return;
    }

    let cancelled = false;
    const isTranslated = progress.phase === 'complete' && translatedDocumentUrl;
    const previewDataUrl = isTranslated ? translatedDocumentUrl : sourceDocument.dataUrl;
    const isXlsx = sourceDocument.type === 'xlsx';
    const isPptx = sourceDocument.type === 'pptx';

    // XLSX preview
    if (isXlsx) {
      setDocumentPreviewUrl(null);
      setDocxHtmlContent(null);
      setPptxHtmlContent(null);
      setIsConverting(true);

      const convertXlsx = async () => {
        try {
          const base64Match = previewDataUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (!base64Match) throw new Error('Invalid data URL');

          const base64 = base64Match[1];
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const workbook = XLSX.read(bytes, { type: 'array' });
          const htmlParts: string[] = [];

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const html = XLSX.utils.sheet_to_html(sheet, { id: `sheet-${sheetName}` });
            htmlParts.push(
              `<div class="sheet-section"><h3 class="sheet-title">${DOMPurify.sanitize(sheetName)}</h3>${html}</div>`
            );
          }

          if (!cancelled) {
            setXlsxHtmlContent(DOMPurify.sanitize(htmlParts.join('')));
          }
        } catch {
          if (!cancelled) {
            setXlsxHtmlContent('<p style="color: red;">Failed to load spreadsheet preview.</p>');
          }
        } finally {
          if (!cancelled) {
            setIsConverting(false);
          }
        }
      };

      convertXlsx();
      return () => {
        cancelled = true;
      };
    }

    // PPTX text-outline preview
    if (isPptx) {
      setDocumentPreviewUrl(null);
      setDocxHtmlContent(null);
      setXlsxHtmlContent(null);
      setIsConverting(true);

      const convertPptx = async () => {
        try {
          const preview = await parsePptxPreview(previewDataUrl);
          const htmlParts: string[] = [];
          preview.sections.forEach(({ texts, label }) => {
            htmlParts.push(
              `<section class="pptx-section"><h3 class="pptx-title">${DOMPurify.sanitize(label)}</h3>${texts
                .map((text) => `<p>${DOMPurify.sanitize(text)}</p>`)
                .join('')}</section>`
            );
          });

          if (preview.truncated) {
            htmlParts.push(
              '<section class="pptx-section"><p class="pptx-note">Preview limited for performance. The full presentation will still be processed for translation.</p></section>'
            );
          }

          if (!cancelled) {
            setPptxHtmlContent(
              DOMPurify.sanitize(
                htmlParts.length > 0
                  ? htmlParts.join('')
                  : '<p>No previewable text was found in this presentation.</p>'
              )
            );
          }
        } catch (error) {
          console.error('Failed to load presentation preview', error);
          if (!cancelled) {
            setPptxHtmlContent(
              '<p style="color: red;">Preview is unavailable for this presentation. You can still translate it.</p>'
            );
          }
        } finally {
          if (!cancelled) {
            setIsConverting(false);
          }
        }
      };

      convertPptx();
      return () => {
        cancelled = true;
      };
    }

    // Reset xlsx state for non-xlsx
    setXlsxHtmlContent(null);
    setPptxHtmlContent(null);

    // After translation completes, the output is DOCX (even if input was PDF)
    const isDocxPreview = isTranslated || sourceDocument.type === 'docx';

    if (!isDocxPreview && sourceDocument.type === 'pdf') {
      // Show original PDF in iframe (before translation)
      setDocumentPreviewUrl(previewDataUrl);
      setDocxHtmlContent(null);
      return;
    }

    // Preview DOCX content (original docx or translated output)
    setDocumentPreviewUrl(null);
    setIsConverting(true);

    const convertDocx = async () => {
      try {
        const base64Match = previewDataUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error('Invalid data URL');
        }

        const base64 = base64Match[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        if (!cancelled) {
          setDocxHtmlContent(DOMPurify.sanitize(result.value));
        }
      } catch (error) {
        if (!cancelled) {
          setDocxHtmlContent('<p style="color: red;">Failed to load document preview.</p>');
        }
      } finally {
        if (!cancelled) {
          setIsConverting(false);
        }
      }
    };

    convertDocx();
    return () => {
      cancelled = true;
    };
  }, [sourceDocument, translatedDocumentUrl, progress.phase]);

  const renderDocumentPreview = () => {
    // No document uploaded
    if (!sourceDocument) {
      return (
        <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
          <div className="text-center max-w-md px-4 sm:px-6">
            <FileText size={64} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">{t('documentTranslate.noDocumentUploaded')}</h3>
            <p className="text-sm text-foreground-muted">
              {t('documentTranslate.dropOrClick')}
            </p>
          </div>
        </div>
      );
    }

    // XLSX Preview
    if (sourceDocument.type === 'xlsx') {
      if (isConverting) {
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p className="text-sm text-foreground-muted">Loading spreadsheet preview...</p>
            </div>
          </div>
        );
      }

      if (xlsxHtmlContent) {
        return (
          <div className="absolute inset-0 overflow-y-auto bg-gray-100 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg mb-6 sm:mb-8">
              <div className="bg-green-50 px-4 sm:px-6 py-2 sm:py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-green-600" />
                  <h3 className="text-sm font-medium text-gray-800">{sourceDocument.name}</h3>
                </div>
              </div>
              <div className="p-4 sm:p-6 overflow-x-auto">
                <style>{`
                  .xlsx-preview .sheet-section { margin-bottom: 2em; }
                  .xlsx-preview .sheet-title { font-size: 1.1em; font-weight: 600; margin-bottom: 0.5em; color: #1a7f37; }
                  .xlsx-preview table { border-collapse: collapse; width: 100%; font-size: 12px; }
                  .xlsx-preview td, .xlsx-preview th { border: 1px solid #d0d7de; padding: 4px 8px; text-align: left; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
                  .xlsx-preview th { background: #f6f8fa; font-weight: 600; }
                  .xlsx-preview tr:nth-child(even) { background: #f9fafb; }
                  .xlsx-preview tr:hover { background: #f0f4f8; }
                `}</style>
                <div
                  className="xlsx-preview"
                  dangerouslySetInnerHTML={{ __html: xlsxHtmlContent }}
                />
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md px-4 sm:px-6">
            <FileText size={64} className="mx-auto mb-4 opacity-20 text-red-500" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">Failed to load spreadsheet</h3>
            <p className="text-sm text-foreground-muted">
              Unable to preview this spreadsheet. You can still translate it.
            </p>
          </div>
        </div>
      );
    }

    // PPTX Preview
    if (sourceDocument.type === 'pptx') {
      if (isConverting) {
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p className="text-sm text-foreground-muted">Loading presentation preview...</p>
            </div>
          </div>
        );
      }

      if (pptxHtmlContent) {
        return (
          <div className="absolute inset-0 overflow-y-auto bg-gray-100 p-4 sm:p-8">
            <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-lg mb-6 sm:mb-8">
              <div className="bg-orange-50 px-4 sm:px-6 py-2 sm:py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-orange-600" />
                  <h3 className="text-sm font-medium text-gray-800">{sourceDocument.name}</h3>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <style>{`
                  .pptx-preview .pptx-section { border-bottom: 1px solid #e5e7eb; padding: 1rem 0; }
                  .pptx-preview .pptx-section:first-child { padding-top: 0; }
                  .pptx-preview .pptx-section:last-child { border-bottom: 0; padding-bottom: 0; }
                  .pptx-preview .pptx-title { font-size: 0.9rem; font-weight: 700; color: #c2410c; margin-bottom: 0.5rem; }
                  .pptx-preview p { color: #1f2937; font-size: 0.9rem; line-height: 1.5; margin: 0.35rem 0; }
                  .pptx-preview .pptx-note { color: #9a3412; font-weight: 600; }
                `}</style>
                <div
                  className="pptx-preview"
                  dangerouslySetInnerHTML={{ __html: pptxHtmlContent }}
                />
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md px-4 sm:px-6">
            <FileText size={64} className="mx-auto mb-4 opacity-20 text-red-500" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">Failed to load presentation</h3>
            <p className="text-sm text-foreground-muted">
              Unable to preview this presentation. You can still translate it.
            </p>
          </div>
        </div>
      );
    }

    // After translation, output is always DOCX regardless of input type
    const isTranslated = progress.phase === 'complete' && translatedDocumentUrl;
    const showAsDocx = isTranslated || sourceDocument.type === 'docx';

    // PDF Preview (only for original PDF before translation)
    if (!showAsDocx && sourceDocument.type === 'pdf' && documentPreviewUrl) {
      return (
        <div className="absolute inset-0">
          <PdfCanvasViewer dataUrl={documentPreviewUrl} className="h-full w-full" />
        </div>
      );
    }

    // DOCX Preview (rendered as HTML) - for docx input or translated output
    if (showAsDocx) {
      // Still converting
      if (isConverting) {
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p className="text-sm text-foreground-muted">Loading document preview...</p>
            </div>
          </div>
        );
      }

      // Converted and ready to display
      if (docxHtmlContent) {
        return (
          <div className="absolute inset-0 overflow-y-auto bg-gray-100 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg mb-6 sm:mb-8">
              {/* Document header with filename */}
              <div className="bg-blue-50 px-4 sm:px-6 py-2 sm:py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-800">{sourceDocument.name}</h3>
                </div>
              </div>

              {/* Document content */}
              <div className="p-4 sm:p-8">
                <style>{`
                  .document-content p { margin: 0.5em 0; }
                  .document-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                  .document-content td, .document-content th { border: 1px solid #ddd; padding: 8px; }
                  .document-content ul, .document-content ol { margin: 0.5em 0; padding-left: 2em; }
                  .document-content li { margin: 0.25em 0; }
                  .document-content h1 { font-size: 2em; margin: 0.5em 0; font-weight: bold; }
                  .document-content h2 { font-size: 1.5em; margin: 0.5em 0; font-weight: bold; }
                  .document-content h3 { font-size: 1.25em; margin: 0.5em 0; font-weight: bold; }
                  .document-content strong { font-weight: bold; }
                  .document-content em { font-style: italic; }
                `}</style>
                <div
                  className="document-content"
                  dangerouslySetInnerHTML={{ __html: docxHtmlContent }}
                  style={{
                    fontFamily: 'Calibri, Arial, sans-serif',
                    fontSize: '11pt',
                    lineHeight: '1.6',
                    color: '#000000',
                    backgroundColor: '#ffffff',
                    minHeight: '100px',
                  }}
                />
              </div>
            </div>
          </div>
        );
      }

      // Conversion failed
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md px-4 sm:px-6">
            <FileText size={64} className="mx-auto mb-4 opacity-20 text-red-500" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">Failed to load document</h3>
            <p className="text-sm text-foreground-muted">
              Unable to preview this document. You can still translate it.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderProgressOverlay = () => {
    if (progress.phase === 'idle' || progress.phase === 'complete') return null;

    return (
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="max-w-md w-full mx-auto px-4 sm:px-6">
          <div className={cn(
            "bg-surface-elevated border border-border rounded-lg p-6 shadow-lg",
            progress.phase === 'complete' && "text-center"
          )}>
            <div className={cn(
              "flex items-center gap-3 mb-4",
              progress.phase === 'complete' && "justify-center"
            )}>
              {progress.phase === 'complete' ? (
                <CheckCircle2 size={24} className="text-accent" />
              ) : (
                <Loader2 size={24} className="text-accent animate-spin" />
              )}
              <h3 className="text-lg font-semibold">
                {progress.phase === 'parsing' && t('documentTranslate.progress.parsing')}
                {progress.phase === 'translating' && t('documentTranslate.progress.translating')}
                {progress.phase === 'rebuilding' && t('documentTranslate.progress.rebuilding')}
                {progress.phase === 'complete' && t('documentTranslate.translationComplete')}
                {progress.phase === 'error' && t('documentTranslate.progress.error')}
              </h3>
            </div>

            {progress.phase === 'translating' && progress.totalBatches > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-foreground-muted">
                  <span>{t('documentTranslate.progress.batch', { current: progress.currentBatch, total: progress.totalBatches })}</span>
                  <span>{Math.round((progress.currentBatch / progress.totalBatches) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-surface-sunken rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 rounded-full"
                    style={{ width: `${(progress.currentBatch / progress.totalBatches) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {progress.phase === 'complete' && translatedDocumentUrl && null}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-background h-full relative">
      {renderDocumentPreview()}
      {renderProgressOverlay()}
    </div>
  );
};
