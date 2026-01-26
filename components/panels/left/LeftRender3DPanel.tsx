import { useMemo, useState, useCallback, useRef, ChangeEvent } from 'react';
import { useAppStore } from '../../../store';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionHeader, StyleGrid } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES, generatePrompt } from '../../../engine/promptEngine';
import { nanoid } from 'nanoid';
import { RefreshCw, X } from 'lucide-react';
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
  const analyzingRef = useRef(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const wf = state.workflow;
  const PREPROCESS_MODEL = 'gemini-3-flash-preview';
  const PREPROCESS_TIMEOUT_MS = 60000;

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

  const getRiskMeta = useCallback((confidence: number) => {
    if (confidence >= 0.8) {
      return { label: 'High', dotClass: 'bg-rose-500', textClass: 'text-rose-500' };
    }
    if (confidence >= 0.6) {
      return { label: 'Medium', dotClass: 'bg-amber-500', textClass: 'text-amber-600' };
    }
    return { label: 'Low', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600' };
  }, []);

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
        const rawName = typeof item?.name === 'string' ? item.name : `Area ${index + 1}`;
        const name = rawName.length > 60 ? `${rawName.slice(0, 57).trimEnd()}...` : rawName;
        const detail =
          typeof item?.detail === 'string'
            ? item.detail
            : typeof item?.description === 'string'
              ? item.description
              : typeof item?.guidance === 'string'
                ? item.guidance
                : '';
        const type = ['structural', 'envelope', 'interior', 'site'].includes(item?.type)
          ? item.type
          : 'interior';
        const confidenceRaw = typeof item?.confidence === 'number' ? item.confidence : 0.6;
        const confidence = Math.min(0.99, Math.max(0.3, confidenceRaw));
        return {
          id: nanoid(),
          name,
          type,
          detail: detail.trim(),
          confidence,
          selected: true
        };
      });
  }, []);

  const analyzeProblemAreas = useCallback(async () => {
    if (analyzingRef.current) return;
    const sourceImage = state.sourceImage || state.uploadedImage;
    if (!sourceImage) {
      updateWf({ detectedElements: [] });
      return;
    }
    if (!ensureServiceInitialized()) {
      updateWf({ detectedElements: [] });
      return;
    }

    setIsAnalyzing(true);
    analyzingRef.current = true;
    try {
      const service = getGeminiService();
      const imageData = ImageUtils.dataUrlToImageData(sourceImage);
      const renderIntent = generatePrompt({
        ...state,
        workflow: {
          ...state.workflow,
          detectedElements: [],
          prioritizationEnabled: false
        }
      });
      const settingsContext = {
        mode: state.mode,
        viewType: wf.viewType,
        sourceType: wf.sourceType,
        renderMode: wf.renderMode,
        activeStyle: {
          id: state.activeStyleId,
          name: activeStyleLabel
        },
        render3d: wf.render3d,
        geometry: state.geometry,
        camera: state.camera,
        lighting: state.lighting,
        materials: state.materials,
        context: state.context,
        output: state.output
      };
      const prompt = [
        `You are an expert architectural visualization analyst. Analyze this ${wf.viewType} 3D render/model image and identify specific areas that could be problematic during AI image generation.`,
        '',
        '**Your Task:**',
        'Examine the source image and identify areas that may cause issues when rendering a photorealistic architectural visualization. Consider the following render settings and intended style:',
        '',
        `**Render Intent:** ${renderIntent}`,
        '',
        `**Current Settings:** ${JSON.stringify(settingsContext, null, 2)}`,
        '',
        '**What to Look For:**',
        '- Complex geometry that may lose definition (ornate details, thin elements, intricate patterns)',
        '- Areas with challenging material transitions or reflections',
        '- Regions with difficult lighting conditions (deep shadows, bright highlights, glass reflections)',
        '- Elements that commonly get distorted or hallucinated (window frames, railings, furniture details)',
        '- Perspective-sensitive areas that may drift during generation',
        '- Fine details that need preservation (textures, edges, proportions)',
        '',
        '**Response Format:**',
        'Return ONLY a valid JSON array with 3-8 problem areas. Each object must have:',
        '```json',
        '[',
        '  {',
        '    "name": "Short title (2-5 words) for display in UI",',
        '    "detail": "Specific instruction for the AI on how to handle this area. Be precise and actionable. Example: Preserve the sharp edges of the window frames and maintain accurate glass reflections without distortion.",',
        '    "type": "structural|envelope|interior|site",',
        '    "confidence": 0.3-0.99 (how likely this area will cause issues)',
        '  }',
        ']',
        '```',
        '',
        'The "name" will be shown to the user. The "detail" will be included as a rendering instruction. Make details specific and actionable.'
      ].join('\n');
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PREPROCESS_TIMEOUT_MS);
      let text = '';
      try {
        text = await service.generateText({
          prompt,
          images: [imageData],
          model: PREPROCESS_MODEL,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: 'minimal' },
            abortSignal: controller.signal
          }
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
      const parsed = parseProblemAreas(text);
      updateWf({ detectedElements: parsed });
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || /aborted/i.test(error.message))) {
        console.warn('Problem area analysis timed out.');
      } else {
        console.error('Problem area analysis failed:', error);
      }
      updateWf({ detectedElements: [] });
    } finally {
      setIsAnalyzing(false);
      analyzingRef.current = false;
    }
  }, [
    state,
    wf.viewType,
    wf.sourceType,
    wf.renderMode,
    activeStyleLabel,
    ensureServiceInitialized,
    parseProblemAreas,
    updateWf
  ]);

  const problemAreas = useMemo(() => {
    return [...wf.detectedElements].sort((a, b) => b.confidence - a.confidence);
  }, [wf.detectedElements]);

  const handleProblemAreaAnalysis = useCallback(() => {
    if (isAnalyzing) return;
    updateWf({ prioritizationEnabled: true, detectedElements: [] });
    analyzeProblemAreas();
  }, [analyzeProblemAreas, isAnalyzing, updateWf]);

  const problemAreasActionLabel = isAnalyzing
    ? 'Analyzing...'
    : problemAreas.length > 0
      ? 'Re-run AI Pre-Processing'
      : 'Run AI Pre-Processing';

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
                <p className="text-[10px] text-foreground-muted">Original Source</p>
                <p className="text-[9px] text-foreground-muted/60 truncate">Locked for consistent renders</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_SOURCE_IMAGE', payload: null })}
                className="p-1.5 text-foreground-muted hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                title="Reset source image"
              >
                <X size={14} />
              </button>
            </div>
          )}
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

      {/* Background/Environment Reference */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Background Reference
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
                alt="Background reference"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
            className="flex-1 h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-left text-foreground-muted hover:border-accent/50 transition-colors"
          >
            {wf.backgroundReferenceImage ? 'Change reference...' : 'Upload reference...'}
          </button>
          {wf.backgroundReferenceImage && (
            <button
              type="button"
              onClick={handleRemoveBackground}
              className="w-8 h-8 flex items-center justify-center rounded border border-border bg-surface-elevated text-foreground-muted hover:text-rose-500 hover:border-rose-500/50 transition-colors"
              title="Remove reference"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="Problem Areas" />
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleProblemAreaAnalysis}
            disabled={isAnalyzing}
            className={cn(
              "w-full py-2 text-xs font-semibold rounded border transition-colors",
              isAnalyzing
                ? "bg-surface-sunken text-foreground-muted border-border"
                : "bg-foreground text-background border-foreground hover:opacity-90"
            )}
          >
            {problemAreasActionLabel}
          </button>

          {wf.prioritizationEnabled && (
            <>
              <p className="text-[10px] text-foreground-muted">
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
    </div>
  );
};
