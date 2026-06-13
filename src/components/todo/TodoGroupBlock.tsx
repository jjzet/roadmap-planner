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

  looseItems.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return a.order - b.order;
  });

  grouped.forEach((sgItems) => {
    sgItems.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.order - b.order;
    });
  });

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

  slots.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.type === 'subgroup' ? -1 : 1;
  });

  return slots;
}

interface Props {
  group: TodoGroup;
  /** 1-based ordinal among the page's group blocks — drives the numbered tile. */
  ordinal?: number;
}

export function TodoGroupBlock({ group, ordinal }: Props) {
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const subGroups = group.subGroups || [];

  const renderSlots = useMemo(
    () => buildRenderSlots(group.items, subGroups),
    [group.items, subGroups]
  );

  const activeItems = useMemo(() => group.items.filter((i) => !i.archived), [group.items]);
  const archivedItems = useMemo(() => group.items.filter((i) => i.archived), [group.items]);

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

  const findItemSubGroup = useCallback(
    (itemId: string): string | undefined => {
      const item = group.items.find((it) => it.id === itemId);
      return item?.subGroupId;
    },
    [group.items]
  );

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

    const activeSg = findItemSubGroup(activeId);
    const overSg = findItemSubGroup(overId);
    const bothLoose = !activeSg && !overSg && !isSgHeader(activeId) && !isSgHeader(overId);

    if (bothLoose && mergeTargetId !== overId) {
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

    if (mergeTargetId && overId === mergeTargetId && !isSgHeader(activeId)) {
      createSubGroup(group.id, [activeId, overId]);
      setDragActiveId(null);
      setMergeTargetId(null);
      return;
    }

    setDragActiveId(null);
    setMergeTargetId(null);

    if (!overId || activeId === overId) return;

    if (isSgHeader(activeId)) {
      return;
    }

    const activeSg = findItemSubGroup(activeId);
    const overSg = isSgHeader(overId) ? sgHeaderId(overId) : findItemSubGroup(overId);

    if (!activeSg && !overSg) {
      reorderItems(group.id, activeId, overId);
      return;
    }

    if (activeSg && overSg && activeSg === overSg && !isSgHeader(overId)) {
      reorderWithinSubGroup(group.id, activeSg, activeId, overId);
      return;
    }

    if (!activeSg && overSg) {
      moveItemToSubGroup(group.id, activeId, overSg);
      return;
    }

    if (activeSg && !overSg) {
      removeItemFromSubGroup(group.id, activeId);
      return;
    }

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
  const allClear = totalCount > 0 && completedCount === totalCount;

  // Group-cleared sweep — fires once when the last active item completes.
  const [sweep, setSweep] = useState(false);
  const prevAllClear = useRef(allClear);
  useEffect(() => {
    const wasClear = prevAllClear.current;
    prevAllClear.current = allClear;
    if (allClear && !wasClear) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot celebration on the all-clear transition
      setSweep(true);
      const t = setTimeout(() => setSweep(false), 950);
      return () => clearTimeout(t);
    }
  }, [allClear]);

  const showSelectionBar = selectedGroupId === group.id && selectedItemIds.length >= 2;

  const handleGroupSelected = () => {
    createSubGroup(group.id, selectedItemIds);
    clearSelection();
  };

  const draggedItem = dragActiveId
    ? group.items.find((it) => it.id === dragActiveId)
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-12 group relative"
    >
      {/* Drag handle — floats in the left gutter so block content stays flush-left */}
      <span
        className="absolute -left-6 top-1.5 text-o-ink-14 hover:text-o-ink-45 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </span>

      <div className="min-w-0 relative">
        {sweep && <span className="o-clear-sweep rounded-lg" aria-hidden />}

        {/* Group Header — numbered tile + 2px ink rule */}
        <div
          className="flex items-center gap-3.5 pb-2.5 mb-1"
          style={{ borderBottom: '2px solid var(--ink)' }}
        >
          {ordinal !== undefined && (
            <span
              className="o-dot text-[14px] rounded-[7px] px-2 pt-[5px] pb-1 leading-none select-none"
              style={{ background: 'var(--sand)', color: 'var(--on-sand)', fontWeight: 900 }}
            >
              {String(ordinal).padStart(2, '0')}
            </span>
          )}

          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="o-head text-[16px] flex-1 border-none outline-none bg-transparent px-0 py-0"
              style={{ color: 'var(--ink)' }}
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
              className="o-head text-[16px] cursor-pointer flex-1 truncate m-0"
              style={{ color: 'var(--ink)' }}
              onClick={() => toggleGroupCollapse(group.id)}
              onDoubleClick={() => { setNameInput(group.name); setIsEditingName(true); }}
            >
              {group.name}
            </h3>
          )}

          {/* Trash */}
          <button
            onClick={() => {
              if (window.confirm(`Delete group "${group.name}" and all its items?`)) {
                removeGroup(group.id);
              }
            }}
            className="text-o-ink-28 hover:text-o-blue opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Archive completed */}
          {hasCompletedItems && (
            <button
              onClick={() => archiveCompletedItems(group.id)}
              className="text-o-ink-28 hover:text-o-blue opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0"
              title="Archive completed items"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Count */}
          <span className="o-dot text-[13px]" style={{ color: allClear ? 'var(--blue)' : 'var(--ink-65)' }}>
            <b style={{ color: allClear ? 'var(--blue)' : 'var(--ink)' }}>{completedCount}</b>/{totalCount}
          </span>

          {/* Collapse chevron */}
          <button
            className="cursor-pointer text-o-ink-45 hover:text-o-ink border-none bg-transparent p-0"
            onClick={() => toggleGroupCollapse(group.id)}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${!group.collapsed ? 'rotate-90' : ''}`}
            />
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
              <div>
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
                      className={mergeTargetId === slot.item.id ? 'rounded-lg transition-all' : ''}
                      style={
                        mergeTargetId === slot.item.id
                          ? { boxShadow: 'inset 0 0 0 2px var(--blue-mid)', background: 'var(--blue-soft)' }
                          : undefined
                      }
                    >
                      <TodoItemRow
                        item={slot.item}
                        groupId={group.id}
                        subGroups={subGroups}
                      />
                    </div>
                  );
                })}

                {/* Inline add item */}
                {isAddingItem ? (
                  <div className="flex items-center gap-2.5 py-2 pl-9">
                    <span className="o-tick" style={{ width: 20, height: 20, borderColor: 'var(--ink-28)' }} />
                    <input
                      className="flex-1 text-[15px] font-medium border-none outline-none bg-transparent"
                      style={{ color: 'var(--ink)' }}
                      placeholder="Type a task…"
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
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-o-ink-28 hover:text-o-blue cursor-pointer border-none bg-transparent py-2 pl-9 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add item
                  </button>
                )}

                {/* Multi-select action bar */}
                {showSelectionBar && (
                  <div
                    className="flex items-center gap-3 mt-2 px-4 py-2.5 rounded-xl"
                    style={{ background: 'var(--blue-soft)', border: '1px solid var(--blue-mid)' }}
                  >
                    <span className="text-xs font-semibold text-o-blue">
                      {selectedItemIds.length} items selected
                    </span>
                    <button
                      onClick={handleGroupSelected}
                      className="o-dot text-[11px] px-3 py-1.5 rounded-lg border-none cursor-pointer"
                      style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
                    >
                      Group
                    </button>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-o-ink-45 hover:text-o-ink border-none bg-transparent cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Archived section */}
              {archivedItems.length > 0 && (
                <div className="mt-1">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="o-dot flex items-center gap-1.5 text-[10.5px] text-o-ink-28 hover:text-o-ink-65 cursor-pointer border-none bg-transparent w-full py-2 text-left"
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${showArchived ? 'rotate-90' : ''}`}
                    />
                    Archived ({archivedItems.length})
                  </button>
                  {showArchived && (
                    <div className="pb-3 opacity-60">
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
            </SortableContext>

            {/* Drag overlay */}
            <DragOverlay>
              {draggedItem ? (
                <div
                  className="rounded-lg px-3 py-2 opacity-95"
                  style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)', boxShadow: '0 16px 40px -12px rgba(0,0,0,.3)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {(draggedItem.text || 'Untitled').replace(/<[^>]*>/g, '')}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
