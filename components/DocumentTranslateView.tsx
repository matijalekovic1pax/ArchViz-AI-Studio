import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import mammoth from 'mammoth';

export const DocumentTranslateView: React.FC = () => {
  const { state } = useAppStore();
  const { t } = useTranslation();
  const { sourceDocument, progress, translatedDocumentUrl, error } = state.workflow.documentTranslate;

  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [docxHtmlContent, setDocxHtmlContent] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (!sourceDocument) {
      setDocumentPreviewUrl(null);
      setDocxHtmlContent(null);
      return;
    }

    const previewDataUrl =
      progress.phase === 'complete' && translatedDocumentUrl
        ? translatedDocumentUrl
        : sourceDocument.dataUrl;

    if (sourceDocument.type === 'pdf') {
      setDocumentPreviewUrl(previewDataUrl);
      setDocxHtmlContent(null);
      return;
    }

    if (sourceDocument.type === 'docx') {
      setDocumentPreviewUrl(null);
      setIsConverting(true);

      // Convert DOCX to HTML for preview
      const convertDocx = async () => {
        try {
          // Convert dataUrl to ArrayBuffer
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

          // Convert to HTML using mammoth
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
          setDocxHtmlContent(result.value);
        } catch (error) {
          setDocxHtmlContent('<p style="color: red;">Failed to load document preview.</p>');
        } finally {
          setIsConverting(false);
        }
      };

      convertDocx();
    }
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

    const fileType = sourceDocument.type;

    // PDF Preview
    if (fileType === 'pdf' && documentPreviewUrl) {
      return (
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            src={documentPreviewUrl}
            className="w-full h-full border-0"
            title="Document Preview"
          />
        </div>
      );
    }

    // DOCX Preview (rendered as HTML)
    if (fileType === 'docx') {
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
