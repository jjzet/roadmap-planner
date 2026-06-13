import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, X } from 'lucide-react';
import { useTodoStore, SUBGROUP_COLORS } from '@/store/todoStore';
import { TodoItemRow } from './TodoItemRow';
import type { SubGroup, TodoItem } from '@/types';

interface Props {
  subGroup: SubGroup;
  items: TodoItem[];
  groupId: string;
}

/** Sub-groups render as a left colour rail — a column within the section. */
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
    borderLeft: `2.5px solid ${subGroup.color}`,
  };

  useEffect(() => {
    if (isEditingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [isEditingName]);

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
      className="group/sg my-2.5 ml-2 pl-6 relative"
    >
      {/* Header */}
      <div className="flex items-center gap-2 pt-2 pb-0.5 group/sgheader">
        <span
          className="text-o-ink-14 hover:text-o-ink-45 cursor-grab active:cursor-grabbing opacity-0 group-hover/sg:opacity-100 transition-opacity flex-shrink-0 -ml-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>

        {/* Colour swatch + picker */}
        <div className="relative" ref={colorRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0 border-none cursor-pointer p-0 opacity-80 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: subGroup.color }}
            title="Change colour"
          />
          {showColorPicker && (
            <div
              className="absolute top-5 left-0 z-20 rounded-xl p-2 flex items-center gap-1.5"
              style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)', boxShadow: '0 16px 40px -12px rgba(0,0,0,.25)' }}
            >
              {SUBGROUP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    updateSubGroup(groupId, subGroup.id, { color: c });
                    setShowColorPicker(false);
                  }}
                  className="w-5 h-5 rounded-[6px] border-2 cursor-pointer p-0 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: c === subGroup.color ? 'var(--ink)' : 'transparent',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Name — bold condensed caps */}
        {isEditingName ? (
          <input
            ref={nameRef}
            className="flex-1 border-none outline-none bg-transparent px-0 text-[12px] uppercase"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--ink-65)' }}
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
            className="flex-1 cursor-pointer truncate text-[12px] uppercase"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--ink-65)' }}
            onClick={() => { setNameInput(subGroup.name); setIsEditingName(true); }}
          >
            {subGroup.name || <span style={{ color: 'var(--ink-28)' }}>Name this group…</span>}
          </span>
        )}

        {/* Dissolve button */}
        <button
          onClick={() => removeSubGroup(groupId, subGroup.id)}
          className="text-o-ink-28 hover:text-o-blue border-none bg-transparent cursor-pointer p-0.5 rounded opacity-0 group-hover/sg:opacity-100 transition-opacity flex-shrink-0"
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
        <div>
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
  );
}
