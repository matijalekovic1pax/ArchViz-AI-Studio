import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { cn } from '../../../lib/utils';
import { nanoid } from 'nanoid';
import { ChevronDown } from 'lucide-react';

// (Reveal style UI lives on the right panel)

// (Section areas simplified to title + description only)

export const LeftSectionPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const [isDetectingAreas, setIsDetectingAreas] = useState(false);
  const [areaDetectError, setAreaDetectError] = useState<string | null>(null);
  const [openAreaId, setOpenAreaId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const areaListRef = useRef<HTMLDivElement>(null);
  const areaRefs = useRef(new Map<string, HTMLDivElement | null>());
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

  const sortedAreas = useMemo(
    () => [...wf.sectionAreas].sort((a, b) => a.order - b.order),
    [wf.sectionAreas]
  );

  const handleAutoDetectAreas = async () => {
    if (isDetectingAreas) return;
    const sourceImage = state.uploadedImage;
    if (!sourceImage) {
      setAreaDetectError('Upload an image first to auto-detect areas.');
      return;
    }

    setAreaDetectError(null);
    setIsDetectingAreas(true);
    updateWf({ sectionAreaDetection: 'auto' });

    try {
      const response = await fetch('/api/section/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: sourceImage }),
      });
      if (!response.ok) {
        throw new Error('Auto-detect failed');
      }
      const data = await response.json();
      const rawAreas = Array.isArray(data?.areas) ? data.areas : [];
      if (rawAreas.length === 0) {
        setAreaDetectError('No areas detected. Try a different image.');
        return;
      }

      const nextAreas = rawAreas.map((item: any, index: number) => {
        const title =
          typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : `Area ${index + 1}`;
        return {
          id: nanoid(),
          title,
          description: typeof item?.description === 'string' ? item.description : '',
          order: index,
          active: item?.active === false ? false : true,
        };
      });

      updateWf({ sectionAreas: nextAreas });
    } catch (error) {
      setAreaDetectError('Auto-detect failed. Please try again.');
    } finally {
      setIsDetectingAreas(false);
    }
  };

  const updateArea = (id: string, updates: Partial<typeof wf.sectionAreas[number]>) => {
    const next = wf.sectionAreas.map((area) => (area.id === id ? { ...area, ...updates } : area));
    updateWf({ sectionAreas: next });
  };

  const toggleArea = (id: string, active: boolean) => {
    updateArea(id, { active });
  };

  const handleAddArea = () => {
    const nextOrder = wf.sectionAreas.length;
    const next = {
      id: nanoid(),
      title: `Area ${nextOrder + 1}`,
      description: '',
      order: nextOrder,
      active: true,
    };
    updateWf({ sectionAreas: [...wf.sectionAreas, next], sectionAreaDetection: 'manual' });
  };

  const setAreaRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      areaRefs.current.set(id, node);
    } else {
      areaRefs.current.delete(id);
    }
  }, []);

  const beginDrag = useCallback((id: string, clientY: number) => {
    if (!areaListRef.current) return;
    const containerTop = areaListRef.current.getBoundingClientRect().top;
    const positions = sortedAreas.map((area) => {
      const node = areaRefs.current.get(area.id);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const top = rect.top - containerTop;
      return { id: area.id, top, height: rect.height, center: top + rect.height / 2 };
    });
    if (positions.some((item) => !item)) return;
    const resolved = positions as Array<{ id: string; top: number; height: number; center: number }>;
    const dragIndex = resolved.findIndex((item) => item.id === id);
    if (dragIndex === -1) return;

    const nextGap = dragIndex < resolved.length - 1
      ? resolved[dragIndex + 1].top - resolved[dragIndex].top
      : null;
    const prevGap = dragIndex > 0
      ? resolved[dragIndex].top - resolved[dragIndex - 1].top
      : null;
    const effectiveGap = (nextGap !== null && nextGap > 0)
      ? nextGap
      : (prevGap !== null && prevGap > 0 ? prevGap : resolved[dragIndex].height);

    positionsRef.current = resolved;
    dragIndexRef.current = dragIndex;
    dragOverIndexRef.current = dragIndex;
    dragItemHeightRef.current = effectiveGap;
    dragStartYRef.current = clientY;
    dragOffsetRef.current = 0;

    setDragOffset(0);
    setDragOverIndex(dragIndex);
    setDraggingId(id);
  }, [sortedAreas]);

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

    const next = [...sortedAreas];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((area, index) => ({ ...area, order: index }));
    updateWf({ sectionAreas: reordered });

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
  }, [draggingId, sortedAreas, updateWf]);

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
          while (nextIndex < positions.length - 1 && draggedCenter > positions[nextIndex + 1].center) {
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

  const dragIndex = draggingId
    ? sortedAreas.findIndex((area) => area.id === draggingId)
    : -1;
  const effectiveOverIndex = dragOverIndex ?? dragIndex;
  const dragItemHeight = dragItemHeightRef.current;

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Section Cut" />
        <div className="space-y-4">
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Cut Type</label>
            <SegmentedControl
              value={wf.sectionCut.type}
              options={[
                { label: 'Vertical', value: 'vertical' },
                { label: 'Horizontal', value: 'horizontal' },
                { label: 'Diagonal', value: 'diagonal' },
              ]}
              onChange={(value) => updateWf({ sectionCut: { ...wf.sectionCut, type: value as any } })}
            />
          </div>
          <Slider
            label="Cut Plane Position"
            value={wf.sectionCut.plane}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sectionCut: { ...wf.sectionCut, plane: value } })}
          />
          <Slider
            label="View Depth"
            value={wf.sectionCut.depth}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sectionCut: { ...wf.sectionCut, depth: value } })}
          />
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Direction</label>
            <SegmentedControl
              value={wf.sectionCut.direction}
              options={[
                { label: 'Forward', value: 'fwd' },
                { label: 'Backward', value: 'bwd' },
              ]}
              onChange={(value) => updateWf({ sectionCut: { ...wf.sectionCut, direction: value as any } })}
            />
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Section Areas" />
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleAutoDetectAreas}
            disabled={isDetectingAreas}
            className={cn(
              "w-full py-2 text-xs font-semibold rounded border transition-colors",
              isDetectingAreas
                ? "bg-surface-sunken text-foreground-muted border-border"
                : "bg-foreground text-background border-foreground hover:opacity-90"
            )}
          >
            {isDetectingAreas ? 'Detecting Areas...' : 'Auto Detect Areas'}
          </button>
          {areaDetectError && (
            <div className="text-[10px] text-red-600 font-medium">
              {areaDetectError}
            </div>
          )}

          <div ref={areaListRef} className="space-y-2">
            {sortedAreas.map((area, index) => {
              const isOpen = openAreaId === area.id;
              const isDragging = draggingId === area.id;
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
                  key={area.id}
                  ref={setAreaRef(area.id)}
                  className={cn('space-y-2 relative transform-gpu', isDragging && 'z-10')}
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
                      'flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded',
                      isDragging && 'shadow-lg border-foreground/40'
                    )}
                  >
                    <div
                      className="flex flex-col gap-0.5 text-foreground-muted cursor-grab active:cursor-grabbing touch-none"
                      onPointerDown={handlePointerDown(area.id)}
                      title="Drag to reorder"
                    >
                      <div className="w-3 h-0.5 bg-current rounded-full" />
                      <div className="w-3 h-0.5 bg-current rounded-full" />
                      <div className="w-3 h-0.5 bg-current rounded-full" />
                    </div>
                    <span className="text-xs font-medium flex-1">{index + 1}. {area.title}</span>
                    <Toggle label="" checked={area.active} onChange={(val) => toggleArea(area.id, val)} />
                    <button
                      type="button"
                      onClick={() => setOpenAreaId(isOpen ? null : area.id)}
                      className="p-1 rounded hover:bg-surface-sunken text-foreground-muted"
                      title="Edit area"
                    >
                      <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="ml-6 mr-2 space-y-2">
                      <div>
                        <label className="text-[10px] text-foreground-muted mb-1 block">Title</label>
                        <input
                          type="text"
                          value={area.title}
                          onChange={(e) => updateArea(area.id, { title: e.target.value })}
                          className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                          placeholder="Display title"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-foreground-muted mb-1 block">Description</label>
                        <textarea
                          value={area.description || ''}
                          onChange={(e) => updateArea(area.id, { description: e.target.value })}
                          className="w-full bg-surface-elevated border border-border rounded text-xs px-2 py-1.5 min-h-[56px] resize-none"
                          placeholder="Optional description"
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
            onClick={handleAddArea}
            className="w-full py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors"
          >
            + Add Area
          </button>
        </div>
      </div>

    </div>
  );
};
