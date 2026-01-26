
import React, { useCallback, useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../../../store';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SectionHeader } from './SharedLeftComponents';
import { Toggle } from '../../ui/Toggle';
import { StyleGrid } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { LayoutIcon, ScissorsIcon, BuildingIcon, MapIcon, RefreshCw, X, ChevronDown } from 'lucide-react';
import {
    getGeminiService,
    initGeminiService,
    isGeminiServiceInitialized,
    ImageUtils
} from '../../../services/geminiService';

export const LeftRenderCADPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    const updateWf = useCallback(
      (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
      [dispatch]
    );
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const cadSpace = wf.cadSpace;
    const sourceImage = state.sourceImage || state.uploadedImage;
    const [openMenu, setOpenMenu] = useState<null | 'room' | 'ceiling' | 'window' | 'door'>(null);
    const roomMenuRef = useRef<HTMLDivElement>(null);
    const ceilingMenuRef = useRef<HTMLDivElement>(null);
    const windowMenuRef = useRef<HTMLDivElement>(null);
    const doorMenuRef = useRef<HTMLDivElement>(null);
    const lastLayerScanRef = useRef<string | null>(null);
    const backgroundInputRef = useRef<HTMLInputElement>(null);

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

    const roomTypeCategories = [
      {
        label: 'Terminal & Public',
        options: [
          'Airport Departure Hall',
          'Airport Arrivals Hall',
          'Check-in Counter',
          'Ticketing Area',
          'Main Concourse',
          'Terminal Atrium',
          'Information Desk',
          'Terminal Curbside',
        ]
      },
      {
        label: 'Security & Processing',
        options: [
          'Security Checkpoint',
          'Passport Control',
          'Customs Hall',
          'Immigration Area',
        ]
      },
      {
        label: 'Gates & Boarding',
        options: [
          'Gate Waiting Area',
          'Jet Bridge / Boarding Gate',
          'Family Waiting Area',
        ]
      },
      {
        label: 'Lounges',
        options: [
          'Airline Lounge',
          'Business Class Lounge',
          'First Class Lounge',
          'Transit Lounge',
          'Hospitality Lounge',
        ]
      },
      {
        label: 'Baggage',
        options: [
          'Baggage Claim',
          'Baggage Drop-off',
          'Oversized Baggage',
          'Lost Baggage Office',
        ]
      },
      {
        label: 'Retail & Dining',
        options: [
          'Duty-Free Shop',
          'Food Court',
          'Restaurant / Bar',
          'Restaurant Dining',
          'Retail Corridor',
          'Retail Store',
        ]
      },
      {
        label: 'Transport & Access',
        options: [
          'Ground Transportation',
          'Taxi / Rideshare Pickup',
          'Parking Garage',
          'Rental Car Center',
          'Airport Entry Plaza',
        ]
      },
      {
        label: 'Airside & Operations',
        options: [
          'Control Tower (Exterior)',
          'Maintenance Hangar',
          'Cargo Terminal',
          'Runway View',
          'Apron / Tarmac',
        ]
      },
      {
        label: 'Office & Commercial',
        options: [
          'Airport Office',
          'Office Open Plan',
          'Office Reception',
          'Conference / Event Hall',
        ]
      },
      {
        label: 'Hospitality & Culture',
        options: [
          'Hotel Lobby',
          'Museum / Gallery',
          'Library',
        ]
      },
      {
        label: 'Circulation & Public',
        options: [
          'Atrium / Public Hall',
          'Lobby / Reception',
          'Corridor / Circulation',
          'Stair / Vertical Core',
          'Covered Walkway',
        ]
      },
      {
        label: 'Back of House',
        options: [
          'Service Corridor',
          'Loading Dock',
          'Storage / Back-of-house',
          'Restroom',
          'Mechanical / Utility',
        ]
      },
      {
        label: 'Exterior',
        options: [
          'Outdoor Plaza',
          'Urban Streetscape',
        ]
      },
    ];
    const ceilingOptions = [
      { value: 'flat', label: 'Flat' },
      { value: 'coffered', label: 'Coffered' },
      { value: 'beams', label: 'Beams' },
      { value: 'vaulted', label: 'Vaulted' },
    ];
    const windowOptions = [
      { value: 'slim', label: 'Slim Frame' },
      { value: 'heavy', label: 'Heavy Frame' },
      { value: 'curtain', label: 'Curtain Wall' },
      { value: 'frosted', label: 'Frosted' },
      { value: 'tinted', label: 'Tinted' },
    ];
    const doorOptions = [
      { value: 'panel', label: 'Panel' },
      { value: 'glass', label: 'Glass' },
      { value: 'flush', label: 'Flush' },
      { value: 'industrial', label: 'Industrial' },
    ];

    const layerColors = {
      wall: '#7aa2f7',
      window: '#7dcfff',
      door: '#f7768e',
      stairs: '#9ece6a',
      dims: '#e0af68',
      text: '#bb9af7',
    } as const;

    const normalizeLayerType = useCallback((rawType: string, name: string) => {
      const cleaned = (rawType || '').toLowerCase();
      if (cleaned.includes('wall')) return 'wall';
      if (cleaned.includes('window') || cleaned.includes('glazing')) return 'window';
      if (cleaned.includes('door')) return 'door';
      if (cleaned.includes('stair')) return 'stairs';
      if (cleaned.includes('text') || cleaned.includes('label') || cleaned.includes('annotation')) return 'text';
      if (cleaned.includes('dim') || cleaned.includes('grid') || cleaned.includes('structure')) return 'dims';

      const nameLower = name.toLowerCase();
      if (nameLower.includes('wall')) return 'wall';
      if (nameLower.includes('window') || nameLower.includes('glazing')) return 'window';
      if (nameLower.includes('door')) return 'door';
      if (nameLower.includes('stair')) return 'stairs';
      if (nameLower.includes('annotation') || nameLower.includes('label') || nameLower.includes('text')) return 'text';
      if (nameLower.includes('dim') || nameLower.includes('grid') || nameLower.includes('structure')) return 'dims';

      return 'dims';
    }, []);

    const parseCadLayers = useCallback((raw: string) => {
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
        .map((item: any) => {
          const name = typeof item?.name === 'string' ? item.name.trim() : '';
          if (!name) {
            return null;
          }
          const rawType = typeof item?.type === 'string' ? item.type : '';
          const confidence = typeof item?.confidence === 'number' ? item.confidence : 0.6;
          const type = normalizeLayerType(rawType, name);
          return {
            layer: {
              id: nanoid(),
              name,
              color: layerColors[type],
              type,
              visible: true
            },
            confidence
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.confidence - a.confidence)
        .map(({ layer }) => layer);
    }, [layerColors, normalizeLayerType]);

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

    const analyzeCadLayers = useCallback(async (imageUrl: string) => {
      if (!ensureServiceInitialized()) {
        updateWf({ cadLayers: [] });
        return;
      }

      setIsDetecting(true);
      try {
        const cadTypeMap: Record<string, string> = {
          plan: 'floor plan',
          section: 'section drawing',
          elevation: 'elevation drawing',
          site: 'site plan',
        };
        const service = getGeminiService();
        const imageData = ImageUtils.dataUrlToImageData(imageUrl);
        const prompt = [
          `Analyze this CAD ${cadTypeMap[wf.cadDrawingType] || 'drawing'} and identify key layer categories.`,
          'Return ONLY a JSON array: [{ "name": string, "type": "wall"|"window"|"door"|"stairs"|"dims"|"text", "confidence": number }].',
          'Use type "dims" for dimensions, grids, or structural lines. Use type "text" for annotations or labels.',
          'Limit to the most important layers only.'
        ].join(' ');

        const text = await service.generateText({
          prompt,
          images: [imageData]
        });
        const parsed = parseCadLayers(text);
        if (lastLayerScanRef.current === imageUrl) {
          updateWf({ cadLayers: parsed });
        }
      } catch (error) {
        console.error('CAD layer detection failed:', error);
        if (lastLayerScanRef.current === imageUrl) {
          updateWf({ cadLayers: [] });
        }
      } finally {
        if (lastLayerScanRef.current === imageUrl) {
          setIsDetecting(false);
        }
      }
    }, [ensureServiceInitialized, parseCadLayers, updateWf, wf.cadDrawingType]);

    const handleLayerDetection = useCallback(() => {
      if (isDetecting) return;
      updateWf({ cadLayerDetectionEnabled: true, cadLayers: [] });
      if (!sourceImage) {
        lastLayerScanRef.current = null;
        return;
      }
      lastLayerScanRef.current = sourceImage;
      analyzeCadLayers(sourceImage);
    }, [analyzeCadLayers, isDetecting, sourceImage, updateWf]);

    const layerDetectionLabel = isDetecting
      ? 'Detecting...'
      : wf.cadLayers.length > 0
        ? 'Re-run AI Pre-Processing'
        : 'Run AI Pre-Processing';

    const toggleLayer = (id: string) => {
      const newLayers = wf.cadLayers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
      updateWf({ cadLayers: newLayers });
    };

    useEffect(() => {
      if (!openMenu) return;
      const handleClick = (event: MouseEvent) => {
        const target = event.target as Node;
        const isInside =
          roomMenuRef.current?.contains(target) ||
          ceilingMenuRef.current?.contains(target) ||
          windowMenuRef.current?.contains(target) ||
          doorMenuRef.current?.contains(target);
        if (!isInside) {
          setOpenMenu(null);
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [openMenu]);

    useEffect(() => {
      if (!wf.cadLayerDetectionEnabled) {
        lastLayerScanRef.current = null;
        setIsDetecting(false);
        return;
      }
      if (!sourceImage) {
        setIsDetecting(false);
        updateWf({ cadLayers: [] });
        return;
      }
      if (lastLayerScanRef.current === sourceImage) return;
      lastLayerScanRef.current = sourceImage;
      analyzeCadLayers(sourceImage);
    }, [analyzeCadLayers, sourceImage, updateWf, wf.cadLayerDetectionEnabled]);

    const toggleMenu = (menu: 'room' | 'ceiling' | 'window' | 'door') => {
      setOpenMenu((current) => (current === menu ? null : menu));
    };

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
          <SectionHeader title="Drawing Type" />
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { id: 'plan', label: 'Floor Plan', icon: LayoutIcon },
              { id: 'section', label: 'Section', icon: ScissorsIcon },
              { id: 'elevation', label: 'Elevation', icon: BuildingIcon },
              { id: 'site', label: 'Site Plan', icon: MapIcon }
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => updateWf({ cadDrawingType: t.id as any })}
                className={cn(
                  "text-xs py-2 px-2 rounded border transition-all flex flex-col items-center gap-1.5 h-16 justify-center", 
                  wf.cadDrawingType === t.id 
                    ? "bg-foreground text-background border-foreground shadow-sm" 
                    : "bg-surface-elevated border-border hover:border-foreground-muted hover:bg-surface-sunken"
                )}
              >
                <t.icon size={16} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Scale</label>
              <select 
                className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                value={wf.cadScale}
                onChange={(e) => updateWf({ cadScale: e.target.value })}
              >
                <option value="1:50">1:50</option>
                <option value="1:100">1:100</option>
                <option value="1:200">1:200</option>
                <option value="1:500">1:500</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
            
            <div>
               <label className="text-xs text-foreground-muted mb-1 block">Orientation</label>
               <div className="flex gap-1 bg-surface-sunken p-1 rounded-lg border border-border-subtle justify-between">
                 {[0, 90, 180, 270].map(deg => (
                   <button
                    key={deg}
                    onClick={() => updateWf({ cadOrientation: deg })}
                    className={cn(
                      "w-7 h-7 rounded text-[10px] font-mono flex items-center justify-center transition-colors",
                      wf.cadOrientation === deg 
                        ? "bg-foreground text-background font-bold" 
                        : "hover:bg-surface-elevated text-foreground-muted"
                    )}
                   >
                     {deg}°
                   </button>
                 ))}
               </div>
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
          <SectionHeader title="Space Interpretation" />
          <div className="space-y-3">
            <div ref={roomMenuRef}>
              <label className="text-xs text-foreground-muted mb-1 block">Room Type</label>
              <button
                type="button"
                className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-left flex items-center justify-between"
                onClick={() => toggleMenu('room')}
                aria-expanded={openMenu === 'room'}
              >
                <span className="truncate">{cadSpace.roomType}</span>
                <ChevronDown size={12} className={cn(
                  "text-foreground-muted transition-transform",
                  openMenu === 'room' && "rotate-180"
                )} />
              </button>
              {openMenu === 'room' && (
                <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-elevated text-xs shadow-xl">
                  {roomTypeCategories.map((category, catIndex) => (
                    <div key={category.label}>
                      <div className={cn(
                        "sticky top-0 z-10 px-3 py-2 flex items-center gap-2",
                        "bg-gradient-to-r from-accent/20 via-accent/10 to-transparent",
                        "border-y border-accent/30",
                        catIndex > 0 && "mt-1"
                      )}>
                        <div className="w-2 h-2 rounded-full bg-accent shadow-sm shadow-accent/50" />
                        <span className="text-[11px] font-bold text-accent uppercase tracking-wider">
                          {category.label}
                        </span>
                        <span className="text-[9px] text-foreground-muted ml-auto bg-surface-sunken px-1.5 py-0.5 rounded">
                          {category.options.length}
                        </span>
                      </div>
                      <div className="py-0.5">
                        {category.options.map((room) => (
                          <button
                            key={room}
                            type="button"
                            onClick={() => {
                              updateWf({ cadSpace: { ...cadSpace, roomType: room } });
                              setOpenMenu(null);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-1.5 transition-colors border-l-2",
                              room === cadSpace.roomType
                                ? "bg-accent text-white font-medium border-l-accent"
                                : "text-foreground hover:bg-surface-sunken border-l-transparent hover:border-l-accent/50"
                            )}
                          >
                            {room}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Ceiling Style</label>
              <div ref={ceilingMenuRef}>
                <button
                  type="button"
                  className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-left flex items-center justify-between"
                  onClick={() => toggleMenu('ceiling')}
                  aria-expanded={openMenu === 'ceiling'}
                >
                  <span className="truncate">
                    {ceilingOptions.find((option) => option.value === cadSpace.ceilingStyle)?.label}
                  </span>
                  <span className="text-[10px] text-foreground-muted">v</span>
                </button>
                {openMenu === 'ceiling' && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-surface-elevated text-xs shadow-sm">
                    {ceilingOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          updateWf({ cadSpace: { ...cadSpace, ceilingStyle: option.value } });
                          setOpenMenu(null);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 transition-colors",
                          option.value === cadSpace.ceilingStyle
                            ? "bg-surface-sunken text-foreground"
                            : "text-foreground-muted hover:text-foreground hover:bg-surface-sunken/50"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Window Style Preset</label>
              <div ref={windowMenuRef}>
                <button
                  type="button"
                  className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-left flex items-center justify-between"
                  onClick={() => toggleMenu('window')}
                  aria-expanded={openMenu === 'window'}
                >
                  <span className="truncate">
                    {windowOptions.find((option) => option.value === cadSpace.windowStyle)?.label}
                  </span>
                  <span className="text-[10px] text-foreground-muted">v</span>
                </button>
                {openMenu === 'window' && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-surface-elevated text-xs shadow-sm">
                    {windowOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          updateWf({ cadSpace: { ...cadSpace, windowStyle: option.value } });
                          setOpenMenu(null);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 transition-colors",
                          option.value === cadSpace.windowStyle
                            ? "bg-surface-sunken text-foreground"
                            : "text-foreground-muted hover:text-foreground hover:bg-surface-sunken/50"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Door Style Preset</label>
              <div ref={doorMenuRef}>
                <button
                  type="button"
                  className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-left flex items-center justify-between"
                  onClick={() => toggleMenu('door')}
                  aria-expanded={openMenu === 'door'}
                >
                  <span className="truncate">
                    {doorOptions.find((option) => option.value === cadSpace.doorStyle)?.label}
                  </span>
                  <span className="text-[10px] text-foreground-muted">v</span>
                </button>
                {openMenu === 'door' && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-surface-elevated text-xs shadow-sm">
                    {doorOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          updateWf({ cadSpace: { ...cadSpace, doorStyle: option.value } });
                          setOpenMenu(null);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 transition-colors",
                          option.value === cadSpace.doorStyle
                            ? "bg-surface-sunken text-foreground"
                            : "text-foreground-muted hover:text-foreground hover:bg-surface-sunken/50"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
  
        <div>
          <SectionHeader title="Layer Detection" />
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLayerDetection}
              disabled={isDetecting}
              className={cn(
                "w-full py-2 text-xs font-semibold rounded border transition-colors",
                isDetecting
                  ? "bg-surface-sunken text-foreground-muted border-border"
                  : "bg-foreground text-background border-foreground hover:opacity-90"
              )}
            >
              {layerDetectionLabel}
            </button>
            {wf.cadLayerDetectionEnabled && (
              <div className="space-y-1">
                 {!sourceImage && (
                   <div className="text-[10px] text-foreground-muted py-1">
                     Upload a CAD image to detect layers.
                   </div>
                 )}
                 {sourceImage && isDetecting && (
                   <div className="flex items-center gap-2 text-[10px] text-foreground-muted py-2">
                     <RefreshCw size={12} className="animate-spin" />
                     Detecting CAD layers...
                   </div>
                 )}
                 {sourceImage && !isDetecting && wf.cadLayers.length === 0 && (
                   <div className="text-[10px] text-foreground-muted py-1">
                     No layers detected yet.
                   </div>
                 )}
                 {sourceImage && wf.cadLayers.map(layer => (
                   <div key={layer.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded hover:border-foreground-muted transition-colors">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: layer.color }} />
                      <span className="text-xs flex-1 font-medium">{layer.name}</span>
                      <Toggle label="" checked={layer.visible} onChange={() => toggleLayer(layer.id)} />
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
};
