
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { Render3DPanel } from './Render3DPanel';
import { VerticalCard } from './SharedRightComponents';

export const CadToRenderPanel = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const wf = state.workflow;
  const updateWf = (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload });
  const cadCamera = wf.cadCamera;
  const cadFurnishing = wf.cadFurnishing;
  const cadContext = wf.cadContext;
  const [openSection, setOpenSection] = useState<string | null>(null);
  const generationModes = [
    { id: 'enhance', label: t('render3dSettings.generationMode.options.enhance.label'), desc: t('render3dSettings.generationMode.options.enhance.desc') },
    { id: 'stylize', label: t('render3dSettings.generationMode.options.stylize.label'), desc: t('render3dSettings.generationMode.options.stylize.desc') },
    { id: 'hybrid', label: t('render3dSettings.generationMode.options.hybrid.label'), desc: t('render3dSettings.generationMode.options.hybrid.desc') },
    { id: 'strict-realism', label: t('render3dSettings.generationMode.options.strictRealism.label'), desc: t('render3dSettings.generationMode.options.strictRealism.desc') },
    { id: 'concept-push', label: t('render3dSettings.generationMode.options.conceptPush.label'), desc: t('render3dSettings.generationMode.options.conceptPush.desc') },
  ];

  const directionOptions = [
    { value: 'n', label: 'N' },
    { value: 'ne', label: 'NE' },
    { value: 'e', label: 'E' },
    { value: 'se', label: 'SE' },
    { value: 's', label: 'S' },
    { value: 'sw', label: 'SW' },
    { value: 'w', label: 'W' },
    { value: 'nw', label: 'NW' },
  ];

  const handleCameraPositionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    updateWf({ cadCamera: { ...cadCamera, position: { x, y } } });
  };


  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
          {t('render3dSettings.generationMode.title')}
        </label>
        <div className="space-y-1">
          {generationModes.map((mode) => (
            <VerticalCard
              key={mode.id}
              label={mode.label}
              description={mode.desc}
              selected={wf.renderMode === mode.id}
              onClick={() => updateWf({ renderMode: mode.id as any })}
            />
          ))}
        </div>
      </div>
      <Accordion
        items={[
          {
            id: 'cad-camera',
            title: t('cadToRender.sections.camera.title'),
            content: (
              <div className="space-y-4">
                <Slider
                  label={t('cadToRender.sections.camera.height')}
                  value={cadCamera.height}
                  min={0.8}
                  max={5}
                  step={0.05}
                  onChange={(value) => updateWf({ cadCamera: { ...cadCamera, height: value } })}
                />
                <Slider
                  label={t('cadToRender.sections.camera.focalLength')}
                  value={cadCamera.focalLength}
                  min={24}
                  max={85}
                  step={1}
                  onChange={(value) => updateWf({ cadCamera: { ...cadCamera, focalLength: value } })}
                />

                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted block">{t('cadToRender.sections.camera.positionPicker')}</label>
                  <div
                    className="relative h-28 rounded border border-border bg-surface-sunken cursor-crosshair"
                    onClick={handleCameraPositionClick}
                  >
                    <div className="absolute left-1/2 top-0 h-full w-px bg-border-subtle/70" />
                    <div className="absolute top-1/2 left-0 w-full h-px bg-border-subtle/70" />
                    <div
                      className="absolute w-2.5 h-2.5 rounded-full bg-accent shadow-sm"
                      style={{
                        left: `calc(${cadCamera.position.x}% - 5px)`,
                        top: `calc(${cadCamera.position.y}% - 5px)`,
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-foreground-muted">
                    {t('cadToRender.sections.camera.positionHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted block">{t('cadToRender.sections.camera.lookAt')}</label>
                  <div className="grid grid-cols-4 gap-1">
                    {directionOptions.map((direction) => (
                      <button
                        key={direction.value}
                        className={cn(
                          "py-1 rounded border text-[9px] font-medium transition-colors",
                          cadCamera.lookAt === direction.value
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted"
                        )}
                        onClick={() => updateWf({ cadCamera: { ...cadCamera, lookAt: direction.value } })}
                      >
                        {direction.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Toggle
                  label={t('cadToRender.sections.camera.verticalCorrection')}
                  checked={cadCamera.verticalCorrection}
                  onChange={(value) => updateWf({ cadCamera: { ...cadCamera, verticalCorrection: value } })}
                />
              </div>
            ),
          },
          {
            id: 'cad-furnishing',
            title: t('cadToRender.sections.furnishing.title'),
            content: (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">{t('cadToRender.sections.furnishing.occupancy')}</label>
                  <SegmentedControl
                    value={cadFurnishing.occupancy}
                    options={[
                      { label: t('cadToRender.sections.furnishing.occupancyOptions.empty'), value: 'empty' },
                      { label: t('cadToRender.sections.furnishing.occupancyOptions.staged'), value: 'staged' },
                      { label: t('cadToRender.sections.furnishing.occupancyOptions.livedIn'), value: 'lived-in' },
                    ]}
                    onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, occupancy: value } })}
                  />
                </div>

                <Slider
                  label={t('cadToRender.sections.furnishing.clutterLevel')}
                  value={cadFurnishing.clutter}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, clutter: value } })}
                />

                <div className="space-y-2">
                  <Toggle
                    label={t('cadToRender.sections.furnishing.peopleEntourage')}
                    checked={cadFurnishing.people}
                    onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, people: value } })}
                  />
                  {cadFurnishing.people && (
                    <div className="pl-2 border-l-2 border-border-subtle">
                      <Slider
                        label={t('cadToRender.sections.furnishing.entourageLevel')}
                        value={cadFurnishing.entourage}
                        min={0}
                        max={50}
                        onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, entourage: value } })}
                      />
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: 'cad-context',
            title: t('cadToRender.sections.context.title'),
            content: (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">{t('cadToRender.sections.context.landscapeStyle')}</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={cadContext.landscape}
                    onChange={(e) => updateWf({ cadContext: { ...cadContext, landscape: e.target.value as any } })}
                  >
                    <option value="garden">{t('cadToRender.sections.context.landscapeOptions.formalGarden')}</option>
                    <option value="native">{t('cadToRender.sections.context.landscapeOptions.nativePlanting')}</option>
                    <option value="minimal">{t('cadToRender.sections.context.landscapeOptions.minimal')}</option>
                    <option value="tropical">{t('cadToRender.sections.context.landscapeOptions.lushTropical')}</option>
                    <option value="xeriscape">{t('cadToRender.sections.context.landscapeOptions.dryXeriscape')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-foreground-muted block mb-1">{t('cadToRender.sections.context.environment')}</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={cadContext.environment}
                    onChange={(e) => updateWf({ cadContext: { ...cadContext, environment: e.target.value as any } })}
                  >
                    <option value="urban">{t('cadToRender.sections.context.environmentOptions.urban')}</option>
                    <option value="suburban">{t('cadToRender.sections.context.environmentOptions.suburban')}</option>
                    <option value="rural">{t('cadToRender.sections.context.environmentOptions.rural')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-foreground-muted block mb-1">{t('cadToRender.sections.context.season')}</label>
                  <SegmentedControl
                    value={cadContext.season}
                    options={[
                      { label: t('cadToRender.sections.context.seasonOptions.spring'), value: 'spring' },
                      { label: t('cadToRender.sections.context.seasonOptions.summer'), value: 'summer' },
                      { label: t('cadToRender.sections.context.seasonOptions.autumn'), value: 'autumn' },
                      { label: t('cadToRender.sections.context.seasonOptions.winter'), value: 'winter' },
                    ]}
                    onChange={(value) => updateWf({ cadContext: { ...cadContext, season: value as any } })}
                  />
                </div>
              </div>
            ),
          },
        ]}
        value={openSection}
        onValueChange={setOpenSection}
      />
      <Render3DPanel
        showGenerationMode={false}
        includeCamera={false}
        accordionValue={openSection}
        onAccordionChange={setOpenSection}
        accordionIdPrefix="render3d-"
      />
    </div>
  );
};
