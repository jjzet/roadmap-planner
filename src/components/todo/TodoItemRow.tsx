import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { TodoItem } from '@/types';
import { GripVertical, Link, Trash2, ExternalLink } from 'lucide-react';

interface Props {
  item: TodoItem;
  groupId: string;
}

export function TodoItemRow({ item, groupId }: Props) {
  const updateItem = useTodoStore((s) => s.updateItem);
  const removeItem = useTodoStore((s) => s.removeItem);
  const toggleItem = useTodoStore((s) => s.toggleItem);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState(item.link);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    if (editText.trim() !== item.text) {
      updateItem(groupId, item.id, { text: editText.trim() });
    }
  };

  const handleLinkSave = () => {
    setShowLinkInput(false);
    if (linkValue !== item.link) {
      updateItem(groupId, item.id, { link: linkValue });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 group/item hover:bg-gray-50 rounded-md px-1 relative"
    >
      {/* Drag handle */}
      <span
        className="text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => toggleItem(groupId, item.id)}
        className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-500 flex-shrink-0"
      />

      {/* Text */}
      {isEditing ? (
        <input
          className="flex-1 text-sm border-none outline-none bg-transparent"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleTextBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setEditText(item.text); setIsEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span
          className={`flex-1 text-sm cursor-text min-w-0 ${
            item.completed ? 'line-through text-gray-400' : 'text-gray-700'
          }`}
          onClick={() => { setEditText(item.text); setIsEditing(true); }}
        >
          {item.text || <span className="text-gray-300 italic">Untitled</span>}
        </span>
      )}

      {/* Link indicator */}
      {item.link && !showLinkInput && (
        <a
          href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600 flex-shrink-0"
          title={item.link}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      {/* Tags */}
      {item.tags.map((tag) => (
        <span
          key={tag}
          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0"
        >
          {tag}
        </span>
      ))}

      {/* Action buttons (visible on hover) */}
      <button
        onClick={() => { setLinkValue(item.link); setShowLinkInput(!showLinkInput); }}
        className="text-gray-300 hover:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
        title="Add link"
      >
        <Link className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => removeItem(groupId, item.id)}
        className="text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
        title="Delete item"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Link input popover */}
      {showLinkInput && (
        <div className="absolute left-8 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
          <input
            className="text-sm border border-gray-300 rounded px-2 py-1.5 w-72 outline-none focus:border-blue-400"
            placeholder="Paste JIRA link or URL..."
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLinkSave();
              if (e.key === 'Escape') setShowLinkInput(false);
            }}
            onBlur={handleLinkSave}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
