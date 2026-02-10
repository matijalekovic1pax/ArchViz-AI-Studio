import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Download, AlertTriangle, CheckCircle2, FileText, Key } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { isConvertApiConfigured } from '../../../services/convertApiService';

export const DocumentTranslatePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const docTranslate = state.workflow.documentTranslate;
  const { progress } = docTranslate;
  const translationQuality = docTranslate.translationQuality ?? 'fast';

  const [convertApiConfigured, setConvertApiConfigured] = useState(false);

  useEffect(() => {
    setConvertApiConfigured(isConvertApiConfigured());
  }, []);

  const handleDownload = () => {
    if (!docTranslate.translatedDocumentUrl || !docTranslate.sourceDocument) return;

    const link = document.createElement('a');
    link.href = docTranslate.translatedDocumentUrl;
    const originalName = docTranslate.sourceDocument.name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    // Output is always .docx (PDFs are converted to DOCX before translation)
    link.download = `${baseName}_${docTranslate.targetLanguage}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const qualityOptions = [
    { value: 'fast', label: t('documentTranslate.qualityOptions.fast.label') },
    { value: 'pro', label: t('documentTranslate.qualityOptions.pro.label') },
  ];

  const qualityDescription =
    translationQuality === 'pro'
      ? t('documentTranslate.qualityOptions.pro.desc')
      : t('documentTranslate.qualityOptions.fast.desc');

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

      {/* Success + Download */}
      {progress.phase === 'complete' && docTranslate.translatedDocumentUrl && (
        <div className="bg-surface-elevated border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-accent" />
            <span className="text-sm font-medium text-foreground">
              {t('documentTranslate.translationComplete')}
            </span>
          </div>
          <button
            onClick={handleDownload}
            className="w-full px-4 py-3 bg-foreground text-background rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors shadow-sm"
          >
            <Download size={16} />
            {t('documentTranslate.downloadTranslated')}
          </button>
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
      {docTranslate.sourceDocument?.mimeType.includes('pdf') && !convertApiConfigured && (
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
      <div>
        <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
          {t('documentTranslate.settings')}
        </h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-foreground-muted block">
              {t('documentTranslate.qualityLabel')}
            </label>
            <SegmentedControl
              value={translationQuality}
              options={qualityOptions}
              onChange={(value) =>
                dispatch({
                  type: 'UPDATE_DOCUMENT_TRANSLATE',
                  payload: { translationQuality: value },
                })
              }
            />
            <p className="text-[10px] text-foreground-muted leading-relaxed">
              {qualityDescription}
            </p>
          </div>

          <Toggle
            label={t('documentTranslate.preserveFormattingLabel')}
            checked={docTranslate.preserveFormatting}
            onChange={(checked) =>
              dispatch({
                type: 'UPDATE_DOCUMENT_TRANSLATE',
                payload: { preserveFormatting: checked },
              })
            }
          />
          <p className="text-[10px] text-foreground-muted leading-relaxed">
            {t('documentTranslate.preserveFormattingDesc')}
          </p>

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

          {/* ConvertAPI Status */}
          {convertApiConfigured && (
            <div className="flex items-center gap-2 pt-2">
              <CheckCircle2 size={14} className="text-accent" />
              <span className="text-[10px] text-foreground-muted">
                ConvertAPI configured for PDF translation
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PDF Info */}
      {docTranslate.sourceDocument?.mimeType.includes('pdf') && convertApiConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>PDF Translation:</strong> Your PDF will be converted to Word via ConvertAPI, translated, and returned as a translated Word document (.docx).
        </div>
      )}
    </div>
  );
};
