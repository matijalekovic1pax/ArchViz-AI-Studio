import { useMemo, useState, useCallback, useRef, ChangeEvent } from 'react';
import { useAppStore } from '../../../store';
import { useTranslation } from 'react-i18next';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionHeader, StyleGrid, StyleReferenceUploader } from './SharedLeftComponents';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { X } from 'lucide-react';


export const LeftRender3DPanel = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const wf = state.workflow;
  const isEnhanceMode = wf.renderMode === 'enhance';

  const availableStyles = useMemo(
    () => [...BUILT_IN_STYLES, ...state.customStyles],
    [state.customStyles]
  );
  const isStyleReferenceMode = Boolean(wf.styleReferenceEnabled);
  const getStyleDisplayName = useCallback(
    (style: { id: string; name: string }) => t(`styles.names.${style.id}`, { defaultValue: style.name }),
    [t]
  );
  const toTitle = useCallback(
    (value: string) => value.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
    []
  );

  const activeStyleLabel = useMemo(() => {
    if (isStyleReferenceMode) return t('render3d.styleReference.activeLabel');
    const activeStyle = availableStyles.find((style) => style.id === state.activeStyleId);
    return activeStyle ? getStyleDisplayName(activeStyle) : toTitle(state.activeStyleId);
  }, [availableStyles, getStyleDisplayName, isStyleReferenceMode, state.activeStyleId, t, toTitle]);

  const updateWf = useCallback((payload: Partial<typeof wf>) => {
    dispatch({ type: 'UPDATE_WORKFLOW', payload });
  }, [dispatch]);

  const handleBackgroundUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateWf({
        backgroundReferenceImage: dataUrl,
        backgroundReferenceEnabled: true
      });
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  }, [updateWf]);

  const handleRemoveBackground = useCallback(() => {
    updateWf({
      backgroundReferenceImage: null,
      backgroundReferenceEnabled: false
    });
  }, [updateWf]);

  if (isEnhanceMode) {
    return <div className="space-y-6" />;
  }

  return (
    <div className="space-y-6">
      <StyleBrowserDialog
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        activeStyleId={state.activeStyleId}
        onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
        styles={availableStyles}
        onAddStyle={(style) => dispatch({ type: 'ADD_CUSTOM_STYLE', payload: style })}
      />

      <div>
        <SectionHeader title={t('render3d.sourceAnalysis.title')} />
        <div className="space-y-3">
          {/* Source Image Indicator */}
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
          <div
            data-assistant-inspect-target="true"
            data-assistant-inspect-label={t('render3d.sourceAnalysis.sourceType')}
          >
            <label className="text-xs text-foreground-muted mb-1 block">{t('render3d.sourceAnalysis.sourceType')}</label>
            <select
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
              value={wf.sourceType}
              onChange={(e) => updateWf({ sourceType: e.target.value as any })}
            >
              <option value="rhino">{t('render3d.sourceAnalysis.sourceOptions.rhino')}</option>
              <option value="revit">{t('render3d.sourceAnalysis.sourceOptions.revit')}</option>
              <option value="sketchup">{t('render3d.sourceAnalysis.sourceOptions.sketchup')}</option>
              <option value="blender">{t('render3d.sourceAnalysis.sourceOptions.blender')}</option>
              <option value="3dsmax">{t('render3d.sourceAnalysis.sourceOptions.3dsmax')}</option>
              <option value="archicad">{t('render3d.sourceAnalysis.sourceOptions.archicad')}</option>
              <option value="cinema4d">{t('render3d.sourceAnalysis.sourceOptions.cinema4d')}</option>
              <option value="clay">{t('render3d.sourceAnalysis.sourceOptions.clay')}</option>
              <option value="other">{t('render3d.sourceAnalysis.sourceOptions.other')}</option>
            </select>
          </div>
          <div
            data-assistant-inspect-target="true"
            data-assistant-inspect-label={t('render3d.sourceAnalysis.viewType')}
          >
            <label className="text-xs text-foreground-muted mb-1 block">{t('render3d.sourceAnalysis.viewType')}</label>
            <SegmentedControl
              value={wf.viewType}
              onChange={(v) => updateWf({ viewType: v })}
              options={[
                { label: t('render3d.sourceAnalysis.viewOptions.exterior'), value: 'exterior' },
                { label: t('render3d.sourceAnalysis.viewOptions.interior'), value: 'interior' },
                { label: t('render3d.sourceAnalysis.viewOptions.aerial'), value: 'aerial' }
              ]}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title={t('render3d.style.title')} />
          <span className="text-[9px] text-foreground-muted font-mono">{activeStyleLabel}</span>
        </div>
        <StyleReferenceUploader
          enabled={Boolean(wf.styleReferenceEnabled)}
          image={wf.styleReferenceImage}
          presetContent={(
            <StyleGrid
              activeId={state.activeStyleId}
              onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
              onBrowse={() => setIsBrowserOpen(true)}
              styles={availableStyles}
            />
          )}
          onSetEnabled={(enabled) => updateWf({ styleReferenceEnabled: enabled })}
          onSetImage={(image) => updateWf({ styleReferenceImage: image })}
        />
      </div>

      {/* Background/Environment Reference */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          {t('render3d.backgroundReference.title')}
        </label>
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={handleBackgroundUpload}
          className="hidden"
        />
        <div className="flex items-center gap-2">
          {wf.backgroundReferenceImage && (
            <div className="w-8 h-8 rounded overflow-hidden border border-border flex-shrink-0">
              <img
                src={wf.backgroundReferenceImage}
                alt={t('render3d.backgroundReference.alt')}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
            className="flex-1 h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-left text-foreground-muted hover:border-accent/50 transition-colors"
          >
            {wf.backgroundReferenceImage
              ? t('render3d.backgroundReference.change')
              : t('render3d.backgroundReference.upload')}
          </button>
          {wf.backgroundReferenceImage && (
            <button
              type="button"
              onClick={handleRemoveBackground}
              className="w-8 h-8 flex items-center justify-center rounded border border-border bg-surface-elevated text-foreground-muted hover:text-rose-500 hover:border-rose-500/50 transition-colors"
              title={t('render3d.backgroundReference.remove')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
