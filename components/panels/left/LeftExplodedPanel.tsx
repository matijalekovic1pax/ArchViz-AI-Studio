import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { nanoid } from 'nanoid';
import { ChevronDown } from 'lucide-react';

const sourceTypes = [
  { value: 'revit', label: 'Revit (PDF Export)' },
  { value: 'rhino', label: 'Rhino (PDF Export)' },
  { value: 'sketchup', label: 'SketchUp (PDF Export)' },
  { value: 'archicad', label: 'ArchiCAD (PDF Export)' },
  { value: 'ifc', label: 'IFC (PDF Export)' },
  { value: 'other', label: 'Other PDF' },
];

export const LeftExplodedPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keepAssemblies, setKeepAssemblies] = useState(false);
  const [maintainFloors, setMaintainFloors] = useState(false);
  const [isDetectingComponents, setIsDetectingComponents] = useState(false);
  const [componentsDetectError, setComponentsDetectError] = useState<string | null>(null);
  const [openComponentId, setOpenComponentId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const componentListRef = useRef<HTMLDivElement>(null);
  const componentRefs = useRef(new Map<string, HTMLDivElement | null>());
  const dragStartYRef = useRef(0);
  const dragIndexRef = useRef(0);
  const dragOverIndexRef = useRef(0);
  const dragRafRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const dragItemHeightRef = useRef(0);
  const positionsRef = useRef<Array<{ id: string; top: number; height: number; center: number }>>([]);

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch, wf]
  );

  const sortedComponents = useMemo(
    () => [...wf.explodedComponents].sort((a, b) => a.order - b.order),
    [wf.explodedComponents]
  );

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateWf({
      explodedSource: {
        ...wf.explodedSource,
        fileName: file.name,
        componentCount: wf.explodedComponents.length,
      },
    });
  };

  const normalizeCategory = (value: unknown): 'structure' | 'envelope' | 'interior' | 'mep' | 'site' => {
    switch (value) {
      case 'structure':
      case 'envelope':
      case 'interior':
      case 'mep':
      case 'site':
        return value;
      default:
        return 'structure';
    }
  };

  const normalizeAttributes = (value: unknown) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  };

  const handleAutoDetectComponents = async () => {
    if (isDetectingComponents) return;
    const sourceImage = state.uploadedImage;
    if (!sourceImage) {
      setComponentsDetectError('Upload an image first to auto-detect components.');
      return;
    }

    setComponentsDetectError(null);
    setIsDetectingComponents(true);
    updateWf({ explodedDetection: 'auto' });

    try {
      const response = await fetch('/api/exploded/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: sourceImage }),
      });
      if (!response.ok) {
        throw new Error('Auto-detect failed');
      }
      const data = await response.json();
      const rawComponents = Array.isArray(data?.components) ? data.components : [];
      if (rawComponents.length === 0) {
        setComponentsDetectError('No components detected. Try a different image.');
        return;
      }

      const nextComponents = rawComponents.map((item: any, index: number) => {
        const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : `Component ${index + 1}`;
        return {
          id: nanoid(),
          name,
          title: typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : name,
          description: typeof item?.description === 'string' ? item.description : '',
          attributes: normalizeAttributes(item?.attributes),
          order: index,
          active: item?.active === false ? false : true,
          category: normalizeCategory(item?.category),
          color: typeof item?.color === 'string' ? item.color : undefined,
        };
      });

      updateWf({
        explodedComponents: nextComponents,
        explodedSource: { ...wf.explodedSource, componentCount: nextComponents.length },
      });
    } catch (error) {
      setComponentsDetectError('Auto-detect failed. Please try again.');
    } finally {
      setIsDetectingComponents(false);
    }
  };

  const handleClear = () => {
    updateWf({
      explodedSource: {
        ...wf.explodedSource,
        fileName: null,
        componentCount: 0,
      },
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleComponent = (id: string, active: boolean) => {
    const next = wf.explodedComponents.map((comp) =>
      comp.id === id ? { ...comp, active } : comp
    );
    updateWf({ explodedComponents: next });
  };

  const updateComponent = (id: string, updates: Partial<typeof wf.explodedComponents[number]>) => {
    const next = wf.explodedComponents.map((comp) =>
      comp.id === id ? { ...comp, ...updates } : comp
    );
    updateWf({ explodedComponents: next });
  };

  const handleAddComponent = () => {
    const nextOrder = wf.explodedComponents.length;
    const name = `Component ${nextOrder + 1}`;
    const next = {
      id: nanoid(),
      name,
      title: name,
      description: '',
      attributes: [],
      order: nextOrder,
      active: true,
      category: 'structure' as const,
    };
    updateWf({ explodedComponents: [...wf.explodedComponents, next] });
  };

  const dragIndex = draggingId
    ? sortedComponents.findIndex((comp) => comp.id === draggingId)
    : -1;
  const effectiveOverIndex = dragOverIndex ?? dragIndex;
  const dragItemHeight = dragItemHeightRef.current;

  const setComponentRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      componentRefs.current.set(id, node);
    } else {
      componentRefs.current.delete(id);
    }
  }, []);

  const beginDrag = useCallback((id: string, clientY: number) => {
    if (!componentListRef.current) return;
    const containerTop = componentListRef.current.getBoundingClientRect().top;
    const positions = sortedComponents.map((comp) => {
      const node = componentRefs.current.get(comp.id);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const top = rect.top - containerTop;
      return { id: comp.id, top, height: rect.height, center: top + rect.height / 2 };
    });
    if (positions.some((item) => !item)) return;
    const resolved = positions as Array<{ id: string; top: number; height: number; center: number }>;
    const dragIndex = resolved.findIndex((item) => item.id === id);
    if (dragIndex === -1) return;

    positionsRef.current = resolved;
    dragIndexRef.current = dragIndex;
    dragOverIndexRef.current = dragIndex;
    const nextGap = dragIndex < resolved.length - 1
      ? resolved[dragIndex + 1].top - resolved[dragIndex].top
      : null;
    const prevGap = dragIndex > 0
      ? resolved[dragIndex].top - resolved[dragIndex - 1].top
      : null;
    const effectiveGap = (nextGap !== null && nextGap > 0)
      ? nextGap
      : (prevGap !== null && prevGap > 0 ? prevGap : resolved[dragIndex].height);
    dragItemHeightRef.current = effectiveGap;
    dragStartYRef.current = clientY;
    dragOffsetRef.current = 0;

    setDragOffset(0);
    setDragOverIndex(dragIndex);
    setDraggingId(id);
  }, [sortedComponents]);

  const handlePointerDown = useCallback((id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0 || draggingId) return;
    e.preventDefault();
    beginDrag(id, e.clientY);
  }, [beginDrag, draggingId]);

  const finishDrag = useCallback(() => {
    if (!draggingId) return;
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }

    const from = dragIndexRef.current;
    const to = dragOverIndexRef.current;
    if (from === to) {
      setDraggingId(null);
      setDragOffset(0);
      setDragOverIndex(null);
      dragOffsetRef.current = 0;
      return;
    }

    // Disable transitions during reorder to prevent jump glitch
    setIsSettling(true);

    const next = [...sortedComponents];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((comp, index) => ({ ...comp, order: index }));
    updateWf({ explodedComponents: reordered });

    setDragOffset(0);
    setDraggingId(null);
    setDragOverIndex(null);
    dragOffsetRef.current = 0;

    // Re-enable transitions after layout settles
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsSettling(false);
      });
    });
  }, [draggingId, sortedComponents, updateWf]);

  useEffect(() => {
    if (!draggingId) return undefined;

    const handleMove = (event: PointerEvent) => {
      dragOffsetRef.current = event.clientY - dragStartYRef.current;
      if (dragRafRef.current !== null) return;
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const offset = dragOffsetRef.current;
        setDragOffset(offset);

        const positions = positionsRef.current;
        if (positions.length === 0) return;
        const dragIndex = dragIndexRef.current;
        const draggedCenter = positions[dragIndex].center + offset;
        let nextIndex = dragIndex;
        if (offset > 0) {
          while (
            nextIndex < positions.length - 1 &&
            draggedCenter > positions[nextIndex + 1].center
          ) {
            nextIndex += 1;
          }
        } else if (offset < 0) {
          while (nextIndex > 0 && draggedCenter < positions[nextIndex - 1].center) {
            nextIndex -= 1;
          }
        }

        if (nextIndex !== dragOverIndexRef.current) {
          dragOverIndexRef.current = nextIndex;
          setDragOverIndex(nextIndex);
        }
      });
    };

    const handleUp = () => finishDrag();

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.userSelect = '';
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, [draggingId, finishDrag]);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Source Model" />
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleUploadClick}
            className="w-full py-2 bg-surface-elevated border border-dashed border-border rounded text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            Upload PDF
            <div className="text-[10px] text-foreground-muted mt-1">Model export + metadata (PDF)</div>
          </button>

          <div>
            <label className="text-[10px] text-foreground-muted mb-1 block">Source Type</label>
            <select
              value={wf.explodedSource.type}
              onChange={(e) =>
                updateWf({
                  explodedSource: {
                    ...wf.explodedSource,
                    type: e.target.value as typeof wf.explodedSource.type,
                  },
                })
              }
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
            >
              {sourceTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {wf.explodedSource.fileName && (
            <div className="border border-border rounded bg-surface-sunken p-3 text-xs">
              <div className="font-semibold">{wf.explodedSource.fileName}</div>
              <div className="text-[10px] text-foreground-muted">
                {wf.explodedSource.componentCount || wf.explodedComponents.length} components detected
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleAutoDetectComponents}
                  className="flex-1 py-1.5 text-[10px] font-medium border border-border rounded hover:bg-surface-elevated"
                >
                  Re-detect
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 py-1.5 text-[10px] font-medium border border-border rounded hover:bg-surface-elevated"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="Components" />
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleAutoDetectComponents}
            disabled={isDetectingComponents}
            className={cn(
              "w-full py-2 text-xs font-semibold rounded border transition-colors",
              isDetectingComponents
                ? "bg-surface-sunken text-foreground-muted border-border"
                : "bg-foreground text-background border-foreground hover:opacity-90"
            )}
          >
            {isDetectingComponents ? 'Detecting Components...' : 'Auto Detect Components'}
          </button>
          {componentsDetectError && (
            <div className="text-[10px] text-red-600 font-medium">
              {componentsDetectError}
            </div>
          )}

          <div ref={componentListRef} className="space-y-2">
            {sortedComponents.map((comp, index) => {
              const attributesValue = (comp.attributes || []).join(', ');
              const isOpen = openComponentId === comp.id;
              const isDragging = draggingId === comp.id;
              let translateY = 0;
              if (draggingId && dragIndex !== -1 && effectiveOverIndex !== -1 && !isDragging) {
                if (dragIndex < effectiveOverIndex && index > dragIndex && index <= effectiveOverIndex) {
                  translateY = -dragItemHeight;
                } else if (dragIndex > effectiveOverIndex && index >= effectiveOverIndex && index < dragIndex) {
                  translateY = dragItemHeight;
                }
              }
              return (
                <div
                  key={comp.id}
                  ref={setComponentRef(comp.id)}
                  className={cn("space-y-2 relative transform-gpu", isDragging && "z-10")}
                  style={{
                    transform: isDragging
                      ? `translate3d(0, ${dragOffset}px, 0)`
                      : translateY
                        ? `translate3d(0, ${translateY}px, 0)`
                        : undefined,
                    transition: isDragging || isSettling ? 'none' : 'transform 160ms ease',
                  }}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded",
                      isDragging && "shadow-lg border-foreground/40"
                    )}
                  >
                    <div
                      className="flex flex-col gap-0.5 text-foreground-muted cursor-grab active:cursor-grabbing touch-none"
                      onPointerDown={handlePointerDown(comp.id)}
                      title="Drag to reorder"
                    >
                      <div className="w-3 h-0.5 bg-current rounded-full" />
                      <div className="w-3 h-0.5 bg-current rounded-full" />
                      <div className="w-3 h-0.5 bg-current rounded-full" />
                    </div>
                    <span className="text-xs font-medium flex-1">{index + 1}. {comp.name}</span>
                    <Toggle label="" checked={comp.active} onChange={(val) => toggleComponent(comp.id, val)} />
                    <button
                      type="button"
                      onClick={() => setOpenComponentId(isOpen ? null : comp.id)}
                      className="p-1 rounded hover:bg-surface-sunken text-foreground-muted"
                      title="Edit component"
                    >
                      <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="ml-6 mr-2 space-y-2">
                      <div>
                        <label className="text-[10px] text-foreground-muted mb-1 block">Title</label>
                        <input
                          type="text"
                          value={comp.title || comp.name}
                          onChange={(e) => updateComponent(comp.id, { title: e.target.value })}
                          className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                          placeholder="Display title"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-foreground-muted mb-1 block">Description</label>
                        <textarea
                          value={comp.description || ''}
                          onChange={(e) => updateComponent(comp.id, { description: e.target.value })}
                          className="w-full bg-surface-elevated border border-border rounded text-xs px-2 py-1.5 min-h-[56px] resize-none"
                          placeholder="Optional description"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-foreground-muted mb-1 block">Attributes (comma-separated)</label>
                        <input
                          type="text"
                          value={attributesValue}
                          onChange={(e) => updateComponent(comp.id, { attributes: normalizeAttributes(e.target.value) })}
                          className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                          placeholder="e.g. load-bearing, concrete, public"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddComponent}
            className="w-full py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors"
          >
            + Add Component
          </button>
        </div>
      </div>

      <div>
        <SectionHeader title="Explosion" />
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-foreground-muted mb-1 block">Direction</label>
            <SegmentedControl
              value={wf.explodedDirection}
              options={[
                { label: 'Vertical', value: 'vertical' },
                { label: 'Radial', value: 'radial' },
                { label: 'Custom', value: 'custom' },
              ]}
              onChange={(value) => updateWf({ explodedDirection: value as any })}
            />
          </div>

          {wf.explodedDirection === 'custom' && (
            <div className="space-y-2">
              <Slider
                label="Axis X"
                value={wf.explodedAxis.x}
                min={0}
                max={100}
                onChange={(value) => updateWf({ explodedAxis: { ...wf.explodedAxis, x: value } })}
              />
              <Slider
                label="Axis Y"
                value={wf.explodedAxis.y}
                min={0}
                max={100}
                onChange={(value) => updateWf({ explodedAxis: { ...wf.explodedAxis, y: value } })}
              />
              <Slider
                label="Axis Z"
                value={wf.explodedAxis.z}
                min={0}
                max={100}
                onChange={(value) => updateWf({ explodedAxis: { ...wf.explodedAxis, z: value } })}
              />
            </div>
          )}

          <Slider
            label="Separation (mm)"
            value={wf.explodedView.separation}
            min={0}
            max={200}
            onChange={(value) => updateWf({ explodedView: { ...wf.explodedView, separation: value } })}
          />

          <div className="space-y-2">
            <Toggle
              label="Keep assemblies together"
              checked={keepAssemblies}
              onChange={setKeepAssemblies}
            />
            <Toggle
              label="Maintain floor relationships"
              checked={maintainFloors}
              onChange={setMaintainFloors}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
