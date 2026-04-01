import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { TodoItem, DevStatus } from '@/types';
import { GripVertical, Link, Trash2, ExternalLink, Pin, Calendar, ChevronRight, Archive, ArchiveRestore, X, Code2 } from 'lucide-react';
import { parseDateExpression, formatDatePreview, formatRelativeTime } from '@/lib/dates';

const DEV_STATUS_CONFIG: Record<DevStatus, { label: string; className: string; next: DevStatus | undefined }> = {
  dev:    { label: 'dev',    className: 'bg-amber-100 text-amber-700 hover:bg-amber-200',    next: 'test' },
  test:   { label: 'test',   className: 'bg-purple-100 text-purple-700 hover:bg-purple-200', next: 'pr' },
  pr:     { label: 'PR',     className: 'bg-blue-100 text-blue-600 hover:bg-blue-200',       next: 'merged' },
  merged: { label: 'merged', className: 'bg-green-100 text-green-700 hover:bg-green-200',   next: undefined },
};

interface Props {
  item: TodoItem;
  groupId: string;
  isArchived?: boolean;
}

function formatDueDate(dateStr: string): { label: string; color: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-500' };
  } else if (diffDays === 0) {
    return { label: 'Today', color: 'text-orange-500' };
  } else if (diffDays === 1) {
    return { label: 'Tomorrow', color: 'text-amber-500' };
  } else if (diffDays <= 7) {
    return { label: `${diffDays}d`, color: 'text-blue-500' };
  } else {
    const m = due.toLocaleString('default', { month: 'short' });
    return { label: `${m} ${due.getDate()}`, color: 'text-gray-500' };
  }
}

export function TodoItemRow({ item, groupId, isArchived = false }: Props) {
  const updateItem = useTodoStore((s) => s.updateItem);
  const removeItem = useTodoStore((s) => s.removeItem);
  const toggleItem = useTodoStore((s) => s.toggleItem);
  const togglePinItem = useTodoStore((s) => s.togglePinItem);
  const toggleItemExpand = useTodoStore((s) => s.toggleItemExpand);
  const archiveItem = useTodoStore((s) => s.archiveItem);
  const unarchiveItem = useTodoStore((s) => s.unarchiveItem);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState(item.link);
  const [notesValue, setNotesValue] = useState(item.notes || '');

  // Smart date input state
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  const [datePreview, setDatePreview] = useState('');

  const dateTextRef = useRef<HTMLInputElement>(null);

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

  const handleNotesBlur = () => {
    if (notesValue !== (item.notes || '')) {
      updateItem(groupId, item.id, { notes: notesValue });
    }
  };

  // ── Smart date input handlers ──

  const openDateInput = () => {
    const initial = item.dueDate || '';
    setDateInputValue(initial);
    setDatePreview(initial ? formatDatePreview(initial) : '');
    setShowDateInput(true);
  };

  const commitDateInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      // Empty → clear date
      updateItem(groupId, item.id, { dueDate: undefined });
    } else {
      const parsed = parseDateExpression(trimmed);
      if (parsed) {
        updateItem(groupId, item.id, { dueDate: parsed });
      }
    }
    setShowDateInput(false);
    setDateInputValue('');
    setDatePreview('');
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDateInputValue(val);
    const parsed = parseDateExpression(val);
    setDatePreview(parsed ? formatDatePreview(parsed) : '');
  };

  const handleDateInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDateInput(dateInputValue);
    }
    if (e.key === 'Escape') {
      setShowDateInput(false);
      setDateInputValue('');
      setDatePreview('');
    }
  };

  const handleDateInputBlur = () => {
    // Small delay so clicking the X button doesn't race with blur
    setTimeout(() => commitDateInput(dateInputValue), 100);
  };

  const cycleDevStatus = () => {
    if (!item.devStatus) {
      updateItem(groupId, item.id, { devStatus: 'dev' });
    } else {
      const next = DEV_STATUS_CONFIG[item.devStatus].next;
      updateItem(groupId, item.id, { devStatus: next });
    }
  };

  const dueInfo = item.dueDate && !item.completed ? formatDueDate(item.dueDate) : null;
  const isExpanded = item.expanded ?? false;
  const hasNotes = !!(item.notes && item.notes.trim());

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item rounded-md relative ${item.pinned ? 'bg-amber-50/50' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-center gap-1.5 py-1.5 px-1 hover:bg-gray-50 rounded-md">

        {/* Drag handle */}
        <span
          className="text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>

        {/* Expand chevron */}
        <button
          onClick={() => toggleItemExpand(groupId, item.id)}
          className={`flex-shrink-0 border-none bg-transparent cursor-pointer p-0 transition-all ${
            isExpanded || hasNotes
              ? 'text-gray-400 opacity-100'
              : 'text-gray-300 opacity-0 group-hover/item:opacity-100'
          }`}
          title={isExpanded ? 'Collapse notes' : 'Expand notes'}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Pin indicator */}
        <button
          onClick={() => togglePinItem(groupId, item.id)}
          className={`flex-shrink-0 border-none bg-transparent cursor-pointer p-0 transition-opacity ${
            item.pinned
              ? 'text-amber-500 opacity-100'
              : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover/item:opacity-100'
          }`}
          title={item.pinned ? 'Unpin' : 'Pin to top'}
        >
          <Pin className={`w-3 h-3 ${item.pinned ? 'fill-amber-500' : ''}`} />
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.completed}
          onChange={() => toggleItem(groupId, item.id)}
          className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-500 flex-shrink-0"
        />

        {/* ── Content area: text + inline actions + spacer + metadata ── */}
        <div className="flex items-center gap-1 flex-1 min-w-0">

          {/* Auto-sizing text / input */}
          {isEditing ? (
            <div className="inline-grid text-sm">
              {/* Hidden sizer span — dictates the input's width */}
              <span
                aria-hidden
                className="invisible whitespace-pre col-start-1 row-start-1 text-sm px-0 min-w-[4ch]"
              >
                {editText + '\u00a0'}
              </span>
              <input
                className="col-start-1 row-start-1 text-sm border-none outline-none bg-transparent w-full"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleTextBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { setEditText(item.text); setIsEditing(false); }
                }}
                autoFocus
              />
            </div>
          ) : (
            <span
              className={`text-sm cursor-text whitespace-nowrap ${
                item.completed ? 'line-through text-gray-400' : 'text-gray-700'
              }`}
              onClick={() => { setEditText(item.text); setIsEditing(true); }}
            >
              {item.text || <span className="text-gray-300 italic">Untitled</span>}
            </span>
          )}

          {/* Dev status badge — visible when set, click to advance cycle */}
          {item.devStatus && (
            <button
              onClick={cycleDevStatus}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 border-none cursor-pointer transition-colors ${DEV_STATUS_CONFIG[item.devStatus].className}`}
              title={`Status: ${item.devStatus} — click to advance`}
            >
              {DEV_STATUS_CONFIG[item.devStatus].label}
            </button>
          )}

          {/* ── Inline action buttons (normal items) ── */}
          {!isArchived && (
            showDateInput ? (
              /* Smart date input — replaces calendar button */
              <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                <input
                  ref={dateTextRef}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 w-28 bg-white"
                  placeholder="tomorrow, +3d, fri…"
                  value={dateInputValue}
                  onChange={handleDateInputChange}
                  onKeyDown={handleDateInputKeyDown}
                  onBlur={handleDateInputBlur}
                  autoFocus
                />
                {datePreview && (
                  <span className="text-[10px] text-blue-500 whitespace-nowrap">{datePreview}</span>
                )}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowDateInput(false);
                    setDateInputValue('');
                    setDatePreview('');
                  }}
                  className="text-gray-300 hover:text-gray-500 border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 ml-1">
                <button
                  onClick={openDateInput}
                  className={`border-none bg-transparent cursor-pointer p-0.5 rounded transition-colors ${
                    item.dueDate
                      ? 'text-blue-400 opacity-100'
                      : 'text-gray-300 hover:text-blue-500'
                  }`}
                  title="Set due date"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setLinkValue(item.link); setShowLinkInput(!showLinkInput); }}
                  className="text-gray-300 hover:text-blue-500 border-none bg-transparent cursor-pointer p-0.5 rounded"
                  title="Add link"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cycleDevStatus}
                  className={`border-none bg-transparent cursor-pointer p-0.5 rounded transition-colors ${
                    item.devStatus
                      ? 'text-amber-500 opacity-100'
                      : 'text-gray-300 hover:text-amber-500'
                  }`}
                  title="Set dev status"
                >
                  <Code2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => archiveItem(groupId, item.id)}
                  className="text-gray-300 hover:text-blue-500 border-none bg-transparent cursor-pointer p-0.5 rounded"
                  title="Archive item"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeItem(groupId, item.id)}
                  className="text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer p-0.5 rounded"
                  title="Delete item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}

          {/* ── Inline action buttons (archived items) ── */}
          {isArchived && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 ml-1">
              <button
                onClick={() => unarchiveItem(groupId, item.id)}
                className="text-gray-300 hover:text-blue-500 border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Restore item"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => removeItem(groupId, item.id)}
                className="text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Delete item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Due date badge — near text, not far right */}
          {dueInfo && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 cursor-pointer ${dueInfo.color}`}
              onClick={openDateInput}
              title={`Due: ${item.dueDate} — click to edit`}
            >
              {dueInfo.label}
            </span>
          )}

          {/* External link — near text, not far right */}
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Completed-at timestamp — only thing at far right */}
          {item.completed && item.completedAt && (
            <span
              className="text-[10px] text-gray-300 flex-shrink-0"
              title={new Date(item.completedAt).toLocaleString()}
            >
              {formatRelativeTime(item.completedAt)}
            </span>
          )}
        </div>

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

      {/* Expandable notes area */}
      {isExpanded && (
        <div className="ml-[4.5rem] mr-2 pb-2">
          <textarea
            className="w-full text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-blue-300 focus:bg-white resize-none placeholder:text-gray-400"
            placeholder="Add a note..."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            onBlur={handleNotesBlur}
            rows={2}
          />
        </div>
      )}
    </div>
  );
}
