import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionDesc, SliderControl, SunPositionWidget, ColorPicker } from './SharedRightComponents';
import { Image as ImageIcon, Move, Wrench, Search, X, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

const selectionTargets = ['Facade', 'Windows', 'Sky', 'Ground', 'Vegetation', 'People', 'Vehicles', 'Building'];
const selectionExamples = [
  'Replace with modern glass facade',
  'Add greenery and climbing plants',
  'Change to brick material',
  'Remove and fill with background',
  'Add people walking',
];

const fallbackMaterialPreview =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22200%22%20height%3D%22200%22%20viewBox%3D%220%200%20200%20200%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23e7ecf3%22/%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23cfd7e2%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20fill%3D%22url(%23g)%22/%3E%3C/svg%3E';

const normalizeMaterialQuery = (query: string) =>
  query
    .split(',')
    .map((part) => encodeURIComponent(part.trim()))
    .filter(Boolean)
    .join(',');

const buildMaterialPreview = (query: string, lock: number) =>
  `https://loremflickr.com/240/240/${normalizeMaterialQuery(query)}?lock=${lock}`;

const buildMaterialAltPreview = (query: string) =>
  `https://source.unsplash.com/240x240/?${normalizeMaterialQuery(query)}`;

const materialSwatches = [
  { id: 'floor-oak', label: 'Oak Plank', category: 'Flooring', query: 'oak,wood,texture' },
  { id: 'floor-walnut', label: 'Walnut Plank', category: 'Flooring', query: 'walnut,wood,texture' },
  { id: 'floor-maple', label: 'Maple', category: 'Flooring', query: 'maple,wood,texture' },
  { id: 'floor-terrazzo', label: 'Terrazzo', category: 'Flooring', query: 'terrazzo,texture' },
  { id: 'floor-polished-concrete', label: 'Polished Concrete', category: 'Flooring', query: 'polished,concrete,texture' },
  { id: 'floor-bamboo', label: 'Bamboo', category: 'Flooring', query: 'bamboo,wood,texture' },
  { id: 'floor-cork', label: 'Cork', category: 'Flooring', query: 'cork,texture' },
  { id: 'floor-chevron', label: 'Chevron Oak', category: 'Flooring', query: 'herringbone,wood,texture' },

  { id: 'wall-plaster', label: 'White Plaster', category: 'Wall', query: 'plaster,wall,texture' },
  { id: 'wall-venetian', label: 'Venetian Plaster', category: 'Wall', query: 'stucco,texture' },
  { id: 'wall-gypsum', label: 'Painted Gypsum', category: 'Wall', query: 'painted,wall,texture' },
  { id: 'wall-limewash', label: 'Limewash', category: 'Wall', query: 'limewash,wall,texture' },
  { id: 'wall-microcement', label: 'Microcement', category: 'Wall', query: 'microcement,texture' },
  { id: 'wall-wood-slat', label: 'Wood Slat', category: 'Wall', query: 'wood,slat,texture' },
  { id: 'wall-ceramic-tile', label: 'Ceramic Tile', category: 'Wall', query: 'ceramic,tile,texture' },
  { id: 'wall-acoustic', label: 'Acoustic Panel', category: 'Wall', query: 'acoustic,panel,texture' },

  { id: 'facade-brick-red', label: 'Red Brick', category: 'Facade', query: 'red,brick,texture' },
  { id: 'facade-brick-white', label: 'White Brick', category: 'Facade', query: 'white,brick,texture' },
  { id: 'facade-brick-dark', label: 'Dark Brick', category: 'Facade', query: 'dark,brick,texture' },
  { id: 'facade-corten', label: 'Corten Panel', category: 'Facade', query: 'corten,steel,texture' },
  { id: 'facade-aluminum', label: 'Aluminum Panel', category: 'Facade', query: 'aluminum,cladding,texture' },
  { id: 'facade-fiber-cement', label: 'Fiber Cement', category: 'Facade', query: 'fiber,cement,texture' },
  { id: 'facade-concrete-board', label: 'Concrete Board', category: 'Facade', query: 'concrete,board,texture' },
  { id: 'facade-stone-clad', label: 'Stone Cladding', category: 'Facade', query: 'stone,cladding,texture' },

  { id: 'roof-standing-seam', label: 'Standing Seam', category: 'Roof', query: 'standing,seam,metal,roof' },
  { id: 'roof-clay-tile', label: 'Clay Tile', category: 'Roof', query: 'clay,roof,tile' },
  { id: 'roof-slate', label: 'Slate', category: 'Roof', query: 'slate,roof,texture' },
  { id: 'roof-gravel', label: 'Gravel', category: 'Roof', query: 'gravel,roof,texture' },
  { id: 'roof-green', label: 'Green Roof', category: 'Roof', query: 'green,roof,texture' },
  { id: 'roof-epdm', label: 'EPDM Membrane', category: 'Roof', query: 'rubber,roof,texture' },
  { id: 'roof-copper', label: 'Copper Roof', category: 'Roof', query: 'copper,roof,texture' },

  { id: 'metal-brushed-steel', label: 'Brushed Steel', category: 'Metal', query: 'brushed,steel,texture' },
  { id: 'metal-black', label: 'Black Steel', category: 'Metal', query: 'black,steel,texture' },
  { id: 'metal-anodized', label: 'Anodized Aluminum', category: 'Metal', query: 'anodized,aluminum,texture' },
  { id: 'metal-brass', label: 'Brass', category: 'Metal', query: 'brass,metal,texture' },
  { id: 'metal-copper-patina', label: 'Copper Patina', category: 'Metal', query: 'copper,patina,texture' },
  { id: 'metal-zinc', label: 'Zinc', category: 'Metal', query: 'zinc,metal,texture' },
  { id: 'metal-perforated', label: 'Perforated Metal', category: 'Metal', query: 'perforated,metal,texture' },

  { id: 'glass-clear', label: 'Clear Glass', category: 'Glass', query: 'clear,glass,texture' },
  { id: 'glass-frosted', label: 'Frosted Glass', category: 'Glass', query: 'frosted,glass,texture' },
  { id: 'glass-tinted', label: 'Tinted Glass', category: 'Glass', query: 'tinted,glass,texture' },
  { id: 'glass-low-e', label: 'Low-E Glass', category: 'Glass', query: 'glass,low-e,texture' },
  { id: 'glass-ribbed', label: 'Ribbed Glass', category: 'Glass', query: 'ribbed,glass,texture' },
  { id: 'glass-reflective', label: 'Reflective Glass', category: 'Glass', query: 'reflective,glass,texture' },
  { id: 'glass-wired', label: 'Wired Glass', category: 'Glass', query: 'wired,glass,texture' },

  { id: 'stone-marble', label: 'Marble', category: 'Stone', query: 'marble,texture' },
  { id: 'stone-travertine', label: 'Travertine', category: 'Stone', query: 'travertine,texture' },
  { id: 'stone-limestone', label: 'Limestone', category: 'Stone', query: 'limestone,texture' },
  { id: 'stone-granite', label: 'Granite', category: 'Stone', query: 'granite,texture' },
  { id: 'stone-sandstone', label: 'Sandstone', category: 'Stone', query: 'sandstone,texture' },
  { id: 'stone-basalt', label: 'Basalt', category: 'Stone', query: 'basalt,texture' },
  { id: 'stone-quartzite', label: 'Quartzite', category: 'Stone', query: 'quartzite,texture' },

  { id: 'fabric-linen', label: 'Linen', category: 'Fabric', query: 'linen,fabric,texture' },
  { id: 'fabric-wool', label: 'Wool Felt', category: 'Fabric', query: 'wool,felt,texture' },
  { id: 'fabric-leather', label: 'Leather', category: 'Fabric', query: 'leather,texture' },
  { id: 'fabric-velvet', label: 'Velvet', category: 'Fabric', query: 'velvet,fabric,texture' },
  { id: 'fabric-canvas', label: 'Canvas', category: 'Fabric', query: 'canvas,fabric,texture' },
  { id: 'fabric-sheer', label: 'Sheer', category: 'Fabric', query: 'sheer,fabric,texture' },
  { id: 'fabric-acoustic', label: 'Acoustic Fabric', category: 'Fabric', query: 'acoustic,fabric,texture' },
].map((item, index) => ({
  ...item,
  previewUrl: buildMaterialPreview(item.query, index + 1),
  previewAltUrl: buildMaterialAltPreview(item.query),
}));

const materialCategories = ['All', 'Flooring', 'Wall', 'Facade', 'Roof', 'Metal', 'Glass', 'Stone', 'Fabric'];

const hdriPresets = ['Studio', 'Outdoor', 'Overcast', 'Interior', 'Night'];
const skyPresets = [
  'Clear Blue',
  'Cloudy',
  'Overcast',
  'Sunset',
  'Golden Hour',
  'Blue Hour',
  'Dusk',
  'Night',
  'Stormy',
  'Dramatic',
];

const removeQuickOptions = [
  'People',
  'Vehicles',
  'Wires',
  'Signs',
  'Shadows',
  'Streetlights',
  'Poles',
  'Fences',
  'Trash',
  'Graffiti',
  'Reflections',
  'Glare',
  'Scaffolding',
  'Cones',
  'Construction Barriers',
  'Temporary Fencing',
  'Luggage Carts',
  'Queue Barriers',
  'Stanchions',
  'Cables',
  'Pipes',
  'HVAC Units',
  'Security Cameras',
  'Fire Extinguishers',
  'Exit Signs',
  'Wayfinding Displays',
  'Ad Posters',
  'Benches',
  'Chairs',
  'Plants',
  'Bollards',
  'Road Markings',
  'Puddles',
  'Birds',
  'Tree Branches',
];

const replaceStylesByCategory: Record<string, string[]> = {
  Furniture: ['Modern', 'Classic', 'Industrial', 'Minimal', 'Scandi'],
  Vehicle: ['Sedan', 'SUV', 'Bus', 'Service', 'Electric'],
  Plant: ['Tropical', 'Temperate', 'Desert', 'Lush', 'Sparse'],
  Person: ['Business', 'Casual', 'Travel', 'Family', 'Uniform'],
  Object: ['Decor', 'Tech', 'Signage', 'Art', 'Utility'],
};

const assetOptions = [
  { id: 'chair-01', label: 'Chair' },
  { id: 'sofa-01', label: 'Sofa' },
  { id: 'desk-01', label: 'Desk' },
  { id: 'plant-01', label: 'Plant' },
  { id: 'person-01', label: 'Person' },
  { id: 'car-01', label: 'Vehicle' },
  { id: 'lamp-01', label: 'Lamp' },
  { id: 'bench-01', label: 'Bench' },
  { id: 'sign-01', label: 'Sign' },
];

export const VisualEditPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const tool = wf.activeTool;

  const [showExamples, setShowExamples] = useState(false);
  const [materialQuery, setMaterialQuery] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [isMaterialBrowserOpen, setIsMaterialBrowserOpen] = useState(false);
  const [materialFilterCategory, setMaterialFilterCategory] = useState('All');

  const updateWf = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

  const updateSelection = (updates: Partial<typeof wf.visualSelection>) =>
    updateWf({ visualSelection: { ...wf.visualSelection, ...updates } });
  const updateMaterial = (updates: Partial<typeof wf.visualMaterial>) =>
    updateWf({ visualMaterial: { ...wf.visualMaterial, ...updates } });
  const updateLighting = (updates: Partial<typeof wf.visualLighting>) =>
    updateWf({ visualLighting: { ...wf.visualLighting, ...updates } });
  const updateLightingSun = (updates: Partial<typeof wf.visualLighting.sun>) =>
    updateLighting({ sun: { ...wf.visualLighting.sun, ...updates } });
  const updateLightingHdri = (updates: Partial<typeof wf.visualLighting.hdri>) =>
    updateLighting({ hdri: { ...wf.visualLighting.hdri, ...updates } });
  const updateLightingArtificial = (updates: Partial<typeof wf.visualLighting.artificial>) =>
    updateLighting({ artificial: { ...wf.visualLighting.artificial, ...updates } });
  const updateSky = (updates: Partial<typeof wf.visualSky>) =>
    updateWf({ visualSky: { ...wf.visualSky, ...updates } });
  const updateObject = (updates: Partial<typeof wf.visualObject>) =>
    updateWf({ visualObject: { ...wf.visualObject, ...updates } });
  const updateRemove = (updates: Partial<typeof wf.visualRemove>) =>
    updateWf({ visualRemove: { ...wf.visualRemove, ...updates } });
  const updateReplace = (updates: Partial<typeof wf.visualReplace>) =>
    updateWf({ visualReplace: { ...wf.visualReplace, ...updates } });
  const updateAdjust = (updates: Partial<typeof wf.visualAdjust>) =>
    updateWf({ visualAdjust: { ...wf.visualAdjust, ...updates } });
  const updateExtend = (updates: Partial<typeof wf.visualExtend>) =>
    updateWf({ visualExtend: { ...wf.visualExtend, ...updates } });

  const filteredMaterials = useMemo(() => {
    const query = materialQuery.trim().toLowerCase();
    return materialSwatches.filter((item) => {
      const matchesCategory = materialFilterCategory === 'All' || item.category === materialFilterCategory;
      const matchesQuery = !query || item.label.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [materialFilterCategory, materialQuery]);

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    if (!query) return assetOptions;
    return assetOptions.filter((item) => item.label.toLowerCase().includes(query));
  }, [assetQuery]);

  const handleToggleTarget = (target: string) => {
    const next = wf.visualSelection.autoTargets.includes(target)
      ? wf.visualSelection.autoTargets.filter((item) => item !== target)
      : [...wf.visualSelection.autoTargets, target];
    updateSelection({ autoTargets: next });
  };

  const handleQuickRemove = (label: string) => {
    const next = wf.visualRemove.quickRemove.includes(label)
      ? wf.visualRemove.quickRemove.filter((item) => item !== label)
      : [...wf.visualRemove.quickRemove, label];
    updateRemove({ quickRemove: next });
  };

  const handleAdjustPreset = (preset: 'reset' | 'auto' | 'vivid' | 'soft' | 'dramatic') => {
    if (preset === 'reset') {
      updateAdjust({
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        saturation: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        sharpness: 0,
        noiseReduction: 0,
        clarity: 0,
        vignette: 0,
        grain: 0,
        styleStrength: 50,
      });
      return;
    }

    if (preset === 'auto') {
      updateAdjust({ exposure: 10, contrast: 8, highlights: -5, shadows: 8, clarity: 10, vibrance: 10 });
      return;
    }

    if (preset === 'vivid') {
      updateAdjust({ contrast: 18, saturation: 20, vibrance: 25, clarity: 12 });
      return;
    }

    if (preset === 'soft') {
      updateAdjust({ contrast: -10, highlights: 10, shadows: 12, clarity: -5 });
      return;
    }

    updateAdjust({ contrast: 22, saturation: 8, clarity: 18, vignette: 20, grain: 10 });
  };

  const renderToolOptions = () => {
    switch (tool) {
      case 'select':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Select an area, then describe what you want to change.</SectionDesc>
            <SegmentedControl
              value={wf.visualSelection.mode}
              options={[
                { label: 'Rect', value: 'rect' },
                { label: 'Brush', value: 'brush' },
                { label: 'Lasso', value: 'lasso' },
                { label: 'Auto', value: 'ai' },
              ]}
              onChange={(value) => updateSelection({ mode: value })}
            />

            {wf.visualSelection.mode === 'brush' && (
              <div className="space-y-2">
                <SliderControl
                  label="Brush Size"
                  value={wf.visualSelection.brushSize}
                  min={10}
                  max={100}
                  step={5}
                  unit="px"
                  onChange={(value) => updateSelection({ brushSize: value })}
                />
              </div>
            )}

            {wf.visualSelection.mode === 'ai' && (
              <div className="grid grid-cols-3 gap-2">
                {selectionTargets.map((target) => {
                  const active = wf.visualSelection.autoTargets.includes(target);
                  return (
                    <button
                      key={target}
                      className={cn(
                        'text-[10px] border rounded px-2 py-2 transition-colors',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                      )}
                      onClick={() => handleToggleTarget(target)}
                    >
                      {target}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Edit Prompt</label>
              <textarea
                value={wf.visualPrompt}
                onChange={(event) => updateWf({ visualPrompt: event.target.value })}
                placeholder="Describe what you want to change in the selected area..."
                className="w-full min-h-[96px] resize-none bg-surface-elevated border border-border rounded text-xs p-2 leading-relaxed focus:outline-none focus:border-accent"
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => setShowExamples((prev) => !prev)}
                  className="text-[10px] text-foreground-muted hover:text-foreground transition-colors"
                >
                  {showExamples ? 'Hide examples' : 'Show examples'}
                </button>
                <span className="text-[10px] text-foreground-muted">Free edit prompt</span>
              </div>
              {showExamples && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectionExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => updateWf({ visualPrompt: example })}
                      className="text-[10px] px-2 py-1 rounded border border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <SliderControl
              label="Strength"
              value={wf.visualSelection.strength}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => updateSelection({ strength: value })}
            />
          </div>
        );
      case 'material':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Replace surface materials and tune texture details.</SectionDesc>
            <SegmentedControl
              value={wf.visualMaterial.surfaceType}
              options={[
                { label: 'Auto', value: 'auto' },
                { label: 'Manual', value: 'manual' },
              ]}
              onChange={(value) => updateMaterial({ surfaceType: value })}
            />

            <div className="rounded-xl border border-border bg-surface-sunken/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Selected Material</div>
                  <div className="text-sm font-semibold text-foreground mt-1">
                    {materialSwatches.find((item) => item.id === wf.visualMaterial.materialId)?.label || 'Custom'}
                  </div>
                  <div className="text-[10px] text-foreground-muted mt-0.5">{wf.visualMaterial.category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-border overflow-hidden bg-surface-elevated">
                    <img
                      src={
                        materialSwatches.find((item) => item.id === wf.visualMaterial.materialId)?.previewUrl ||
                        fallbackMaterialPreview
                      }
                      data-alt-src={
                        materialSwatches.find((item) => item.id === wf.visualMaterial.materialId)?.previewAltUrl
                      }
                      onError={(event) => {
                        const altSrc = event.currentTarget.dataset.altSrc;
                        if (altSrc) {
                          event.currentTarget.src = altSrc;
                          event.currentTarget.removeAttribute('data-alt-src');
                          return;
                        }
                        event.currentTarget.src = fallbackMaterialPreview;
                      }}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMaterialBrowserOpen(true)}
                    className={cn(
                      'h-8 px-3 text-[11px] rounded-md border transition-colors',
                      'border-border bg-surface-elevated text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                    )}
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border-subtle">
              <SliderControl
                label="Scale"
                value={wf.visualMaterial.scale}
                min={10}
                max={500}
                step={5}
                unit="%"
                onChange={(value) => updateMaterial({ scale: value })}
              />
              <SliderControl
                label="Rotation"
                value={wf.visualMaterial.rotation}
                min={0}
                max={360}
                step={1}
                unit="deg"
                onChange={(value) => updateMaterial({ rotation: value })}
              />
              <SliderControl
                label="Roughness"
                value={wf.visualMaterial.roughness}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateMaterial({ roughness: value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Color Tint</span>
              <ColorPicker color={wf.visualMaterial.colorTint} onChange={(value) => updateMaterial({ colorTint: value })} />
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <Toggle
                label="Match Existing Lighting"
                checked={wf.visualMaterial.matchLighting}
                onChange={(value) => updateMaterial({ matchLighting: value })}
              />
              <Toggle
                label="Preserve Reflections"
                checked={wf.visualMaterial.preserveReflections}
                onChange={(value) => updateMaterial({ preserveReflections: value })}
              />
            </div>
          </div>
        );
      case 'lighting':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Relight the scene for a new mood and direction.</SectionDesc>
            <SegmentedControl
              value={wf.visualLighting.mode}
              options={[
                { label: 'Sun', value: 'sun' },
                { label: 'HDRI', value: 'hdri' },
                { label: 'Artificial', value: 'artificial' },
              ]}
              onChange={(value) => updateLighting({ mode: value })}
            />

            {wf.visualLighting.mode === 'sun' && (
              <div className="space-y-3">
                <SunPositionWidget
                  azimuth={wf.visualLighting.sun.azimuth}
                  elevation={wf.visualLighting.sun.elevation}
                  onChange={(azimuth, elevation) => updateLightingSun({ azimuth, elevation })}
                />
                <SliderControl
                  label="Intensity"
                  value={wf.visualLighting.sun.intensity}
                  min={0}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingSun({ intensity: value })}
                />
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-xs font-medium text-foreground">Color Temp</label>
                    <span className="text-[10px] font-mono text-foreground-muted">
                      {wf.visualLighting.sun.colorTemp}K
                    </span>
                  </div>
                  <div className="h-4 w-full relative">
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-border"
                      style={{ background: 'linear-gradient(90deg, #ff6b35, #ffd4a3, #ffffff, #9dc4ff)' }}
                    />
                    <input
                      type="range"
                      min={2000}
                      max={10000}
                      step={100}
                      value={wf.visualLighting.sun.colorTemp}
                      onChange={(event) => updateLightingSun({ colorTemp: parseInt(event.target.value, 10) })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-black/50 pointer-events-none"
                      style={{
                        left: `${((wf.visualLighting.sun.colorTemp - 2000) / 8000) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <SliderControl
                  label="Shadow Softness"
                  value={wf.visualLighting.sun.shadowSoftness}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingSun({ shadowSoftness: value })}
                />
              </div>
            )}

            {wf.visualLighting.mode === 'hdri' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {hdriPresets.map((preset) => {
                    const active = wf.visualLighting.hdri.preset === preset;
                    return (
                      <button
                        key={preset}
                        className={cn(
                          'text-xs border rounded py-2 transition-colors',
                          active
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                        )}
                        onClick={() => updateLightingHdri({ preset })}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <SliderControl
                  label="Rotation"
                  value={wf.visualLighting.hdri.rotation}
                  min={0}
                  max={360}
                  step={1}
                  unit="deg"
                  onChange={(value) => updateLightingHdri({ rotation: value })}
                />
                <SliderControl
                  label="Intensity"
                  value={wf.visualLighting.hdri.intensity}
                  min={0}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingHdri({ intensity: value })}
                />
              </div>
            )}

            {wf.visualLighting.mode === 'artificial' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">Light Type</label>
                  <select
                    className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                    value={wf.visualLighting.artificial.type}
                    onChange={(event) => updateLightingArtificial({ type: event.target.value })}
                  >
                    <option value="point">Point</option>
                    <option value="spot">Spot</option>
                    <option value="area">Area</option>
                  </select>
                </div>
                <div className="text-[10px] text-foreground-muted bg-surface-sunken border border-border rounded p-2">
                  Position picker runs on canvas. Click in the image to place the light.
                </div>
                <SliderControl
                  label="Intensity"
                  value={wf.visualLighting.artificial.intensity}
                  min={0}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingArtificial({ intensity: value })}
                />
                <SliderControl
                  label="Falloff"
                  value={wf.visualLighting.artificial.falloff}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingArtificial({ falloff: value })}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Color</span>
                  <ColorPicker
                    color={wf.visualLighting.artificial.color}
                    onChange={(value) => updateLightingArtificial({ color: value })}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <SliderControl
                label="Ambient Light"
                value={wf.visualLighting.ambient}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateLighting({ ambient: value })}
              />
              <Toggle
                label="Preserve Original Shadows"
                checked={wf.visualLighting.preserveShadows}
                onChange={(value) => updateLighting({ preserveShadows: value })}
              />
            </div>
          </div>
        );
      case 'object':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Place 3D assets and tune their placement.</SectionDesc>
            <div className="relative">
              <input
                className="w-full bg-surface-elevated border border-border rounded text-xs py-2 px-3 pl-8 outline-none focus:border-accent"
                placeholder="Search assets..."
                value={assetQuery}
                onChange={(event) => setAssetQuery(event.target.value)}
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted">
                <ImageIcon size={12} />
              </div>
            </div>

            <SegmentedControl
              value={wf.visualObject.category}
              options={[
                { label: 'Furniture', value: 'Furniture' },
                { label: 'People', value: 'People' },
                { label: 'Vehicles', value: 'Vehicles' },
                { label: 'Vegetation', value: 'Vegetation' },
                { label: 'Props', value: 'Props' },
              ]}
              onChange={(value) => updateObject({ category: value })}
            />

            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
              {filteredAssets.map((asset) => {
                const active = wf.visualObject.assetId === asset.id;
                return (
                  <button
                    key={asset.id}
                    className={cn(
                      'aspect-square border rounded flex flex-col items-center justify-center text-[9px] transition-colors',
                      active ? 'border-foreground bg-surface-elevated' : 'border-border bg-surface-sunken hover:border-foreground-muted'
                    )}
                    onClick={() => updateObject({ assetId: asset.id })}
                  >
                    <div className="w-8 h-8 bg-foreground/10 rounded mb-1" />
                    {asset.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <SliderControl
                label="Scale"
                value={wf.visualObject.scale}
                min={10}
                max={300}
                step={1}
                unit="%"
                onChange={(value) => updateObject({ scale: value })}
              />
              <SliderControl
                label="Rotation"
                value={wf.visualObject.rotation}
                min={0}
                max={360}
                step={1}
                unit="deg"
                onChange={(value) => updateObject({ rotation: value })}
              />
              <Toggle
                label="Auto-Perspective Match"
                checked={wf.visualObject.autoPerspective}
                onChange={(value) => updateObject({ autoPerspective: value })}
              />
              <Toggle
                label="Cast Shadows"
                checked={wf.visualObject.shadow}
                onChange={(value) => updateObject({ shadow: value })}
              />
              <Toggle
                label="Ground Contact"
                checked={wf.visualObject.groundContact}
                onChange={(value) => updateObject({ groundContact: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <SliderControl
                label="Position X"
                value={wf.visualObject.position.x}
                min={-100}
                max={100}
                step={1}
                unit="px"
                onChange={(value) => updateObject({ position: { ...wf.visualObject.position, x: value } })}
              />
              <SliderControl
                label="Position Y"
                value={wf.visualObject.position.y}
                min={-100}
                max={100}
                step={1}
                unit="px"
                onChange={(value) => updateObject({ position: { ...wf.visualObject.position, y: value } })}
              />
              <SegmentedControl
                value={wf.visualObject.depth}
                options={[
                  { label: 'Foreground', value: 'foreground' },
                  { label: 'Midground', value: 'midground' },
                  { label: 'Background', value: 'background' },
                ]}
                onChange={(value) => updateObject({ depth: value })}
              />
            </div>
          </div>
        );
      case 'sky':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Replace sky and tune atmosphere.</SectionDesc>
            <div className="grid grid-cols-2 gap-2">
              {skyPresets.map((preset) => {
                const active = wf.visualSky.preset === preset;
                return (
                  <button
                    key={preset}
                    className={cn(
                      'text-xs border rounded py-2 transition-colors',
                      active
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                    )}
                    onClick={() => updateSky({ preset })}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <SliderControl
                label="Horizon Line"
                value={wf.visualSky.horizonLine}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ horizonLine: value })}
              />
              <SliderControl
                label="Cloud Density"
                value={wf.visualSky.cloudDensity}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ cloudDensity: value })}
              />
              <SliderControl
                label="Atmospheric Haze"
                value={wf.visualSky.atmosphere}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ atmosphere: value })}
              />
              <SliderControl
                label="Sky Brightness"
                value={wf.visualSky.brightness}
                min={0}
                max={200}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ brightness: value })}
              />
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <Toggle
                label="Reflect in Glass/Water"
                checked={wf.visualSky.reflectInGlass}
                onChange={(value) => updateSky({ reflectInGlass: value })}
              />
              <Toggle
                label="Match Building Lighting"
                checked={wf.visualSky.matchLighting}
                onChange={(value) => updateSky({ matchLighting: value })}
              />
              <Toggle
                label="Add Sun Flare"
                checked={wf.visualSky.sunFlare}
                onChange={(value) => updateSky({ sunFlare: value })}
              />
            </div>
          </div>
        );
      case 'remove':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Erase unwanted elements with AI tools.</SectionDesc>
            <SegmentedControl
              value={wf.visualRemove.mode}
              options={[
                { label: 'Generative Fill', value: 'fill' },
                { label: 'Content-Aware', value: 'aware' },
              ]}
              onChange={(value) => updateRemove({ mode: value })}
            />

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Quick Remove</label>
              <div className="grid grid-cols-2 gap-2">
                {removeQuickOptions.map((option) => {
                  const active = wf.visualRemove.quickRemove.includes(option);
                  return (
                    <button
                      key={option}
                      className={cn(
                        'text-[10px] border rounded py-2 transition-colors',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                      )}
                      onClick={() => handleQuickRemove(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <Toggle
                label="Auto-Detect Edges"
                checked={wf.visualRemove.autoDetectEdges}
                onChange={(value) => updateRemove({ autoDetectEdges: value })}
              />
              <Toggle
                label="Preserve Structure"
                checked={wf.visualRemove.preserveStructure}
                onChange={(value) => updateRemove({ preserveStructure: value })}
              />
            </div>
          </div>
        );
      case 'replace':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Replace selected objects with AI generation.</SectionDesc>
            <SegmentedControl
              value={wf.visualReplace.mode}
              options={[
                { label: 'Similar', value: 'similar' },
                { label: 'Different', value: 'different' },
                { label: 'Custom', value: 'custom' },
              ]}
              onChange={(value) => updateReplace({ mode: value })}
            />

            {wf.visualReplace.mode === 'similar' && (
              <SliderControl
                label="Variation"
                value={wf.visualReplace.variation}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateReplace({ variation: value })}
              />
            )}

            {wf.visualReplace.mode === 'different' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">Category</label>
                  <select
                    className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                    value={wf.visualReplace.category}
                    onChange={(event) => updateReplace({ category: event.target.value })}
                  >
                    {['Furniture', 'Vehicle', 'Plant', 'Person', 'Object'].map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">Style</label>
                  <select
                    className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                    value={wf.visualReplace.style}
                    onChange={(event) => updateReplace({ style: event.target.value })}
                  >
                    {(replaceStylesByCategory[wf.visualReplace.category] || []).map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {wf.visualReplace.mode === 'custom' && (
              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Custom Prompt</label>
                <textarea
                  value={wf.visualReplace.prompt}
                  onChange={(event) => updateReplace({ prompt: event.target.value })}
                  placeholder="Describe what to replace the selection with..."
                  className="w-full min-h-[90px] resize-none bg-surface-elevated border border-border rounded text-xs p-2 leading-relaxed focus:outline-none focus:border-accent"
                />
              </div>
            )}

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <Toggle
                label="Match Scale"
                checked={wf.visualReplace.matchScale}
                onChange={(value) => updateReplace({ matchScale: value })}
              />
              <Toggle
                label="Match Lighting"
                checked={wf.visualReplace.matchLighting}
                onChange={(value) => updateReplace({ matchLighting: value })}
              />
              <Toggle
                label="Preserve Shadows"
                checked={wf.visualReplace.preserveShadows}
                onChange={(value) => updateReplace({ preserveShadows: value })}
              />
            </div>
          </div>
        );
      case 'adjust':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Global image adjustments and presets.</SectionDesc>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Tone</label>
              <SliderControl
                label="Exposure"
                value={wf.visualAdjust.exposure}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ exposure: value })}
              />
              <SliderControl
                label="Contrast"
                value={wf.visualAdjust.contrast}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ contrast: value })}
              />
              <SliderControl
                label="Highlights"
                value={wf.visualAdjust.highlights}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ highlights: value })}
              />
              <SliderControl
                label="Shadows"
                value={wf.visualAdjust.shadows}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ shadows: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Color</label>
              <SliderControl
                label="Saturation"
                value={wf.visualAdjust.saturation}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ saturation: value })}
              />
              <SliderControl
                label="Vibrance"
                value={wf.visualAdjust.vibrance}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vibrance: value })}
              />
              <SliderControl
                label="Temperature"
                value={wf.visualAdjust.temperature}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ temperature: value })}
              />
              <SliderControl
                label="Tint"
                value={wf.visualAdjust.tint}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ tint: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Detail</label>
              <SliderControl
                label="Sharpness"
                value={wf.visualAdjust.sharpness}
                min={0}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ sharpness: value })}
              />
              <SliderControl
                label="Noise Reduction"
                value={wf.visualAdjust.noiseReduction}
                min={0}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ noiseReduction: value })}
              />
              <SliderControl
                label="Clarity"
                value={wf.visualAdjust.clarity}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ clarity: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Effects</label>
              <SliderControl
                label="Vignette"
                value={wf.visualAdjust.vignette}
                min={0}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vignette: value })}
              />
              <SliderControl
                label="Grain"
                value={wf.visualAdjust.grain}
                min={0}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ grain: value })}
              />
            </div>

            <div className="pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground mb-2 block">Presets</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('reset')}
                >
                  Reset All
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('auto')}
                >
                  Auto-Enhance
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('vivid')}
                >
                  Vivid
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('soft')}
                >
                  Soft
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('dramatic')}
                >
                  Dramatic
                </button>
              </div>
            </div>
          </div>
        );
      case 'extend':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Outpaint to extend the canvas.</SectionDesc>
            <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
              {[
                { key: 'top-left', rotate: 135 },
                { key: 'top', rotate: 90 },
                { key: 'top-right', rotate: 45 },
                { key: 'left', rotate: 180 },
                { key: 'none', label: '1:1' },
                { key: 'right', rotate: 0 },
                { key: 'bottom-left', rotate: 225 },
                { key: 'bottom', rotate: 270 },
                { key: 'bottom-right', rotate: 315 },
              ].map((item) => {
                const active = wf.visualExtend.direction === item.key;
                if (item.label) {
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        'aspect-square border rounded flex items-center justify-center text-[10px] font-bold',
                        active ? 'bg-foreground text-background border-foreground' : 'bg-surface-sunken border-border'
                      )}
                    >
                      {item.label}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.key}
                    className={cn(
                      'aspect-square border rounded flex items-center justify-center transition-colors',
                      active ? 'bg-foreground text-background border-foreground' : 'border-border hover:border-foreground-muted'
                    )}
                    onClick={() => updateExtend({ direction: item.key as any })}
                  >
                    <Move size={14} style={{ transform: `rotate(${item.rotate}deg)` }} />
                  </button>
                );
              })}
            </div>

            <SliderControl
              label="Extension Amount"
              value={wf.visualExtend.amount}
              min={10}
              max={200}
              step={1}
              unit="%"
              onChange={(value) => updateExtend({ amount: value })}
            />
            <Toggle
              label="Maintain Aspect Ratio"
              checked={wf.visualExtend.maintainAspect}
              onChange={(value) => updateExtend({ maintainAspect: value })}
            />

            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Context Guidance</label>
              <select
                className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                value={wf.visualExtend.guidance}
                onChange={(event) => updateExtend({ guidance: event.target.value })}
              >
                <option value="auto">Auto-detect</option>
                <option value="architecture">Continue Architecture</option>
                <option value="landscape">Continue Landscape</option>
                <option value="sky">Continue Sky</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Prompt</label>
              <textarea
                value={wf.visualExtend.prompt}
                onChange={(event) => updateExtend({ prompt: event.target.value })}
                placeholder="Optional guidance for the extension..."
                className="w-full min-h-[80px] resize-none bg-surface-elevated border border-border rounded text-xs p-2 leading-relaxed focus:outline-none focus:border-accent"
              />
            </div>

            <div className="p-2 bg-surface-sunken border border-border rounded text-[10px] text-foreground-muted leading-relaxed">
              AI will generate new content to extend the image. Results may require additional editing.
            </div>
          </div>
        );
      default:
        return (
          <div className="p-8 flex flex-col items-center justify-center text-center h-full">
            <div className="w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center mb-3 text-foreground-muted">
              <Wrench size={24} />
            </div>
            <p className="text-xs text-foreground-muted">Select a tool from the left toolbar to configure its settings.</p>
          </div>
        );
    }
  };

  const toolLabel = useMemo(() => {
    switch (tool) {
      case 'select':
        return 'Select';
      case 'material':
        return 'Material';
      case 'lighting':
        return 'Lighting';
      case 'object':
        return 'Object';
      case 'sky':
        return 'Sky';
      case 'remove':
        return 'Remove';
      case 'replace':
        return 'Replace';
      case 'adjust':
        return 'Adjust';
      case 'extend':
        return 'Extend';
      default:
        return 'Tool';
    }
  }, [tool]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
          <Wrench size={16} className="text-accent" />
          <h3 className="text-sm font-bold text-foreground">{toolLabel} Settings</h3>
        </div>
        {renderToolOptions()}
      </div>

      {isMaterialBrowserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setIsMaterialBrowserOpen(false)}
        >
          <div
            className="w-[560px] max-w-[94vw] h-[360px] bg-background flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-border animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-9 border-b border-border flex items-center justify-between px-4 bg-surface-elevated shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-surface-sunken flex items-center justify-center text-foreground-secondary">
                  <ImageIcon size={14} />
                </div>
                <div className="text-xs font-bold tracking-tight">Material Browser</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground-muted" size={12} />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="h-7 pl-7 pr-2 text-[10px] bg-surface-sunken border-transparent rounded-md focus:bg-surface-elevated focus:border-accent focus:outline-none transition-all w-36"
                    value={materialQuery}
                    onChange={(event) => setMaterialQuery(event.target.value)}
                  />
                </div>
                <button
                  onClick={() => setIsMaterialBrowserOpen(false)}
                  className="p-1.5 hover:bg-surface-sunken rounded-md text-foreground-muted hover:text-foreground transition-colors border border-transparent hover:border-border"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="p-2 flex flex-col gap-2 bg-surface-elevated flex-1 overflow-hidden">
              <div className="flex gap-1.5 overflow-x-auto custom-scrollbar py-0.5 pr-1 flex-nowrap">
                {materialCategories.map((category) => {
                  const active = materialFilterCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setMaterialFilterCategory(category)}
                      className={cn(
                        'px-2 py-1 rounded-full text-[10px] border transition-colors',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                      )}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-5 gap-1.5 overflow-y-auto custom-scrollbar p-1 flex-1">
                {filteredMaterials.map((material) => {
                  const active = wf.visualMaterial.materialId === material.id;
                  return (
                    <button
                      key={material.id}
                      onClick={() => {
                        updateMaterial({ materialId: material.id, category: material.category });
                        setIsMaterialBrowserOpen(false);
                      }}
                      className={cn(
                        'aspect-square rounded border overflow-hidden relative text-[9px] font-semibold transition-colors',
                        active
                          ? 'border-foreground ring-1 ring-foreground'
                          : 'border-border hover:border-foreground-muted'
                      )}
                      style={{ backgroundImage: `url(${fallbackMaterialPreview})` }}
                    >
                      <img
                        src={material.previewUrl}
                        data-alt-src={material.previewAltUrl}
                        loading="lazy"
                        onError={(event) => {
                          const altSrc = event.currentTarget.dataset.altSrc;
                          if (altSrc) {
                            event.currentTarget.src = altSrc;
                            event.currentTarget.removeAttribute('data-alt-src');
                            return;
                          }
                          event.currentTarget.src = fallbackMaterialPreview;
                        }}
                        className="absolute inset-0 w-full h-full object-cover"
                        alt=""
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      {active && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center shadow-md">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 right-1 text-white text-[9px] font-semibold leading-tight truncate">
                        {material.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-7 bg-surface-sunken border-t border-border flex items-center justify-between px-3 text-[9px] text-foreground-muted shrink-0">
              <span>{filteredMaterials.length} materials</span>
              <span>Click a tile to apply.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
