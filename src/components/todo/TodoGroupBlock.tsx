import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTodoStore } from '@/store/todoStore';
import { TodoItemRow } from './TodoItemRow';
import { ProgressRing } from './ProgressRing';
import type { TodoGroup } from '@/types';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, GripVertical, Trash2, Plus } from 'lucide-react';

interface Props {
  group: TodoGroup;
}

export function TodoGroupBlock({ group }: Props) {
  const toggleGroupCollapse = useTodoStore((s) => s.toggleGroupCollapse);
  const updateGroup = useTodoStore((s) => s.updateGroup);
  const removeGroup = useTodoStore((s) => s.removeGroup);
  const addItem = useTodoStore((s) => s.addItem);
  const reorderItems = useTodoStore((s) => s.reorderItems);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sortable for the group itself
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

  // Sort items: pinned first, then by order
  const sortedItems = useMemo(() => {
    return [...group.items].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.order - b.order;
    });
  }, [group.items]);

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderItems(group.id, active.id as string, over.id as string);
    }
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      addItem(group.id, newItemText.trim());
      setNewItemText('');
      // Keep input open for rapid entry
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

  const completedCount = group.items.filter((i) => i.completed).length;
  const totalCount = group.items.length;

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
            className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex-1 border-none outline-none bg-transparent px-0 py-0"
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
            className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex-1 cursor-pointer"
            onClick={() => toggleGroupCollapse(group.id)}
            onDoubleClick={() => { setNameInput(group.name); setIsEditingName(true); }}
          >
            {group.name}
          </h3>
        )}

        <ProgressRing completed={completedCount} total={totalCount} />

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

      {/* Items */}
      {!group.collapsed && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleItemDragEnd}
        >
          <SortableContext
            items={sortedItems.map((it) => it.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="ml-6">
              {sortedItems.map((item) => (
                <TodoItemRow
                  key={item.id}
                  item={item}
                  groupId={group.id}
                />
              ))}

              {/* Inline add item */}
              {isAddingItem ? (
                <div className="flex items-center gap-2 py-1.5 pl-6">
                  <div className="w-4 h-4 rounded border border-gray-300 flex-shrink-0" />
                  <input
                    className="flex-1 text-sm border-none outline-none bg-transparent placeholder:text-gray-400"
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
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 cursor-pointer border-none bg-transparent py-1.5 pl-6"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add item
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
