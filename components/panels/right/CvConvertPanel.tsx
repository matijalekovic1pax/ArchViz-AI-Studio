import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Download, FileOutput, Loader2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import { SectionHeader } from '../left/SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { downloadFile } from '../../../lib/download';

export const CvConvertPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const cvConversion = state.workflow.cvConversion;
  const isRunning = state.isGenerating && ['converting', 'parsing', 'structuring', 'rebuilding'].includes(cvConversion.progress.phase);
  const completedOutputs = cvConversion.outputs.filter((output) => output.dataUrl);

  const downloadAll = async () => {
    for (const output of completedOutputs) {
      if (!output.dataUrl) continue;
      await downloadFile(output.dataUrl, output.name);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-2">
          <SectionHeader title={t('cvConversion.convertedCvs')} />
          {completedOutputs.length > 1 && (
            <button type="button" onClick={() => void downloadAll()} className="-mt-2 text-[10px] font-semibold text-accent hover:underline">
              {t('cvConversion.downloadAll')}
            </button>
          )}
        </div>

        {isRunning && (
          <div className="rounded-xl border border-border bg-surface-elevated p-3">
            <div className="flex items-start gap-3">
              <Loader2 size={17} className="mt-0.5 shrink-0 animate-spin text-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground">{t('cvConversion.converting')}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-foreground-muted">{cvConversion.progress.message}</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${cvConversion.progress.percent}%` }} />
            </div>
            <div className="mt-1.5 text-right font-mono text-[10px] text-foreground-muted">{cvConversion.progress.percent}%</div>
          </div>
        )}

        {!isRunning && cvConversion.outputs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-elevated px-4 py-8 text-center">
            <FileOutput size={22} className="mx-auto text-foreground-muted" />
            <div className="mt-3 text-sm font-semibold text-foreground">{t('cvConversion.noOutputs')}</div>
            <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t('cvConversion.noOutputsDescription')}</p>
          </div>
        )}

        {cvConversion.outputs.length > 0 && (
          <div className="space-y-2">
            {cvConversion.outputs.map((output) => {
              const selected = cvConversion.activeOutputId === output.id;
              const failed = Boolean(output.error);
              return (
                <div key={output.id} className={cn('rounded-xl border p-3 transition-colors', selected ? 'border-accent bg-accent/10' : 'border-border bg-surface-elevated')}>
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md', failed ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>
                      {failed ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                    <button
                      type="button"
                      disabled={!output.dataUrl}
                      onClick={() => output.dataUrl && dispatch({ type: 'UPDATE_CV_CONVERSION', payload: { activeOutputId: output.id } })}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <div className="truncate text-xs font-semibold text-foreground">{output.name}</div>
                      <div className={cn('mt-0.5 line-clamp-2 text-[10px] leading-relaxed', failed ? 'text-red-600' : 'text-foreground-muted')}>
                        {output.error || t('cvConversion.outputReady')}
                      </div>
                    </button>
                    {output.dataUrl && (
                      <button
                        type="button"
                        onClick={() => void downloadFile(output.dataUrl!, output.name)}
                        className="rounded p-1.5 text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                        title={t('cvConversion.downloadOutput')}
                        aria-label={t('cvConversion.downloadOutput')}
                      >
                        <Download size={15} />
                      </button>
                    )}
                  </div>
                  {output.warnings?.length ? (
                    <div className="mt-2 border-t border-border-subtle pt-2 text-[10px] leading-relaxed text-amber-700">
                      {output.warnings.join(' ')}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {cvConversion.error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
          {cvConversion.error}
        </section>
      )}
    </div>
  );
};
