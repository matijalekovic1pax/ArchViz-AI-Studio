import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../../../store';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Toggle } from '../../ui/Toggle';
import { SectionHeader, StyleGrid } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { Check } from 'lucide-react';

interface DragState {
  activeId: string;
  activeIndex: number;
  currentIndex: number;
  initialY: number;
  translateY: number;
  itemHeight: number;
}

interface PendingDrop {
  id: string;
  fromIndex: number;
  toIndex: number;
  itemHeight: number;
}

export const LeftRender3DPanel = () => {
  const { state, dispatch } = useAppStore();
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
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

  const normalizeElements = useCallback((elements: typeof wf.detectedElements) => {
    const selected = elements.filter(el => el.selected);
    const unselected = elements.filter(el => !el.selected);
    return [...selected, ...unselected];
  }, []);

  // Drag state
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragStateRef = useRef<DragState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);

  const calculateTargetIndex = useCallback((clientY: number): number => {
    const state = dragStateRef.current;
    if (!state || !listRef.current) return 0;

    const listRect = listRef.current.getBoundingClientRect();
    const relativeY = clientY - listRect.top;

    let targetIndex = Math.floor((relativeY + state.itemHeight / 2) / state.itemHeight);
    targetIndex = Math.max(0, Math.min(wf.detectedElements.length - 1, targetIndex));

    return targetIndex;
  }, [wf.detectedElements.length]);

  const getItemShift = useCallback((itemIndex: number, elementId: string): number => {
    // Active drag state takes priority
    if (dragState) {
      const { activeIndex, currentIndex, itemHeight } = dragState;

      if (itemIndex === activeIndex) return 0;

      if (activeIndex < currentIndex) {
        if (itemIndex > activeIndex && itemIndex <= currentIndex) {
          return -itemHeight;
        }
      } else if (activeIndex > currentIndex) {
        if (itemIndex >= currentIndex && itemIndex < activeIndex) {
          return itemHeight;
        }
      }
      return 0;
    }

    // During pending drop, maintain shifts until the array actually reorders
    if (pendingDrop) {
      // Don't shift the item being dropped (it's handled separately)
      if (elementId === pendingDrop.id) return 0;

      // Check if array has already reordered by finding where the dragged item currently is
      const draggedItemCurrentIndex = wf.detectedElements.findIndex(el => el.id === pendingDrop.id);

      // If the dragged item is still at fromIndex, array hasn't reordered yet - maintain shifts
      if (draggedItemCurrentIndex === pendingDrop.fromIndex) {
        const { fromIndex, toIndex, itemHeight } = pendingDrop;

        if (fromIndex < toIndex) {
          // Dragged down: items between should be shifted up
          if (itemIndex > fromIndex && itemIndex <= toIndex) {
            return -itemHeight;
          }
        } else if (fromIndex > toIndex) {
          // Dragged up: items between should be shifted down
          if (itemIndex >= toIndex && itemIndex < fromIndex) {
            return itemHeight;
          }
        }
      }
      // Array has reordered, no shifts needed
    }

    return 0;
  }, [dragState, pendingDrop, wf.detectedElements]);

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    id: string,
    index: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const itemNode = itemRefs.current.get(id);
    if (!itemNode || !listRef.current) return;

    const itemRect = itemNode.getBoundingClientRect();
    const itemHeight = itemRect.height + 4;

    const initialState: DragState = {
      activeId: id,
      activeIndex: index,
      currentIndex: index,
      initialY: e.clientY,
      translateY: 0,
      itemHeight,
    };

    dragStateRef.current = initialState;
    setDragState(initialState);
    setPendingDrop(null);

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state) return;

    const translateY = e.clientY - state.initialY;
    const newIndex = calculateTargetIndex(e.clientY);

    state.translateY = translateY;
    state.currentIndex = newIndex;

    setDragState({ ...state });
  }, [calculateTargetIndex]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    dragStateRef.current = null;
    setDragState(null);

    if (state.activeIndex !== state.currentIndex) {
      // Set pending drop with all info needed to maintain visual position
      setPendingDrop({
        id: state.activeId,
        fromIndex: state.activeIndex,
        toIndex: state.currentIndex,
        itemHeight: state.itemHeight,
      });

      const newElements = [...wf.detectedElements];
      const [movedItem] = newElements.splice(state.activeIndex, 1);
      newElements.splice(state.currentIndex, 0, movedItem);
      updateWf({ detectedElements: normalizeElements(newElements) });
    }
  }, [wf.detectedElements, updateWf, normalizeElements]);

  // Clear pending drop after reorder is complete
  useEffect(() => {
    if (!pendingDrop) return;
    
    const currentIndex = wf.detectedElements.findIndex(el => el.id === pendingDrop.id);
    
    // Check if the item has moved to its target position
    if (currentIndex === pendingDrop.toIndex) {
      // Use RAF to ensure DOM has updated
      const frame = requestAnimationFrame(() => {
        setPendingDrop(null);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [wf.detectedElements, pendingDrop]);

  // Calculate transform for an item during drop transition
  const getDropTransform = useCallback((el: typeof wf.detectedElements[0], currentArrayIndex: number): string | undefined => {
    if (!pendingDrop || pendingDrop.id !== el.id) return undefined;
    
    // Item is still at fromIndex in DOM, but should appear at toIndex
    // If array has already reordered, currentArrayIndex === toIndex, offset = 0
    // If array hasn't reordered yet, currentArrayIndex === fromIndex, need to offset
    const offset = (pendingDrop.toIndex - currentArrayIndex) * pendingDrop.itemHeight;
    
    if (offset === 0) return undefined;
    return `translateY(${offset}px)`;
  }, [pendingDrop]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    dragStateRef.current = null;
    setDragState(null);
    setPendingDrop(null);
  }, []);

  const toggleElement = useCallback((id: string) => {
    if (dragState) return;

    const newElements = wf.detectedElements.map(el =>
      el.id === id ? { ...el, selected: !el.selected } : el
    );
    updateWf({ detectedElements: normalizeElements(newElements) });
  }, [dragState, wf.detectedElements, updateWf, normalizeElements]);

  const selectedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    wf.detectedElements.forEach((el) => {
      if (el.selected) {
        count += 1;
        map.set(el.id, count);
      }
    });
    return map;
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
          <SectionHeader title="Prioritization" />
          <Toggle
            label=""
            checked={wf.prioritizationEnabled}
            onChange={(v) => updateWf({ prioritizationEnabled: v })}
          />
        </div>

        {wf.prioritizationEnabled && (
          <>
            <p className="text-[10px] text-foreground-muted mb-2">
              Drag elements to reorder priority.
            </p>

            <div ref={listRef} className="space-y-1 relative">
              {wf.detectedElements.length === 0 && (
                <div className="text-[10px] text-foreground-muted py-2">
                  No elements detected yet.
                </div>
              )}

              {wf.detectedElements.map((el, index) => {
                const isDragging = dragState?.activeId === el.id;
                const shiftY = getItemShift(index, el.id);
                const dropTransform = getDropTransform(el, index);

                let transform: string | undefined;
                if (isDragging && dragState) {
                  // Active dragging - use pointer-based transform
                  transform = `translateY(${dragState.translateY}px)`;
                } else if (dropTransform) {
                  // Dropping - maintain visual position until DOM reorders
                  transform = dropTransform;
                } else if (shiftY !== 0) {
                  // Other items shifting during drag
                  transform = `translateY(${shiftY}px)`;
                }

                // Disable transitions for dragging item, dropping item, and all items during pendingDrop
                // This prevents visual glitches from timing issues between store and state updates
                const noTransition = isDragging || !!pendingDrop;

                return (
                  <div
                    key={el.id}
                    ref={(node) => {
                      if (node) {
                        itemRefs.current.set(el.id, node);
                      } else {
                        itemRefs.current.delete(el.id);
                      }
                    }}
                    onClick={() => toggleElement(el.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 p-2 rounded text-xs cursor-pointer border",
                      !noTransition && "transition-transform duration-200 ease-out",
                      el.selected
                        ? "bg-surface-elevated border-border"
                        : "bg-transparent border-transparent opacity-50 hover:bg-surface-sunken",
                      isDragging && "shadow-lg bg-surface-elevated border-accent/50"
                    )}
                    style={{
                      transform,
                      zIndex: isDragging ? 50 : 1,
                      position: 'relative',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] text-foreground-muted font-mono w-4">
                        {el.selected ? selectedIndexMap.get(el.id) : ''}
                      </span>
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          el.confidence > 0.8 ? "bg-green-500" : "bg-yellow-500"
                        )}
                      />
                      <span className="truncate">{el.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onPointerDown={(e) => handlePointerDown(e, el.id, index)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "w-7 h-7 rounded flex items-center justify-center",
                          "text-foreground-muted hover:text-foreground",
                          "transition-colors cursor-grab touch-none select-none",
                          isDragging && "cursor-grabbing bg-surface-sunken"
                        )}
                        aria-label="Reorder priority"
                        title="Drag to reorder"
                      >
                        <span className="grid grid-cols-2 gap-[2px] pointer-events-none">
                          {Array.from({ length: 6 }).map((_, dotIndex) => (
                            <span
                              key={dotIndex}
                              className="w-1 h-1 rounded-full bg-current opacity-50"
                            />
                          ))}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleElement(el.id);
                        }}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                          el.selected
                            ? "bg-foreground border-foreground text-background shadow-sm"
                            : "border-border-strong text-transparent hover:border-foreground-muted"
                        )}
                        aria-pressed={el.selected}
                        aria-label={el.selected ? "Deselect element" : "Select element"}
                        title={el.selected ? "Selected" : "Select"}
                      >
                        <Check size={8} strokeWidth={3} />
                      </button>
                    </div>
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