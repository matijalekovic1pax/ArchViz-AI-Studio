import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAppStore } from '../../../store';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionHeader } from './SharedLeftComponents';

export const LeftSceneComposePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const wf = state.workflow;

  const updateWf = useCallback((payload: Partial<typeof wf>) => {
    dispatch({ type: 'UPDATE_WORKFLOW', payload });
  }, [dispatch, wf]);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title={t('render3d.sourceAnalysis.title')} />
        <div className="space-y-3">
          {state.sourceImage && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-sunken border border-border">
              <div className="w-12 h-12 rounded overflow-hidden border border-border flex-shrink-0">
                <img
                  src={state.sourceImage}
                  alt="Source"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-foreground-muted">{t('render3d.sourceAnalysis.originalSource')}</p>
                <p className="text-[9px] text-foreground-muted/60 truncate">{t('render3d.sourceAnalysis.lockedForConsistency')}</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_SOURCE_IMAGE', payload: null })}
                className="p-1.5 text-foreground-muted hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                title={t('render3d.sourceAnalysis.resetSource')}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div>
            <label className="text-xs text-foreground-muted mb-1 block">{t('render3d.sourceAnalysis.viewType')}</label>
            <SegmentedControl
              value={wf.viewType}
              onChange={(value) => updateWf({ viewType: value as any })}
              options={[
                { label: t('render3d.sourceAnalysis.viewOptions.exterior'), value: 'exterior' },
                { label: t('render3d.sourceAnalysis.viewOptions.interior'), value: 'interior' },
                { label: t('render3d.sourceAnalysis.viewOptions.aerial'), value: 'aerial' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
