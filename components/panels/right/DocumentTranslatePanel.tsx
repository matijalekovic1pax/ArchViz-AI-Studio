import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Download, Loader2, AlertTriangle, CheckCircle2, FileText, Key } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';
import { isConvertApiConfigured } from '../../../services/convertApiService';
import { downloadFile } from '../../../lib/download';
import { cn } from '../../../lib/utils';
import type { DocumentTranslateOutput } from '../../../types';

const DOCX_MIME_EXTENSION = 'docx';
const XLSX_MIME_EXTENSION = 'xlsx';
const PPTX_MIME_EXTENSION = 'pptx';

export const DocumentTranslatePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const docTranslate = state.workflow.documentTranslate;
  const { progress } = docTranslate;

  const [convertApiConfigured, setConvertApiConfigured] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadIndex, setDownloadIndex] = useState(-1);

  useEffect(() => {
    setConvertApiConfigured(isConvertApiConfigured());
  }, []);

  const queue = docTranslate.queue || [];
  const outputs = docTranslate.outputs || [];
  // Every output is a completed translation with a download URL.
  const doneItems = outputs;
  const hasPending = queue.some((item) => item.status === 'queued' || item.status === 'processing');
  const hasFailed = queue.some((item) => item.status === 'failed');
  const allDone = doneItems.length > 0 && !hasPending && !hasFailed;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const buildOutputName = useCallback(
    (name: string, type: DocumentTranslateOutput['type']) => {
      const baseName = name.substring(0, name.lastIndexOf('.'));
      const ext =
        type === 'xlsx'
          ? XLSX_MIME_EXTENSION
          : type === 'pptx'
          ? PPTX_MIME_EXTENSION
          : DOCX_MIME_EXTENSION;
      return `${baseName}_${docTranslate.targetLanguage}.${ext}`;
    },
    [docTranslate.targetLanguage]
  );

  const downloadItem = useCallback(
    async (item: { name: string; type: DocumentTranslateOutput['type']; translatedDocumentUrl?: string | null }) => {
      if (!item.translatedDocumentUrl) return;
      await downloadFile(item.translatedDocumentUrl, buildOutputName(item.name, item.type));
    },
    [buildOutputName]
  );

  const previewOutput = useCallback(
    (output: DocumentTranslateOutput) => {
      // Show the selected output in the center preview, mirroring the queue item.
      dispatch({
        type: 'UPDATE_DOCUMENT_TRANSLATE',
        payload: {
          activeDocumentId: output.id,
          sourceDocument: {
            id: output.id,
            name: output.name,
            type: output.type,
            mimeType: output.mimeType,
            size: output.size,
            dataUrl: output.dataUrl,
            uploadedAt: output.uploadedAt,
          },
          translatedDocumentUrl: output.translatedDocumentUrl,
          warnings: output.warnings,
          xlsxStats: output.xlsxStats,
          error: null,
          progress: {
            phase: 'complete',
            currentSegment: 0,
            totalSegments: 0,
            currentBatch: 0,
            totalBatches: 0,
          },
        },
      });
    },
    [dispatch]
  );

  const getOutputSize = useCallback((dataUrl: string): number => {
    // Decoded byte count of the output file, derived from its base64 data URL.
    const idx = dataUrl.indexOf(',');
    if (idx === -1) return 0;
    const base64 = dataUrl.slice(idx + 1);
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  }, []);

  const handleDownloadSingle = useCallback(async () => {
    const item = doneItems[0];
    if (!item) return;
    setDownloadingAll(true);
    setDownloadIndex(0);
    try {
      await downloadItem(item);
    } finally {
      setDownloadingAll(false);
      setDownloadIndex(-1);
    }
  }, [doneItems, downloadItem]);

  const handleDownloadAll = useCallback(async () => {
    const items = doneItems;
    if (items.length === 0) return;
    setDownloadingAll(true);
    try {
      for (let i = 0; i < items.length; i++) {
        setDownloadIndex(i);
        await downloadItem(items[i]);
        // Browsers throttle rapid programmatic downloads; space them out.
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    } finally {
      setDownloadingAll(false);
      setDownloadIndex(-1);
    }
  }, [doneItems, downloadItem]);

  const isPdf = docTranslate.sourceDocument?.mimeType.includes('pdf') ?? false;
  const isXlsx = docTranslate.sourceDocument?.type === 'xlsx';
  const isPptx = docTranslate.sourceDocument?.type === 'pptx';
  const isStructurePreservingArchive = isXlsx || isPptx;
  const showDocumentOptions = !isStructurePreservingArchive;
  const showSettings = showDocumentOptions || (isPdf && convertApiConfigured);

  const progressPercent =
    progress.totalSegments > 0
      ? Math.round((progress.currentSegment / progress.totalSegments) * 100)
      : 0;

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'parsing':
        return t('documentTranslate.progress.parsing');
      case 'translating':
        return t('documentTranslate.progress.translating');
      case 'rebuilding':
        return t('documentTranslate.progress.rebuilding');
      case 'complete':
        return t('documentTranslate.progress.complete');
      case 'error':
        return t('documentTranslate.progress.error');
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      {progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error' && (
        <div className="bg-surface-elevated border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{getPhaseLabel(progress.phase)}</span>
            <span className="text-xs text-foreground-muted">{progressPercent}%</span>
          </div>
          <div className="w-full bg-surface-sunken rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.phase === 'translating' && progress.totalBatches > 0 && (
            <div className="mt-2 text-xs text-foreground-muted">
              {t('documentTranslate.progress.batch', {
                current: progress.currentBatch,
                total: progress.totalBatches,
              })}
            </div>
          )}
          {progress.message && (
            <div className="mt-2 text-xs text-foreground-muted">{progress.message}</div>
          )}
        </div>
      )}

      {/* Error Display */}
      {docTranslate.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <span className="text-xs text-red-700">{docTranslate.error}</span>
        </div>
      )}

      {/* Outputs — every translated document in the queue */}
      {doneItems.length > 0 && (
        <div className="bg-surface-elevated border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-accent" />
            <span className="text-sm font-medium text-foreground">
              {allDone
                ? t('documentTranslate.translationComplete')
                : t('documentTranslate.outputsTitle')}
            </span>
            <span className="ml-auto text-[10px] font-semibold text-foreground-muted">
              {doneItems.length}
            </span>
          </div>

          <div className="space-y-2 mb-3">
            {doneItems.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => previewOutput(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    previewOutput(item);
                  }
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 transition-colors cursor-pointer',
                  docTranslate.activeDocumentId === item.id
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-foreground/40'
                )}
              >
                <FileText size={14} className="shrink-0 text-foreground-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{buildOutputName(item.name, item.type)}</p>
                  <p className="text-[10px] text-foreground-muted">
                    {formatFileSize(getOutputSize(item.translatedDocumentUrl))}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={downloadingAll}
                  onClick={(event) => {
                    event.stopPropagation();
                    void downloadItem(item);
                  }}
                  className="p-1.5 rounded-md text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  title={t('documentTranslate.downloadTranslated')}
                >
                  <Download size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={doneItems.length === 1 ? handleDownloadSingle : handleDownloadAll}
            disabled={downloadingAll}
            className="w-full px-4 py-3 bg-foreground text-background rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors shadow-sm disabled:opacity-70"
          >
            {downloadingAll ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('documentTranslate.downloadingAll', {
                  current: downloadIndex + 1,
                  total: doneItems.length,
                })}
              </>
            ) : (
              <>
                <Download size={16} />
                {doneItems.length > 1
                  ? t('documentTranslate.downloadAllCount', { count: doneItems.length })
                  : t('documentTranslate.downloadTranslated')}
              </>
            )}
          </button>
        </div>
      )}

      {/* Structure preservation warnings */}
      {progress.phase === 'complete' && isStructurePreservingArchive && docTranslate.warnings && docTranslate.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">
              {t('documentTranslate.xlsxWarningsTitle')}
            </span>
          </div>
          <div className="space-y-1">
            {docTranslate.warnings.map((warning, idx) => (
              <p key={`${warning}-${idx}`} className="text-xs text-amber-800">
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* XLSX translation stats */}
      {progress.phase === 'complete' && isXlsx && docTranslate.xlsxStats && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-xs text-green-800 space-y-1">
          <p className="font-semibold">{t('documentTranslate.xlsxStatsTitle')}</p>
          <p>{t('documentTranslate.xlsxStatsTranslated', { count: docTranslate.xlsxStats.translatedCount })}</p>
          <p>{t('documentTranslate.xlsxStatsSkipped', { count: docTranslate.xlsxStats.skippedCount })}</p>
          <p>{t('documentTranslate.xlsxStatsDetected', { count: docTranslate.xlsxStats.detectedTextCount })}</p>
        </div>
      )}

      {/* No Document Uploaded Message */}
      {!docTranslate.sourceDocument && progress.phase === 'idle' && (
        <div className="bg-surface-sunken border border-border-subtle rounded-lg p-4 flex flex-col items-center gap-2 text-center">
          <FileText size={24} className="text-foreground-muted" />
          <p className="text-xs text-foreground-muted">
            {t('documentTranslate.noDocumentUploaded')}
          </p>
        </div>
      )}

      {/* ConvertAPI Configuration Warning (for PDFs) */}
      {isPdf && !convertApiConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Key size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-1">
                ConvertAPI Required for PDF Translation
              </h4>
              <p className="text-xs text-amber-700 mb-2">
                PDF translation uses{' '}
                <a
                  href="https://www.convertapi.com/pdf-to-docx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-900 font-semibold"
                >
                  ConvertAPI
                </a>{' '}
                to convert PDF to Word (250 free conversions/month).
              </p>
              <div className="bg-white border border-amber-300 rounded p-2">
                <p className="text-xs text-amber-700 mb-1">
                  1. Sign up at{' '}
                  <a
                    href="https://www.convertapi.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-900 font-semibold"
                  >
                    convertapi.com
                  </a>
                </p>
                <p className="text-xs text-amber-700 mb-1">
                  2. Get your API secret from the dashboard
                </p>
                <p className="text-xs text-amber-700 mb-1">
                  3. Add to <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code>:
                </p>
                <code className="text-[10px] bg-amber-100 px-1 py-0.5 rounded font-mono block">
                  VITE_CONVERTAPI_SECRET="your_secret_here"
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div>
          <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
            {t('documentTranslate.settings')}
          </h3>
          <div className="space-y-3">
            {showDocumentOptions && (
              <>
                <Toggle
                  label="Translate Headers & Footers"
                  checked={docTranslate.translateHeaders}
                  onChange={(checked) =>
                    dispatch({
                      type: 'UPDATE_DOCUMENT_TRANSLATE',
                      payload: { translateHeaders: checked },
                    })
                  }
                />
                <p className="text-[10px] text-foreground-muted leading-relaxed">
                  Include document headers and footers in translation.
                </p>

                <Toggle
                  label="Translate Footnotes"
                  checked={docTranslate.translateFootnotes}
                  onChange={(checked) =>
                    dispatch({
                      type: 'UPDATE_DOCUMENT_TRANSLATE',
                      payload: { translateFootnotes: checked },
                    })
                  }
                />
                <p className="text-[10px] text-foreground-muted leading-relaxed">
                  Include footnotes and endnotes in translation.
                </p>
              </>
            )}

            {/* ConvertAPI Status */}
            {isPdf && convertApiConfigured && (
              <div className="flex items-center gap-2 pt-2">
                <CheckCircle2 size={14} className="text-accent" />
                <span className="text-[10px] text-foreground-muted">
                  ConvertAPI configured for PDF translation
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Info */}
      {isPdf && convertApiConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>PDF Translation:</strong> Your PDF will be converted to Word via ConvertAPI, translated, and returned as a translated Word document (.docx).
        </div>
      )}

      {/* Excel Info */}
      {isXlsx && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
          <strong>Excel Translation:</strong> All text cells across every sheet will be translated. Numbers, dates, formulas, and formatting are preserved. The output is a translated Excel file (.xlsx).
        </div>
      )}

      {/* PowerPoint Info */}
      {isPptx && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
          <strong>PowerPoint Translation:</strong> Slide, layout, master, speaker-note, chart, and diagram text will be translated in place. Media, animations, slide order, and presentation structure are preserved. The output is a translated PowerPoint file (.pptx).
        </div>
      )}
    </div>
  );
};
