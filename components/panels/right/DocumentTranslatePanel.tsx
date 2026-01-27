import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Download, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';

export const DocumentTranslatePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const docTranslate = state.workflow.documentTranslate;
  const { progress } = docTranslate;

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
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="text-sm font-medium text-green-800">
              {t('documentTranslate.translationComplete')}
            </span>
          </div>
          <button
            onClick={handleDownload}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
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
        </div>
      </div>

      {/* PDF Warning */}
      {docTranslate.sourceDocument?.mimeType.includes('pdf') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          <strong>{t('documentTranslate.pdfWarningTitle')}</strong>{' '}
          {t('documentTranslate.pdfWarningMessage')}
        </div>
      )}
    </div>
  );
};
