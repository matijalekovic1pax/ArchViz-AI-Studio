import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Toggle } from '../../ui/Toggle';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { Building2, Blocks, Map, LayoutGrid, MapPin, Compass, MoreHorizontal, X } from 'lucide-react';
import { ZoneItem } from '../../../types';
import { nanoid } from 'nanoid';
import { LocationPickerModal } from '../../modals/LocationPickerModal';

const planTypes = [
  { id: 'site', label: 'Site Plan', icon: Building2 },
  { id: 'urban', label: 'Urban', icon: Map },
  { id: 'zoning', label: 'Zoning', icon: LayoutGrid },
  { id: 'massing', label: 'Massing', icon: Blocks },
];

const scaleOptions = [
  { value: '1:200', label: '1:200 (Architectural Detail)' },
  { value: '1:500', label: '1:500 (Site Detail)' },
  { value: '1:1000', label: '1:1000 (Standard Site)' },
  { value: '1:2500', label: '1:2500 (District)' },
  { value: '1:5000', label: '1:5000 (City)' },
  { value: '1:10000', label: '1:10000 (Metropolitan)' },
  { value: 'custom', label: 'Custom...' },
];

const zoneTypeOptions = [
  { type: 'residential-low', label: 'Residential - Low Density', color: '#8BC34A' },
  { type: 'residential-medium', label: 'Residential - Medium', color: '#4CAF50' },
  { type: 'residential-high', label: 'Residential - High Density', color: '#2E7D32' },
  { type: 'commercial', label: 'Commercial', color: '#2196F3' },
  { type: 'retail', label: 'Retail', color: '#03A9F4' },
  { type: 'office', label: 'Office', color: '#3F51B5' },
  { type: 'industrial', label: 'Industrial', color: '#795548' },
  { type: 'mixed', label: 'Mixed Use', color: '#9C27B0' },
  { type: 'green', label: 'Green Space / Park', color: '#66BB6A' },
  { type: 'water', label: 'Water', color: '#00BCD4' },
  { type: 'infra', label: 'Infrastructure / Roads', color: '#607D8B' },
  { type: 'institutional', label: 'Institutional', color: '#FF9800' },
  { type: 'civic', label: 'Civic / Public', color: '#F44336' },
  { type: 'parking', label: 'Parking', color: '#424242' },
  { type: 'future', label: 'Reserved / Future', color: '#FFEB3B' },
];

export const LeftMasterplanPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const [isAdding, setIsAdding] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneType, setNewZoneType] = useState(zoneTypeOptions[0].type);
  const [newZoneColor, setNewZoneColor] = useState(zoneTypeOptions[0].color);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDetectingZones, setIsDetectingZones] = useState(false);
  const [zoneDetectError, setZoneDetectError] = useState<string | null>(null);
  const [openZoneMenuId, setOpenZoneMenuId] = useState<string | null>(null);
  const hasSetBoundaryDefaultRef = useRef(false);

  useEffect(() => {
    if (hasSetBoundaryDefaultRef.current) return;
    hasSetBoundaryDefaultRef.current = true;
    if (wf.mpBoundary.mode !== 'auto') {
      dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpBoundary: { ...wf.mpBoundary, mode: 'auto' } } });
    }
  }, [dispatch, wf.mpBoundary]);

  const totalArea = useMemo(() => {
    const sum = wf.mpZones.reduce((acc, zone) => acc + (zone.areaHa || 0), 0);
    return sum > 0 ? sum : 0;
  }, [wf.mpZones]);

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    const newZone: ZoneItem = {
      id: nanoid(),
      name: newZoneName.trim(),
      color: newZoneColor,
      type: newZoneType,
      selected: true,
    };
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: [...wf.mpZones, newZone] } });
    setIsAdding(false);
    setNewZoneName('');
  };

  const toggleZone = (id: string) => {
    const newZones = wf.mpZones.map((z) => (z.id === id ? { ...z, selected: !z.selected } : z));
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: newZones } });
  };

  const deleteZone = (id: string) => {
    const newZones = wf.mpZones.filter((z) => z.id !== id);
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: newZones } });
    if (openZoneMenuId === id) {
      setOpenZoneMenuId(null);
    }
  };

  const handleZoneTypeChange = (value: string) => {
    const next = zoneTypeOptions.find((opt) => opt.type === value);
    if (next) {
      setNewZoneType(next.type);
      setNewZoneColor(next.color);
    }
  };

  const handleAutoDetectZones = async () => {
    if (isDetectingZones) return;
    const sourceImage = wf.mpInputImage || state.uploadedImage;
    if (!sourceImage) {
      setZoneDetectError('Upload an image first to auto-detect zones.');
      return;
    }
    setZoneDetectError(null);
    setIsDetectingZones(true);
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZoneDetection: 'auto' } });
    try {
      const response = await fetch('/api/masterplan/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: sourceImage }),
      });
      if (!response.ok) {
        throw new Error('Zone detection failed.');
      }
      const payload = await response.json();
      const zones = Array.isArray(payload?.zones) ? (payload.zones as Partial<ZoneItem>[]) : [];
      const normalized = zones.map((zone, index) => {
        const fallbackType = zoneTypeOptions[index % zoneTypeOptions.length];
        return {
          id: zone.id || nanoid(),
          name: zone.name || `Zone ${index + 1}`,
          type: zone.type || fallbackType.type,
          color: zone.color || fallbackType.color,
          selected: zone.selected ?? true,
          areaHa: typeof zone.areaHa === 'number' ? zone.areaHa : undefined,
        };
      });
      if (normalized.length > 0) {
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: normalized } });
      } else {
        setZoneDetectError('No zones detected. Try again or refine the image.');
      }
    } catch (err) {
      setZoneDetectError('Auto-detect failed. Please try again.');
    } finally {
      setIsDetectingZones(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Plan Type" />
        <div className="grid grid-cols-2 gap-2">
          {planTypes.map((type) => {
            const Icon = type.icon;
            const selected = wf.mpPlanType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpPlanType: type.id } })}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border text-xs transition-all',
                  selected
                    ? 'bg-foreground text-background border-foreground shadow-sm'
                    : 'bg-surface-elevated border-border hover:bg-surface-sunken'
                )}
              >
                <Icon size={20} />
                <span className="font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionHeader title="Scale & Orientation" />
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-foreground-muted mb-1 block">Scale</label>
            <select
              value={wf.mpScale}
              onChange={(e) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpScale: e.target.value as any } })}
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
            >
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {wf.mpScale === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted">Custom Scale: 1:</span>
              <input
                type="number"
                min={100}
                max={50000}
                value={wf.mpCustomScale}
                onChange={(e) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpCustomScale: Number(e.target.value) } })}
                className="flex-1 h-8 bg-surface-elevated border border-border rounded text-xs px-2"
              />
            </div>
          )}
          <div className="rounded-lg border border-border bg-surface-elevated p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full border border-border bg-surface-sunken flex items-center justify-center">
                  <Compass size={16} className="text-foreground-muted" />
                </div>
                <div>
                  <div className="text-[10px] text-foreground-muted uppercase tracking-wide">North Rotation</div>
                  <div className="text-[11px] font-mono text-foreground">{Math.round(wf.mpNorthRotation)} deg</div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-foreground-muted">N</span>
            </div>
            <div className="mt-2">
              <Slider
                value={wf.mpNorthRotation}
                min={0}
                max={359}
                step={1}
                onChange={(value) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpNorthRotation: value } })}
                label="North Rotation"
                showLabel={false}
                showValue={false}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Zone Definition" />
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleAutoDetectZones}
            disabled={isDetectingZones}
            className={cn(
              "w-full py-2 text-xs font-semibold rounded border transition-colors",
              isDetectingZones
                ? "bg-surface-sunken text-foreground-muted border-border"
                : "bg-foreground text-background border-foreground hover:opacity-90"
            )}
          >
            {isDetectingZones ? 'Detecting Zones...' : 'Auto Detect Zones'}
          </button>
          {zoneDetectError && (
            <div className="text-[10px] text-red-600 font-medium">
              {zoneDetectError}
            </div>
          )}
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            {wf.mpZones.map((zone) => (
              <div key={zone.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded">
                <div className="w-4 h-4 rounded shadow-sm border border-black/10" style={{ backgroundColor: zone.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{zone.name}</div>
                  {zone.areaHa !== undefined && (
                    <div className="text-[10px] text-foreground-muted">{zone.areaHa.toFixed(1)} ha</div>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenZoneMenuId((prev) => (prev === zone.id ? null : zone.id))}
                    className="p-1 rounded-full text-foreground-muted hover:text-foreground"
                    title="Zone actions"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {openZoneMenuId === zone.id && (
                    <div className="absolute right-0 top-full mt-1 w-28 bg-surface-elevated border border-border rounded shadow-elevated text-xs z-10">
                      <button
                        type="button"
                        onClick={() => deleteZone(zone.id)}
                        className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <Toggle label="" checked={zone.selected} onChange={() => toggleZone(zone.id)} />
              </div>
            ))}
          </div>

          {isAdding ? (
            <div className="p-2 bg-surface-elevated border border-border rounded animate-fade-in space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newZoneColor}
                  onChange={(e) => setNewZoneColor(e.target.value)}
                  className="w-6 h-6 p-0 border-0 cursor-pointer rounded"
                />
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="New zone name"
                  className="flex-1 text-xs bg-surface-sunken border border-border rounded px-2 h-7"
                />
              </div>
              <select
                value={newZoneType}
                onChange={(e) => handleZoneTypeChange(e.target.value)}
                className="w-full h-7 bg-surface-sunken border border-border rounded text-xs px-2"
              >
                {zoneTypeOptions.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleAddZone} className="flex-1 py-1 bg-foreground text-background text-[10px] rounded">
                  Add Zone
                </button>
                <button onClick={() => setIsAdding(false)} className="flex-1 py-1 bg-surface-sunken text-foreground-secondary text-[10px] rounded">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="flex-1 py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors"
              >
                + Add Zone
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="Site Boundary" />
        <div className="space-y-3 bg-surface-sunken p-3 rounded-lg border border-border-subtle">
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'UPDATE_WORKFLOW',
                payload: { mpBoundary: { ...wf.mpBoundary, mode: wf.mpBoundary.mode === 'custom' ? 'auto' : 'custom' } },
              })
            }
            className={cn(
              "w-full py-2 text-xs font-semibold rounded border transition-colors",
              wf.mpBoundary.mode === 'custom'
                ? "bg-emerald-600/15 text-emerald-700 border-emerald-500/40"
                : "bg-surface-elevated text-foreground-secondary border-border hover:bg-surface-sunken"
            )}
          >
            {wf.mpBoundary.mode === 'custom' ? 'Lasso On (Click to Disable)' : 'Lasso Boundary'}
          </button>
          {wf.mpBoundary.mode === 'custom' && (
            <div className="text-[10px] text-emerald-600 font-semibold">
              Draw a green lasso directly on the canvas to set the site boundary.
            </div>
          )}
          <div className="text-[10px] text-foreground-muted space-y-1">
            <div>Total Area: {totalArea ? `${totalArea.toFixed(1)} ha` : '--'}</div>
            <div>Perimeter: {totalArea ? `${(totalArea * 230).toFixed(0)} m` : '--'}</div>
            <div>Buildable Area: {totalArea ? `${(totalArea * 0.66).toFixed(1)} ha` : '--'}</div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Context" />
        <div className="bg-surface-sunken p-3 rounded-lg space-y-3 border border-border-subtle">
          {wf.mpContext.loadedData ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={14} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{wf.mpContext.location}</div>
                    <div className="text-[10px] text-foreground-muted">
                      {wf.mpContext.loadedData.buildings} buildings · {wf.mpContext.loadedData.roads} roads · {wf.mpContext.radius}m
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, location: '', coordinates: null, loadedData: null } } })}
                  className="p-1 rounded hover:bg-surface-elevated text-foreground-muted hover:text-foreground transition-colors shrink-0"
                  title="Clear context"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsLocationModalOpen(true)}
                  className="flex-1 py-1.5 text-[10px] font-medium border border-border rounded hover:bg-surface-elevated transition-colors"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-surface-elevated border border-border rounded text-xs font-medium hover:border-foreground transition-colors"
            >
              <MapPin size={14} /> Load from Location
            </button>
          )}
          
        </div>
      </div>

      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        initialData={wf.mpContext}
        onLoad={(data) => {
          dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: data } });
        }}
      />
    </div>
  );
};
