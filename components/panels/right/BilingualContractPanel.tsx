import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, FileOutput, Loader2, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import { SectionHeader } from '../left/SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { downloadFile } from '../../../lib/download';

export const BilingualContractPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const contract = state.workflow.bilingualContract;
  const isRunning = state.isGenerating && ['converting', 'translating', 'building'].includes(contract.progress.phase);
  const outputs = [...contract.outputs].reverse();

  const removeOutput = (id: string) => {
    const remaining = contract.outputs.filter((output) => output.id !== id);
    dispatch({
      type: 'UPDATE_BILINGUAL_CONTRACT',
      payload: {
        outputs: remaining,
        activeOutputId: contract.activeOutputId === id ? remaining.at(-1)?.id ?? null : contract.activeOutputId,
      },
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title={t('bilingualContract.outputs')} />

        {isRunning && (
          <div className="mb-3 rounded-xl border border-border bg-surface-elevated p-3">
            <div className="flex items-start gap-3">
              <Loader2 size={17} className="mt-0.5 shrink-0 animate-spin text-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground">{t('bilingualContract.creating')}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-foreground-muted">{contract.progress.message}</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${contract.progress.percent}%` }} />
            </div>
            <div className="mt-1.5 text-right font-mono text-[10px] text-foreground-muted">{contract.progress.percent}%</div>
          </div>
        )}

        {!isRunning && outputs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-elevated px-4 py-8 text-center">
            <FileOutput size={22} className="mx-auto text-foreground-muted" />
            <div className="mt-3 text-sm font-semibold text-foreground">{t('bilingualContract.noOutputs')}</div>
            <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t('bilingualContract.noOutputsDescription')}</p>
          </div>
        )}

        {outputs.length > 0 && (
          <div className="space-y-2">
            {outputs.map((output) => {
              const selected = contract.activeOutputId === output.id;
              return (
                <div key={output.id} className={cn('rounded-xl border p-3 transition-colors', selected ? 'border-accent bg-accent/10' : 'border-border bg-surface-elevated')}>
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={16} />
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'UPDATE_BILINGUAL_CONTRACT', payload: { activeOutputId: output.id } })}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-semibold text-foreground">{output.name}</div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-foreground-muted">
                        {output.sourceLanguageLabel} · {output.targetLanguageLabel} · {t(`bilingualContract.layouts.${output.layout}.label`)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadFile(output.dataUrl, output.name)}
                      className="rounded p-1.5 text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                      title={t('bilingualContract.download')}
                      aria-label={t('bilingualContract.download')}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOutput(output.id)}
                      className="rounded p-1.5 text-foreground-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      title={t('bilingualContract.remove')}
                      aria-label={t('bilingualContract.remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {output.warnings?.length ? (
                    <div className="mt-2 space-y-1 border-t border-border-subtle pt-2 text-[10px] leading-relaxed text-amber-700">
                      {output.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {contract.error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
          {contract.error}
        </section>
      )}

      <section className="rounded-lg bg-surface-sunken p-3 text-[10px] leading-relaxed text-foreground-secondary">
        {t('bilingualContract.reviewNote')}
      </section>
    </div>
  );
};
