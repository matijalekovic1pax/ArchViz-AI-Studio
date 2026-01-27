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
import { useTranslation } from 'react-i18next';

const planTypes = [
  { id: 'site', labelKey: 'masterplan.planTypes.site', icon: Building2 },
  { id: 'urban', labelKey: 'masterplan.planTypes.urban', icon: Map },
  { id: 'zoning', labelKey: 'masterplan.planTypes.zoning', icon: LayoutGrid },
  { id: 'massing', labelKey: 'masterplan.planTypes.massing', icon: Blocks },
];

const scaleOptions = [
  { value: '1:200', labelKey: 'masterplan.scale.1_200' },
  { value: '1:500', labelKey: 'masterplan.scale.1_500' },
  { value: '1:1000', labelKey: 'masterplan.scale.1_1000' },
  { value: '1:2500', labelKey: 'masterplan.scale.1_2500' },
  { value: '1:5000', labelKey: 'masterplan.scale.1_5000' },
  { value: '1:10000', labelKey: 'masterplan.scale.1_10000' },
  { value: 'custom', labelKey: 'masterplan.scale.custom' },
];

const zoneTypeOptions = [
  { type: 'residential-low', labelKey: 'masterplan.zoneTypes.residentialLow', color: '#8BC34A' },
  { type: 'residential-medium', labelKey: 'masterplan.zoneTypes.residentialMedium', color: '#4CAF50' },
  { type: 'residential-high', labelKey: 'masterplan.zoneTypes.residentialHigh', color: '#2E7D32' },
  { type: 'commercial', labelKey: 'masterplan.zoneTypes.commercial', color: '#2196F3' },
  { type: 'retail', labelKey: 'masterplan.zoneTypes.retail', color: '#03A9F4' },
  { type: 'office', labelKey: 'masterplan.zoneTypes.office', color: '#3F51B5' },
  { type: 'industrial', labelKey: 'masterplan.zoneTypes.industrial', color: '#795548' },
  { type: 'mixed', labelKey: 'masterplan.zoneTypes.mixed', color: '#9C27B0' },
  { type: 'green', labelKey: 'masterplan.zoneTypes.green', color: '#66BB6A' },
  { type: 'water', labelKey: 'masterplan.zoneTypes.water', color: '#00BCD4' },
  { type: 'infra', labelKey: 'masterplan.zoneTypes.infra', color: '#607D8B' },
  { type: 'institutional', labelKey: 'masterplan.zoneTypes.institutional', color: '#FF9800' },
  { type: 'civic', labelKey: 'masterplan.zoneTypes.civic', color: '#F44336' },
  { type: 'parking', labelKey: 'masterplan.zoneTypes.parking', color: '#424242' },
  { type: 'future', labelKey: 'masterplan.zoneTypes.future', color: '#FFEB3B' },
];

export const LeftMasterplanPanel = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
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
    const sourceImage = wf.mpInputImage || state.sourceImage || state.uploadedImage;
    if (!sourceImage) {
      setZoneDetectError(t('masterplan.zones.errors.uploadFirst'));
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
          name: zone.name || t('masterplan.zones.defaultName', { index: index + 1 }),
          type: zone.type || fallbackType.type,
          color: zone.color || fallbackType.color,
          selected: zone.selected ?? true,
          areaHa: typeof zone.areaHa === 'number' ? zone.areaHa : undefined,
        };
      });
      if (normalized.length > 0) {
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: normalized } });
      } else {
        setZoneDetectError(t('masterplan.zones.errors.noneDetected'));
      }
    } catch (err) {
      setZoneDetectError(t('masterplan.zones.errors.failed'));
    } finally {
      setIsDetectingZones(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title={t('masterplan.planType.title')} />
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
                  <span className="font-medium">{t(type.labelKey)}</span>
                </button>
              );
          })}
        </div>
      </div>

      <div>
        <SectionHeader title={t('masterplan.scaleOrientation.title')} />
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-foreground-muted mb-1 block">{t('masterplan.scaleOrientation.scale')}</label>
            <select
              value={wf.mpScale}
              onChange={(e) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpScale: e.target.value as any } })}
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
            >
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {wf.mpScale === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted">{t('masterplan.scaleOrientation.customScale')}</span>
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
                  <div className="text-[10px] text-foreground-muted uppercase tracking-wide">{t('masterplan.scaleOrientation.northRotation')}</div>
                  <div className="text-[11px] font-mono text-foreground">{Math.round(wf.mpNorthRotation)} deg</div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-foreground-muted">{t('masterplan.scaleOrientation.north')}</span>
            </div>
            <div className="mt-2">
              <Slider
                value={wf.mpNorthRotation}
                min={0}
                max={359}
                step={1}
                onChange={(value) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpNorthRotation: value } })}
                label={t('masterplan.scaleOrientation.northRotation')}
                showLabel={false}
                showValue={false}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title={t('masterplan.zones.title')} />
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
            {isDetectingZones ? t('masterplan.zones.detecting') : t('masterplan.zones.autoDetect')}
          </button>
          {zoneDetectError && (
            <div className="text-[10px] text-red-600 font-medium">
              {zoneDetectError}
            </div>
          )}
          <div className="space-y-2">
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
                        {t('common.delete')}
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
                  placeholder={t('masterplan.zones.newZonePlaceholder')}
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
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleAddZone} className="flex-1 py-1 bg-foreground text-background text-[10px] rounded">
                  {t('masterplan.zones.add')}
                </button>
                <button onClick={() => setIsAdding(false)} className="flex-1 py-1 bg-surface-sunken text-foreground-secondary text-[10px] rounded">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="flex-1 py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors"
              >
                {t('masterplan.zones.addCta')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title={t('masterplan.boundary.title')} />
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
            {wf.mpBoundary.mode === 'custom'
              ? t('masterplan.boundary.lassoOn')
              : t('masterplan.boundary.lassoOff')}
          </button>
          {wf.mpBoundary.mode === 'custom' && (
            <div className="text-[10px] text-emerald-600 font-semibold">
              {t('masterplan.boundary.instructions')}
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title={t('masterplan.context.title')} />
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
                  title={t('masterplan.context.clear')}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsLocationModalOpen(true)}
                  className="flex-1 py-1.5 text-[10px] font-medium border border-border rounded hover:bg-surface-elevated transition-colors"
                >
                  {t('common.edit')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-surface-elevated border border-border rounded text-xs font-medium hover:border-foreground transition-colors"
            >
              <MapPin size={14} /> {t('masterplan.context.load')}
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
