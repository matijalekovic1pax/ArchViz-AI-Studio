import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Download, AlertTriangle, CheckCircle2, FileText, Key } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';
import { isPdfConverterInitialized } from '../../../services/pdfConverterService';
import { isCloudConvertInitialized } from '../../../services/cloudConvertService';

export const DocumentTranslatePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const docTranslate = state.workflow.documentTranslate;
  const { progress } = docTranslate;

  const [converterConfigured, setConverterConfigured] = useState(false);
  const [converterType, setConverterType] = useState<'custom' | 'cloudconvert' | null>(null);

  useEffect(() => {
    // Check if either converter is configured via .env (prefer custom API)
    const hasCustomApi = isPdfConverterInitialized();
    const hasCloudConvert = isCloudConvertInitialized();

    setConverterConfigured(hasCustomApi || hasCloudConvert);
    setConverterType(hasCustomApi ? 'custom' : hasCloudConvert ? 'cloudconvert' : null);
  }, []);

  const handleDownload = () => {
    if (!docTranslate.translatedDocumentUrl || !docTranslate.sourceDocument) return;

    const link = document.createElement('a');
    link.href = docTranslate.translatedDocumentUrl;
    const originalName = docTranslate.sourceDocument.name;
    const ext = originalName.substring(originalName.lastIndexOf('.'));
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    link.download = `${baseName}_${docTranslate.targetLanguage}${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      {/* PDF Converter Configuration Warning (for PDFs) */}
      {docTranslate.sourceDocument?.mimeType.includes('pdf') && !converterConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Key size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-1">
                PDF Converter Required
              </h4>
              <p className="text-xs text-amber-700 mb-3">
                PDF translation requires a document converter. Choose one of the following:
              </p>

              <div className="space-y-3">
                {/* Option 1: Custom API (FREE) */}
                <div className="bg-white border border-amber-300 rounded p-2">
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    ✅ Option 1: Custom API (FREE, Recommended)
                  </p>
                  <p className="text-xs text-amber-700 mb-1">
                    Deploy the <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">pdf-converter-api</code> folder to Vercel (100% free, unlimited usage).
                  </p>
                  <p className="text-xs text-amber-700 mb-1">
                    Then add to <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code>:
                  </p>
                  <code className="text-[10px] bg-amber-100 px-1 py-0.5 rounded font-mono block">
                    VITE_PDF_CONVERTER_API_URL="https://your-project.vercel.app"
                  </code>
                  <p className="text-xs text-amber-600 mt-1">
                    See <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">pdf-converter-api/README.md</code> for deployment instructions.
                  </p>
                </div>

                {/* Option 2: CloudConvert (PAID) */}
                <div className="bg-white border border-amber-300 rounded p-2">
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    💳 Option 2: CloudConvert (Paid Alternative)
                  </p>
                  <p className="text-xs text-amber-700 mb-1">
                    Get API key from{' '}
                    <a
                      href="https://cloudconvert.com/api/v2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-900 font-semibold"
                    >
                      cloudconvert.com/api/v2
                    </a>{' '}
                    (500 free minutes/month)
                  </p>
                  <code className="text-[10px] bg-amber-100 px-1 py-0.5 rounded font-mono block">
                    VITE_CLOUDCONVERT_API_KEY="your_key"
                  </code>
                </div>
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

          {/* Converter Status (if configured) */}
          {converterConfigured && (
            <div className="flex items-center gap-2 pt-2">
              <CheckCircle2 size={14} className="text-accent" />
              <span className="text-[10px] text-foreground-muted">
                {converterType === 'custom'
                  ? 'Custom PDF Converter configured (free)'
                  : 'CloudConvert configured for PDF translation'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PDF Info */}
      {docTranslate.sourceDocument?.mimeType.includes('pdf') && converterConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>PDF Translation:</strong> Your PDF will be converted to Word, translated, then converted back to PDF for perfect formatting preservation.
          {converterType === 'custom' && (
            <span className="block mt-1 text-green-700">
              ✨ Using free custom converter
            </span>
          )}
        </div>
      )}
    </div>
  );
};
