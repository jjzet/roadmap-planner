import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, X } from 'lucide-react';
import { useTodoStore, SUBGROUP_COLORS } from '@/store/todoStore';
import { TodoItemRow } from './TodoItemRow';
import type { SubGroup, TodoItem } from '@/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  subGroup: SubGroup;
  items: TodoItem[];
  groupId: string;
}

export function SubGroupCluster({ subGroup, items, groupId }: Props) {
  const updateSubGroup = useTodoStore((s) => s.updateSubGroup);
  const removeSubGroup = useTodoStore((s) => s.removeSubGroup);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(subGroup.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `sg-header:${subGroup.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [isEditingName]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (nameInput !== subGroup.name) {
      updateSubGroup(groupId, subGroup.id, { name: nameInput });
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return a.order - b.order;
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/sg mb-2 rounded-sm relative"
    >
      <div
        className="relative rounded-sm overflow-hidden"
        style={{
          backgroundColor: hexToRgba(subGroup.color, 0.04),
        }}
      >
        {/* Top accent bar */}
        <span
          className="block w-full h-[2px] pointer-events-none"
          style={{ backgroundColor: subGroup.color }}
          aria-hidden
        />
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 group/sgheader">
          <span
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover/sg:opacity-100 transition-opacity flex-shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>

          {/* Color dot + picker */}
          <div className="relative" ref={colorRef}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-none cursor-pointer p-0 opacity-60 hover:opacity-100 transition-opacity"
              style={{ backgroundColor: subGroup.color }}
              title="Change colour"
            />
            {showColorPicker && (
              <div className="absolute top-5 left-0 z-20 bg-white rounded-lg border border-gray-200 shadow-lg p-2 flex items-center gap-1.5">
                {SUBGROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      updateSubGroup(groupId, subGroup.id, { color: c });
                      setShowColorPicker(false);
                    }}
                    className="w-5 h-5 rounded-full border-2 cursor-pointer p-0 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: c === subGroup.color ? '#374151' : 'transparent',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          {isEditingName ? (
            <input
              ref={nameRef}
              className="text-xs font-medium text-gray-600 flex-1 border-none outline-none bg-transparent px-0"
              placeholder="Name this group…"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setNameInput(subGroup.name); setIsEditingName(false); }
              }}
            />
          ) : (
            <span
              className="text-xs font-medium text-gray-500 flex-1 cursor-pointer truncate"
              onClick={() => { setNameInput(subGroup.name); setIsEditingName(true); }}
            >
              {subGroup.name || <span className="text-gray-300 italic font-normal">Name this group…</span>}
            </span>
          )}

          {/* Dissolve button */}
          <button
            onClick={() => removeSubGroup(groupId, subGroup.id)}
            className="text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer p-0.5 rounded opacity-0 group-hover/sg:opacity-100 transition-opacity flex-shrink-0"
            title="Ungroup items"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Items */}
        <SortableContext
          items={sortedItems.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="px-1 pb-1">
            {sortedItems.map((item) => (
              <TodoItemRow
                key={item.id}
                item={item}
                groupId={groupId}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
