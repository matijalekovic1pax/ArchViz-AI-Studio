import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileOutput, Languages, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import { PdfCanvasViewer } from './ui/PdfCanvasViewer';
import { convertDocxToPdfPreview } from '../services/docxPreviewService';
import { downloadFile } from '../lib/download';

export const BilingualContractView: React.FC = () => {
  const { state } = useAppStore();
  const { t } = useTranslation();
  const contract = state.workflow.bilingualContract;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const activeOutput = useMemo(
    () => contract.outputs.find((output) => output.id === contract.activeOutputId) ?? null,
    [contract.activeOutputId, contract.outputs]
  );
  const previewDocument = activeOutput
    ? { dataUrl: activeOutput.dataUrl, name: activeOutput.name, type: 'docx' as const, isOutput: true }
    : contract.sourceDocument
      ? { dataUrl: contract.sourceDocument.dataUrl, name: contract.sourceDocument.name, type: contract.sourceDocument.type, isOutput: false }
      : null;

  useEffect(() => {
    if (!previewDocument) {
      setPreviewUrl(null);
      setPreviewMessage(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewUrl(null);
    setPreviewError(null);

    if (previewDocument.type === 'pdf') {
      setPreviewMessage(null);
      setPreviewUrl(previewDocument.dataUrl);
      return () => { cancelled = true; };
    }

    setPreviewMessage(t('bilingualContract.preparingPreview'));
    void convertDocxToPdfPreview(previewDocument.dataUrl, (progress) => {
      if (!cancelled) setPreviewMessage(progress.message);
    }).then((dataUrl) => {
      if (!cancelled) setPreviewUrl(dataUrl);
    }).catch((error) => {
      if (!cancelled) setPreviewError(error instanceof Error ? error.message : t('bilingualContract.previewError'));
    }).finally(() => {
      if (!cancelled) setPreviewMessage(null);
    });

    return () => { cancelled = true; };
  }, [previewDocument?.dataUrl, previewDocument?.type, t]);

  if (!previewDocument) {
    return (
      <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden bg-surface-sunken">
        <div className="max-w-md px-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated text-foreground-muted shadow-subtle">
            <Languages size={30} />
          </div>
          <h2 className="mt-5 text-lg font-bold text-foreground">{t('bilingualContract.workspaceTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{t('bilingualContract.workspaceDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-surface-sunken">
      <div className="absolute left-4 right-4 top-4 z-10 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-elevated/95 px-3 py-2 shadow-subtle backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <FileOutput size={16} className={previewDocument.isOutput ? 'text-emerald-600' : 'text-foreground-muted'} />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">{previewDocument.name}</div>
            <div className="text-[10px] text-foreground-muted">
              {activeOutput
                ? `${activeOutput.sourceLanguageLabel} · ${activeOutput.targetLanguageLabel} · ${t(`bilingualContract.layouts.${activeOutput.layout}.label`)}`
                : t('bilingualContract.originalPreview')}
            </div>
          </div>
        </div>
        {activeOutput && (
          <button
            type="button"
            onClick={() => void downloadFile(activeOutput.dataUrl, activeOutput.name)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Download size={13} />
            {t('bilingualContract.downloadWord')}
          </button>
        )}
      </div>

      {previewUrl ? (
        <PdfCanvasViewer dataUrl={previewUrl} className="h-full w-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex max-w-xs flex-col items-center gap-3 px-5 text-center">
            {!previewError && <Loader2 size={30} className="animate-spin text-accent" />}
            <div className="text-sm text-foreground-muted">{previewError || previewMessage || t('bilingualContract.preparingPreview')}</div>
          </div>
        </div>
      )}
    </div>
  );
};
