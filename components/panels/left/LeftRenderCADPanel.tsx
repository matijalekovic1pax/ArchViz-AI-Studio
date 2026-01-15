
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../../store';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SectionHeader } from './SharedLeftComponents';
import { Toggle } from '../../ui/Toggle';
import { StyleGrid } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { LayoutIcon, ScissorsIcon, BuildingIcon, MapIcon } from 'lucide-react';

export const LeftRenderCADPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    const updateWf = (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload });
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [spaceSettings, setSpaceSettings] = useState({
      roomTypes: ['Lobby'],
      ceilingStyle: 'flat',
      windowStyle: 'slim',
      doorStyle: 'panel',
    });
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

    const roomTypeOptions = [
      'Lobby',
      'Gate',
      'Retail',
      'Restroom',
      'Office',
      'Circulation',
      'Back-of-house',
      'Storage',
    ];

    const toggleLayer = (id: string) => {
      const newLayers = wf.cadLayers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
      updateWf({ cadLayers: newLayers });
    };

    const toggleRoomType = (label: string) => {
      setSpaceSettings((prev) => {
        const exists = prev.roomTypes.includes(label);
        const next = exists
          ? prev.roomTypes.filter((item) => item !== label)
          : [...prev.roomTypes, label];
        return { ...prev, roomTypes: next };
      });
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

        <div>
          <SectionHeader title="Space Interpretation" />
          <div className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Room Type Labels</label>
              <div className="grid grid-cols-2 gap-2">
                {roomTypeOptions.map((room) => {
                  const active = spaceSettings.roomTypes.includes(room);
                  return (
                    <button
                      key={room}
                      className={cn(
                        "px-2 py-1 rounded border text-[10px] font-medium transition-colors",
                        active
                          ? "bg-surface-sunken text-foreground border-foreground/40"
                          : "border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted"
                      )}
                      onClick={() => toggleRoomType(room)}
                    >
                      {room}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Ceiling Style</label>
              <select
                className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                value={spaceSettings.ceilingStyle}
                onChange={(e) => setSpaceSettings((prev) => ({ ...prev, ceilingStyle: e.target.value }))}
              >
                <option value="flat">Flat</option>
                <option value="coffered">Coffered</option>
                <option value="beams">Beams</option>
                <option value="vaulted">Vaulted</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Window Style Preset</label>
              <select
                className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                value={spaceSettings.windowStyle}
                onChange={(e) => setSpaceSettings((prev) => ({ ...prev, windowStyle: e.target.value }))}
              >
                <option value="slim">Slim Frame</option>
                <option value="heavy">Heavy Frame</option>
                <option value="curtain">Curtain Wall</option>
                <option value="frosted">Frosted</option>
                <option value="tinted">Tinted</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Door Style Preset</label>
              <select
                className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                value={spaceSettings.doorStyle}
                onChange={(e) => setSpaceSettings((prev) => ({ ...prev, doorStyle: e.target.value }))}
              >
                <option value="panel">Panel</option>
                <option value="glass">Glass</option>
                <option value="flush">Flush</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
          </div>
        </div>
  
        <div>
          <SectionHeader title="Layer Detection" />
          <div className="space-y-1">
             {wf.cadLayers.map(layer => (
               <div key={layer.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded hover:border-foreground-muted transition-colors">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: layer.color }} />
                  <span className="text-xs flex-1 font-medium">{layer.name}</span>
                  <Toggle label="" checked={layer.visible} onChange={() => toggleLayer(layer.id)} />
               </div>
             ))}
          </div>
        </div>
      </div>
    );
};
