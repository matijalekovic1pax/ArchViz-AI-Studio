import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Toggle } from '../../ui/Toggle';
import { cn } from '../../../lib/utils';
import { Building2, Blocks, Map, LayoutGrid, MapPin, Compass, MoreHorizontal } from 'lucide-react';
import { ZoneItem } from '../../../types';
import { nanoid } from 'nanoid';

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

  const handleZoneTypeChange = (value: string) => {
    const next = zoneTypeOptions.find((opt) => opt.type === value);
    if (next) {
      setNewZoneType(next.type);
      setNewZoneColor(next.color);
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border border-border bg-surface-elevated flex items-center justify-center">
                <Compass size={18} className="text-foreground-muted" />
              </div>
              <div>
                <div className="text-[10px] text-foreground-muted uppercase tracking-wide">North Rotation</div>
                <div className="text-xs font-semibold">{Math.round(wf.mpNorthRotation)}°</div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              value={wf.mpNorthRotation}
              onChange={(e) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpNorthRotation: Number(e.target.value) } })}
              className="flex-1 accent-foreground"
            />
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Zone Definition" />
        <div className="space-y-3">
          <SegmentedControl
            value={wf.mpZoneDetection}
            onChange={(value) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZoneDetection: value as any } })}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Manual', value: 'manual' },
              { label: 'Import', value: 'import' },
            ]}
          />
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
                <button className="p-1 rounded-full text-foreground-muted hover:text-foreground">
                  <MoreHorizontal size={14} />
                </button>
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
              <button className="px-3 py-2 border border-border text-xs rounded hover:bg-surface-elevated">
                Import Legend
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="Site Boundary" />
        <div className="space-y-3 bg-surface-sunken p-3 rounded-lg border border-border-subtle">
          <SegmentedControl
            value={wf.mpBoundary.mode}
            onChange={(value) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpBoundary: { ...wf.mpBoundary, mode: value as any } } })}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Custom', value: 'custom' },
              { label: 'Full', value: 'full' },
            ]}
          />
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
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-surface-elevated border border-border rounded text-xs font-medium hover:border-foreground transition-colors">
            <MapPin size={14} /> Load from Location
          </button>
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <Toggle
              label="Surrounding Buildings"
              checked={wf.mpContext.loadBuildings}
              onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadBuildings: v } } })}
            />
            <Toggle
              label="Road Network"
              checked={wf.mpContext.loadRoads}
              onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadRoads: v } } })}
            />
            <Toggle
              label="Water Bodies"
              checked={wf.mpContext.loadWater}
              onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadWater: v } } })}
            />
            <Toggle
              label="Terrain / Topography"
              checked={wf.mpContext.loadTerrain}
              onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadTerrain: v } } })}
            />
            <Toggle
              label="Transit Lines"
              checked={wf.mpContext.loadTransit}
              onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadTransit: v } } })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
