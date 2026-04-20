import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTodoStore } from '@/store/todoStore';
import { TodoItemRow } from './TodoItemRow';
import { SubGroupCluster } from './SubGroupCluster';
import { ProgressRing } from './ProgressRing';
import type { TodoGroup, TodoItem, SubGroup } from '@/types';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, GripVertical, Trash2, Plus, Archive } from 'lucide-react';

// ── Render slot utility ──

type RenderSlot =
  | { type: 'item'; item: TodoItem; sortOrder: number }
  | { type: 'subgroup'; subGroup: SubGroup; items: TodoItem[]; sortOrder: number };

function buildRenderSlots(items: TodoItem[], subGroups: SubGroup[]): RenderSlot[] {
  const activeItems = items.filter((i) => !i.archived);
  const sgMap = new Map<string, SubGroup>();
  (subGroups || []).forEach((sg) => sgMap.set(sg.id, sg));

  // Partition into loose and grouped
  const looseItems: TodoItem[] = [];
  const grouped = new Map<string, TodoItem[]>();

  activeItems.forEach((item) => {
    if (item.subGroupId && sgMap.has(item.subGroupId)) {
      const arr = grouped.get(item.subGroupId) || [];
      arr.push(item);
      grouped.set(item.subGroupId, arr);
    } else {
      looseItems.push(item);
    }
  });

  // Sort loose items: pinned first, then order
  looseItems.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return a.order - b.order;
  });

  // Sort items within each sub-group
  grouped.forEach((sgItems) => {
    sgItems.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.order - b.order;
    });
  });

  // Build slots with sortOrder for interleaving
  const slots: RenderSlot[] = [];

  looseItems.forEach((item) => {
    slots.push({ type: 'item', item, sortOrder: item.order });
  });

  sgMap.forEach((sg) => {
    const sgItems = grouped.get(sg.id) || [];
    if (sgItems.length > 0) {
      slots.push({ type: 'subgroup', subGroup: sg, items: sgItems, sortOrder: sg.order });
    }
  });

  // Sort by order, sub-groups before items at same order
  slots.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.type === 'subgroup' ? -1 : 1;
  });

  return slots;
}

interface Props {
  group: TodoGroup;
}

export function TodoGroupBlock({ group }: Props) {
  const toggleGroupCollapse = useTodoStore((s) => s.toggleGroupCollapse);
  const updateGroup = useTodoStore((s) => s.updateGroup);
  const removeGroup = useTodoStore((s) => s.removeGroup);
  const addItem = useTodoStore((s) => s.addItem);
  const reorderItems = useTodoStore((s) => s.reorderItems);
  const reorderWithinSubGroup = useTodoStore((s) => s.reorderWithinSubGroup);
  const moveItemToSubGroup = useTodoStore((s) => s.moveItemToSubGroup);
  const removeItemFromSubGroup = useTodoStore((s) => s.removeItemFromSubGroup);
  const createSubGroup = useTodoStore((s) => s.createSubGroup);
  const archiveCompletedItems = useTodoStore((s) => s.archiveCompletedItems);
  const selectedItemIds = useTodoStore((s) => s.selectedItemIds);
  const selectedGroupId = useTodoStore((s) => s.selectedGroupId);
  const clearSelection = useTodoStore((s) => s.clearSelection);

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const [showArchived, setShowArchived] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Drag-to-merge state
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sortable for the group itself (block-level)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Sensors for item-level DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const subGroups = group.subGroups || [];

  // Build interleaved render slots
  const renderSlots = useMemo(
    () => buildRenderSlots(group.items, subGroups),
    [group.items, subGroups]
  );

  const activeItems = useMemo(() => group.items.filter((i) => !i.archived), [group.items]);
  const archivedItems = useMemo(() => group.items.filter((i) => i.archived), [group.items]);

  // All sortable IDs: item IDs + sub-group header IDs
  const sortableIds = useMemo(() => {
    const ids: string[] = [];
    renderSlots.forEach((slot) => {
      if (slot.type === 'item') {
        ids.push(slot.item.id);
      } else {
        ids.push(`sg-header:${slot.subGroup.id}`);
        slot.items.forEach((it) => ids.push(it.id));
      }
    });
    return ids;
  }, [renderSlots]);

  // Helper: find which sub-group an item belongs to
  const findItemSubGroup = useCallback(
    (itemId: string): string | undefined => {
      const item = group.items.find((it) => it.id === itemId);
      return item?.subGroupId;
    },
    [group.items]
  );

  // Helper: check if an ID is a sub-group header
  const isSgHeader = (id: string) => typeof id === 'string' && id.startsWith('sg-header:');
  const sgHeaderId = (id: string) => id.replace('sg-header:', '');

  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
    setMergeTargetId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
      setMergeTargetId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Only trigger merge indicator when both are loose items
    const activeSg = findItemSubGroup(activeId);
    const overSg = findItemSubGroup(overId);
    const bothLoose = !activeSg && !overSg && !isSgHeader(activeId) && !isSgHeader(overId);

    if (bothLoose && mergeTargetId !== overId) {
      // Reset timer when target changes — requires 1.5s of sustained hover
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = setTimeout(() => {
        setMergeTargetId(overId);
      }, 1500);
    } else if (!bothLoose) {
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
      setMergeTargetId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);

    const activeId = active.id as string;
    const overId = over ? (over.id as string) : null;

    // Check if merge indicator was active — create sub-group
    if (mergeTargetId && overId === mergeTargetId && !isSgHeader(activeId)) {
      createSubGroup(group.id, [activeId, overId]);
      setDragActiveId(null);
      setMergeTargetId(null);
      return;
    }

    setDragActiveId(null);
    setMergeTargetId(null);

    if (!overId || activeId === overId) return;

    // Case 6: sub-group header dragged (reorder cluster position)
    if (isSgHeader(activeId)) {
      // For now, sub-group headers reorder at the block level — not yet implemented
      // as a full feature. Just no-op so it doesn't break.
      return;
    }

    const activeSg = findItemSubGroup(activeId);
    const overSg = isSgHeader(overId) ? sgHeaderId(overId) : findItemSubGroup(overId);

    // Case 1: both loose → reorder
    if (!activeSg && !overSg) {
      reorderItems(group.id, activeId, overId);
      return;
    }

    // Case 2: both in same sub-group → reorder within
    if (activeSg && overSg && activeSg === overSg && !isSgHeader(overId)) {
      reorderWithinSubGroup(group.id, activeSg, activeId, overId);
      return;
    }

    // Case 3: loose item → sub-group (dropped on item inside SG or SG header)
    if (!activeSg && overSg) {
      moveItemToSubGroup(group.id, activeId, overSg);
      return;
    }

    // Case 4: sub-group item → loose (dropped on a loose item)
    if (activeSg && !overSg) {
      removeItemFromSubGroup(group.id, activeId);
      return;
    }

    // Case 5: between different sub-groups
    if (activeSg && overSg && activeSg !== overSg) {
      removeItemFromSubGroup(group.id, activeId);
      moveItemToSubGroup(group.id, activeId, isSgHeader(overId) ? sgHeaderId(overId) : overSg);
      return;
    }
  };

  const handleDragCancel = () => {
    if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    setDragActiveId(null);
    setMergeTargetId(null);
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      addItem(group.id, newItemText.trim());
      setNewItemText('');
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (nameInput.trim() && nameInput !== group.name) {
      updateGroup(group.id, { name: nameInput.trim() });
    } else {
      setNameInput(group.name);
    }
  };

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const completedCount = activeItems.filter((i) => i.completed).length;
  const totalCount = activeItems.length;
  const hasCompletedItems = activeItems.some((i) => i.completed);

  // Multi-select action bar for this group
  const showSelectionBar = selectedGroupId === group.id && selectedItemIds.length >= 2;

  const handleGroupSelected = () => {
    createSubGroup(group.id, selectedItemIds);
    clearSelection();
  };

  // Get dragged item for overlay
  const draggedItem = dragActiveId
    ? group.items.find((it) => it.id === dragActiveId)
    : null;

  return (
    <div ref={setNodeRef} style={style} className="mb-6">
      {/* Group Header */}
      <div className="flex items-center gap-2 group py-1.5">
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <button
          className="cursor-pointer text-gray-400 hover:text-gray-600 border-none bg-transparent p-0"
          onClick={() => toggleGroupCollapse(group.id)}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform ${!group.collapsed ? 'rotate-90' : ''}`}
          />
        </button>

        {isEditingName ? (
          <input
            ref={nameInputRef}
            className="text-[12px] font-mono font-semibold text-gray-700 uppercase tracking-[0.15em] flex-1 border-none outline-none bg-transparent px-0 py-0"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setNameInput(group.name); setIsEditingName(false); }
            }}
          />
        ) : (
          <h3
            className="text-[12px] font-mono font-semibold text-gray-700 uppercase tracking-[0.15em] flex-1 cursor-pointer"
            onClick={() => toggleGroupCollapse(group.id)}
            onDoubleClick={() => { setNameInput(group.name); setIsEditingName(true); }}
          >
            {group.name}
          </h3>
        )}

        <ProgressRing completed={completedCount} total={totalCount} />

        {hasCompletedItems && (
          <button
            onClick={() => archiveCompletedItems(group.id)}
            className="text-gray-300 hover:text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0"
            title="Archive completed items"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => {
            if (window.confirm(`Delete group "${group.name}" and all its items?`)) {
              removeGroup(group.id);
            }
          }}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items — interleaved with sub-groups */}
      {!group.collapsed && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="ml-6">
              {renderSlots.map((slot) => {
                if (slot.type === 'subgroup') {
                  return (
                    <SubGroupCluster
                      key={slot.subGroup.id}
                      subGroup={slot.subGroup}
                      items={slot.items}
                      groupId={group.id}
                    />
                  );
                }
                return (
                  <div
                    key={slot.item.id}
                    className={
                      mergeTargetId === slot.item.id
                        ? 'rounded-lg border-2 border-dashed border-cyan-300 bg-cyan-50/30 transition-all'
                        : ''
                    }
                  >
                    <TodoItemRow
                      item={slot.item}
                      groupId={group.id}
                    />
                  </div>
                );
              })}

              {/* Inline add item */}
              {isAddingItem ? (
                <div className="flex items-center gap-2 py-1.5 pl-6">
                  <div className="w-4 h-4 rounded border border-gray-300 flex-shrink-0" />
                  <input
                    className="flex-1 text-[12px] font-mono font-light border-none outline-none bg-transparent placeholder:text-gray-400"
                    placeholder="Type a task..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddItem();
                      if (e.key === 'Escape') { setIsAddingItem(false); setNewItemText(''); }
                    }}
                    onBlur={() => {
                      if (newItemText.trim()) handleAddItem();
                      setIsAddingItem(false);
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingItem(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-cyan-600 cursor-pointer border-none bg-transparent py-1.5 pl-6"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add item
                </button>
              )}

              {/* Multi-select action bar */}
              {showSelectionBar && (
                <div className="flex items-center gap-3 mt-2 px-4 py-2.5 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <span className="text-xs font-medium text-cyan-700">
                    {selectedItemIds.length} items selected
                  </span>
                  <button
                    onClick={handleGroupSelected}
                    className="text-xs font-medium text-white bg-cyan-500 hover:bg-cyan-700 px-3 py-1 rounded-md border-none cursor-pointer transition-colors"
                  >
                    Group
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-gray-500 hover:text-gray-700 border-none bg-transparent cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Archived section */}
              {archivedItems.length > 0 && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer border-none bg-transparent py-1 pl-6"
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${showArchived ? 'rotate-90' : ''}`}
                    />
                    Archived ({archivedItems.length})
                  </button>
                  {showArchived && (
                    <div className="opacity-60">
                      {archivedItems.map((item) => (
                        <TodoItemRow
                          key={item.id}
                          item={item}
                          groupId={group.id}
                          isArchived
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay>
            {draggedItem ? (
              <div className="bg-white rounded-md shadow-lg border border-gray-200 px-3 py-2 opacity-90">
                <span className="text-sm text-gray-700">{draggedItem.text || 'Untitled'}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
