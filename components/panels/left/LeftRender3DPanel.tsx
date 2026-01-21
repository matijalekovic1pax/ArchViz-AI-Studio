import React, { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../../store';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Toggle } from '../../ui/Toggle';
import { SectionHeader, StyleGrid } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { nanoid } from 'nanoid';
import { RefreshCw } from 'lucide-react';
import {
  getGeminiService,
  initGeminiService,
  isGeminiServiceInitialized,
  ImageUtils
} from '../../../services/geminiService';


export const LeftRender3DPanel = () => {
  const { state, dispatch } = useAppStore();
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const wf = state.workflow;

  const availableStyles = useMemo(
    () => [...BUILT_IN_STYLES, ...state.customStyles],
    [state.customStyles]
  );

  const activeStyleLabel = useMemo(() => {
    const activeStyle = availableStyles.find((style) => style.id === state.activeStyleId);
    return activeStyle
      ? activeStyle.name
      : state.activeStyleId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }, [availableStyles, state.activeStyleId]);

  const updateWf = useCallback((payload: Partial<typeof wf>) => {
    dispatch({ type: 'UPDATE_WORKFLOW', payload });
  }, [dispatch]);

  const getRiskMeta = useCallback((confidence: number) => {
    if (confidence >= 0.8) {
      return { label: 'High', dotClass: 'bg-rose-500', textClass: 'text-rose-500' };
    }
    if (confidence >= 0.6) {
      return { label: 'Medium', dotClass: 'bg-amber-500', textClass: 'text-amber-600' };
    }
    return { label: 'Low', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600' };
  }, []);

  const buildProblemAreas = useCallback(() => {
    const presets: Record<string, { name: string; type: 'structural' | 'envelope' | 'interior' | 'site' }[]> = {
      exterior: [
        { name: 'Facade Patterning', type: 'envelope' },
        { name: 'Glazing Reflections', type: 'envelope' },
        { name: 'Roofline Detailing', type: 'structural' },
        { name: 'Entrance Canopy Structure', type: 'structural' },
        { name: 'Paving Texture', type: 'site' },
        { name: 'Landscape Foliage', type: 'site' }
      ],
      interior: [
        { name: 'Ceiling Grid', type: 'interior' },
        { name: 'Lighting Fixtures', type: 'interior' },
        { name: 'Seating Upholstery', type: 'interior' },
        { name: 'Floor Patterning', type: 'interior' },
        { name: 'Glazing Reflections', type: 'envelope' },
        { name: 'Wayfinding Graphics', type: 'interior' }
      ],
      aerial: [
        { name: 'Roofscape Detailing', type: 'structural' },
        { name: 'Facade Rhythm', type: 'envelope' },
        { name: 'Site Circulation', type: 'site' },
        { name: 'Landscape Texture', type: 'site' },
        { name: 'Parking Layout', type: 'site' }
      ],
      detail: [
        { name: 'Material Joints', type: 'structural' },
        { name: 'Surface Texture', type: 'interior' },
        { name: 'Fenestration Detailing', type: 'envelope' },
        { name: 'Edge Trim', type: 'structural' }
      ]
    };
    const list = presets[wf.viewType] || presets.exterior;
    return list.map((item, index) => ({
      id: nanoid(),
      name: item.name,
      type: item.type,
      confidence: Math.max(0.55, 0.9 - index * 0.07),
      selected: true
    }));
  }, [wf.viewType]);

  const getApiKey = useCallback((): string | null => {
    // @ts-ignore - Vite injects this
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
    return localStorage.getItem('gemini_api_key');
  }, []);

  const ensureServiceInitialized = useCallback((): boolean => {
    if (isGeminiServiceInitialized()) {
      return true;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      return false;
    }
    initGeminiService({ apiKey });
    return true;
  }, [getApiKey]);

  const parseProblemAreas = useCallback((raw: string) => {
    const trimmed = raw.trim();
    const jsonStart = trimmed.indexOf('[');
    const jsonEnd = trimmed.lastIndexOf(']');
    const jsonSlice = jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSlice);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 10)
      .map((item: any, index: number) => {
        const name = typeof item?.name === 'string' ? item.name : `Area ${index + 1}`;
        const type = ['structural', 'envelope', 'interior', 'site'].includes(item?.type)
          ? item.type
          : 'interior';
        const confidenceRaw = typeof item?.confidence === 'number' ? item.confidence : 0.6;
        const confidence = Math.min(0.99, Math.max(0.3, confidenceRaw));
        return {
          id: nanoid(),
          name,
          type,
          confidence,
          selected: true
        };
      });
  }, []);

  const analyzeProblemAreas = useCallback(async () => {
    if (!state.uploadedImage) {
      updateWf({ detectedElements: [] });
      return;
    }
    if (!ensureServiceInitialized()) {
      updateWf({ detectedElements: buildProblemAreas() });
      return;
    }

    setIsAnalyzing(true);
    try {
      const service = getGeminiService();
      const imageData = ImageUtils.dataUrlToImageData(state.uploadedImage);
      const prompt = [
        `Analyze this ${wf.viewType} architectural render and list the top problem areas that need extra attention.`,
        'Return ONLY a JSON array of objects: [{ "name": string, "type": "structural"|"envelope"|"interior"|"site", "confidence": number }].',
        'Confidence should be between 0 and 1.'
      ].join(' ');
      const text = await service.generateText({
        prompt,
        images: [imageData]
      });
      const parsed = parseProblemAreas(text);
      updateWf({ detectedElements: parsed });
    } catch (error) {
      console.error('Problem area analysis failed:', error);
      updateWf({ detectedElements: buildProblemAreas() });
    } finally {
      setIsAnalyzing(false);
    }
  }, [state.uploadedImage, wf.viewType, ensureServiceInitialized, parseProblemAreas, updateWf, buildProblemAreas]);

  const problemAreas = useMemo(() => {
    return [...wf.detectedElements].sort((a, b) => b.confidence - a.confidence);
  }, [wf.detectedElements]);

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
        <SectionHeader title="Source Analysis" />
        <div className="space-y-3">
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Source Type</label>
            <select
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
              value={wf.sourceType}
              onChange={(e) => updateWf({ sourceType: e.target.value as any })}
            >
              <option value="rhino">Rhino</option>
              <option value="revit">Revit</option>
              <option value="sketchup">SketchUp</option>
              <option value="blender">Blender</option>
              <option value="3dsmax">3ds Max</option>
              <option value="archicad">ArchiCAD</option>
              <option value="cinema4d">Cinema 4D</option>
              <option value="clay">Clay Render</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">View Type</label>
            <SegmentedControl
              value={wf.viewType}
              onChange={(v) => updateWf({ viewType: v })}
              options={[
                { label: 'Exterior', value: 'exterior' },
                { label: 'Interior', value: 'interior' },
                { label: 'Aerial', value: 'aerial' }
              ]}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Style" />
          <span className="text-[9px] text-foreground-muted font-mono">{activeStyleLabel}</span>
        </div>
        <StyleGrid
          activeId={state.activeStyleId}
          onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
          onBrowse={() => setIsBrowserOpen(true)}
          styles={availableStyles}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Problem Areas" />
          <Toggle
            label=""
            checked={wf.prioritizationEnabled}
            onChange={(v) => {
              if (v) {
                updateWf({ prioritizationEnabled: true, detectedElements: [] });
                analyzeProblemAreas();
              } else {
                updateWf({ prioritizationEnabled: false, detectedElements: [] });
              }
            }}
          />
        </div>

        {wf.prioritizationEnabled && (
          <>
            <p className="text-[10px] text-foreground-muted mb-2">
              AI flags detailed or patterned areas that may need extra care. Color shows difficulty.
            </p>

            <div className="space-y-1">
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-[10px] text-foreground-muted py-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Analyzing problem areas...
                </div>
              )}
              {problemAreas.length === 0 && (
                <div className="text-[10px] text-foreground-muted py-2">
                  {isAnalyzing ? 'Waiting for analysis results...' : 'No problem areas detected yet.'}
                </div>
              )}

              {problemAreas.map((el, index) => {
                const risk = getRiskMeta(el.confidence);
                return (
                  <div
                    key={el.id}
                    className={cn(
                      "flex items-center justify-between gap-3 p-2 rounded text-xs border",
                      "bg-surface-elevated border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] text-foreground-muted font-mono w-4">
                        {index + 1}
                      </span>
                      <span className={cn("w-2 h-2 rounded-full shrink-0", risk.dotClass)} />
                      <span className="truncate">{el.name}</span>
                    </div>
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", risk.textClass)}>
                      {risk.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
