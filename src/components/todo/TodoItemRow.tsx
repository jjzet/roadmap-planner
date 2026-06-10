import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import { useGoalStore } from '@/store/goalStore';
import { useUIStore } from '@/store/uiStore';
import type { TodoItem, DevStatus } from '@/types';
import { GripVertical, ExternalLink, ChevronRight, ArchiveRestore, X, Target } from 'lucide-react';
import { RichTextEditor } from '../editor/RichTextEditor';
import { parseDateExpression, formatDatePreview, formatRelativeTime } from '@/lib/dates';
import type { SubGroup } from '@/types';


const DEV_STATUS_CONFIG: Record<DevStatus, { label: string; className: string; next: DevStatus | undefined }> = {
  dev:    { label: 'dev',    className: 'bg-amber-100 text-amber-700 hover:bg-amber-200',    next: 'test' },
  test:   { label: 'test',   className: 'bg-purple-100 text-purple-700 hover:bg-purple-200', next: 'pr' },
  pr:     { label: 'PR',     className: 'bg-blue-100 text-blue-700 hover:bg-blue-200',       next: 'merged' },
  merged: { label: 'merged', className: 'bg-green-100 text-green-700 hover:bg-green-200',    next: 'build' },
  build:  { label: 'build',  className: 'bg-teal-100 text-teal-700 hover:bg-teal-200',       next: undefined },
};

interface Props {
  item: TodoItem;
  groupId: string;
  isArchived?: boolean;
  subGroups?: SubGroup[];
}

type Urgency = 'overdue' | 'today' | 'soon' | 'future';
type DueInfo = { label: string; urgency: Urgency };

function formatDueDate(dateStr: string): DueInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)  return { label: `${Math.abs(diffDays)}d overdue`, urgency: 'overdue' };
  if (diffDays === 0) return { label: 'Today',                          urgency: 'today' };
  if (diffDays === 1) return { label: 'Tomorrow',                       urgency: 'soon' };
  if (diffDays <= 7)  return { label: `${diffDays}d`,                   urgency: 'soon' };
  const m = due.toLocaleString('default', { month: 'short' });
  return { label: `${m} ${due.getDate()}`, urgency: 'future' };
}

const DUE_BADGE: Record<Urgency, string> = {
  overdue: 'bg-red-50 text-red-600 border border-red-200',
  today:   'bg-orange-50 text-orange-600 border border-orange-200',
  soon:    'bg-amber-50 text-amber-600 border border-amber-100',
  future:  'bg-gray-50 text-gray-500 border border-gray-200',
};

export function TodoItemRow({ item, groupId, isArchived = false, subGroups = [] }: Props) {
  const updateItem = useTodoStore((s) => s.updateItem);
  const removeItem = useTodoStore((s) => s.removeItem);
  const toggleItem = useTodoStore((s) => s.toggleItem);
  const togglePinItem = useTodoStore((s) => s.togglePinItem);
  const toggleItemExpand = useTodoStore((s) => s.toggleItemExpand);
  const archiveItem = useTodoStore((s) => s.archiveItem);
  const unarchiveItem = useTodoStore((s) => s.unarchiveItem);
  const createSubGroup = useTodoStore((s) => s.createSubGroup);
  const moveItemToSubGroup = useTodoStore((s) => s.moveItemToSubGroup);
  const removeItemFromSubGroup = useTodoStore((s) => s.removeItemFromSubGroup);

  const [isEditing, setIsEditing] = useState(false);
  const [showSubGroupPicker, setShowSubGroupPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState(item.link);
  const [notesValue, setNotesValue] = useState(item.notes || '');

  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  const [datePreview, setDatePreview] = useState('');

  const dateTextRef = useRef<HTMLInputElement>(null);
  const subGroupPickerRef = useRef<HTMLDivElement>(null);
  const subGroupBtnRef = useRef<HTMLButtonElement>(null);
  const [subGroupMenuPos, setSubGroupMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (showSubGroupPicker && subGroupBtnRef.current) {
      const rect = subGroupBtnRef.current.getBoundingClientRect();
      setSubGroupMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showSubGroupPicker]);

  useEffect(() => {
    if (!showSubGroupPicker) return;
    const handler = (e: MouseEvent) => {
      if (subGroupPickerRef.current && !subGroupPickerRef.current.contains(e.target as Node)) {
        setShowSubGroupPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSubGroupPicker]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const handleRichTextSave = (html: string) => {
    setIsEditing(false);
    if (html !== item.text) updateItem(groupId, item.id, { text: html });
  };

  const handleLinkSave = () => {
    setShowLinkInput(false);
    if (linkValue !== item.link) updateItem(groupId, item.id, { link: linkValue });
  };

  const handleNotesSave = (html: string) => {
    setNotesValue(html);
    if (html !== (item.notes || '')) updateItem(groupId, item.id, { notes: html });
  };

  const openDateInput = () => {
    const initial = item.dueDate || '';
    setDateInputValue(initial);
    setDatePreview(initial ? formatDatePreview(initial) : '');
    setShowDateInput(true);
  };

  const commitDateInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      updateItem(groupId, item.id, { dueDate: undefined });
    } else {
      const parsed = parseDateExpression(trimmed);
      if (parsed) updateItem(groupId, item.id, { dueDate: parsed });
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
    if (e.key === 'Enter') { e.preventDefault(); commitDateInput(dateInputValue); }
    if (e.key === 'Escape') { setShowDateInput(false); setDateInputValue(''); setDatePreview(''); }
  };

  const handleDateInputBlur = () => setTimeout(() => commitDateInput(dateInputValue), 100);

  const cycleDevStatus = () => {
    if (!item.devStatus) {
      updateItem(groupId, item.id, { devStatus: 'dev' });
    } else {
      updateItem(groupId, item.id, { devStatus: DEV_STATUS_CONFIG[item.devStatus].next });
    }
  };

  const toggleItemSelection = useTodoStore((s) => s.toggleItemSelection);
  const selectedItemIds = useTodoStore((s) => s.selectedItemIds);
  const isSelected = selectedItemIds.includes(item.id);

  const linkedGoal = useGoalStore((s) => (item.goalId ? s.getGoalById(item.goalId) : undefined));
  const setActiveView = useUIStore((s) => s.setActiveView);
  const handleGoalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveView('goals');
  };
  const handleGoalUnlink = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateItem(groupId, item.id, { goalId: undefined });
  };

  const dueInfo = item.dueDate && !item.completed ? formatDueDate(item.dueDate) : null;
  const isExpanded = item.expanded ?? false;
  const hasNotes = !!(item.notes && item.notes.trim());

  // Left accent bar + row tint for urgency — straight vertical bar, no rounded corners
  const urgencyAccent =
    dueInfo?.urgency === 'overdue' ? 'bg-red-400' :
    dueInfo?.urgency === 'today'   ? 'bg-orange-400' :
    null;
  const urgencyTint =
    dueInfo?.urgency === 'overdue' ? 'bg-red-50/25' :
    dueInfo?.urgency === 'today'   ? 'bg-orange-50/25' :
    '';

  const handleRowClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleItemSelection(groupId, item.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item relative pl-1 ${urgencyTint} ${item.pinned ? 'bg-amber-50/50' : ''} ${isSelected ? 'ring-1 ring-blue-300 bg-blue-50/30 rounded-md' : ''}`}
      onClick={handleRowClick}
    >
      {urgencyAccent && (
        <span
          className={`absolute left-0 top-0 bottom-0 w-[2px] ${urgencyAccent} pointer-events-none`}
          aria-hidden
        />
      )}
      {/* Main row */}
      <div className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-gray-50/70 rounded-md">

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
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.completed}
          onChange={() => toggleItem(groupId, item.id)}
          className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-500 flex-shrink-0"
        />

        {/* ── Content area ── */}
        <div className="flex items-center gap-1 flex-1 min-w-0">

          {/* Text / edit input */}
          {isEditing ? (
            <div className="flex-1 min-w-0 todo-text-inline">
              <RichTextEditor
                content={item.text}
                onBlur={handleRichTextSave}
                placeholder="Task…"
                autoFocus
              />
            </div>
          ) : (
            <span
              className={`todo-text-inline text-[12px] font-mono font-light cursor-text whitespace-nowrap ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
              onClick={() => setIsEditing(true)}
            >
              {item.text ? (
                <span dangerouslySetInnerHTML={{ __html: item.text }} />
              ) : (
                <span className="text-gray-300 italic">Untitled</span>
              )}
            </span>
          )}

          {/* ── Always-visible indicators (zero gap from text) ── */}

          {/* Dev status badge */}
          {item.devStatus && (
            <button
              onClick={cycleDevStatus}
              className={`text-[10px] font-mono font-medium tabular-nums px-1.5 py-0.5 rounded flex-shrink-0 border-none cursor-pointer transition-colors ${DEV_STATUS_CONFIG[item.devStatus].className}`}
              title={`Status: ${item.devStatus} — click to advance`}
            >
              {DEV_STATUS_CONFIG[item.devStatus].label}
            </button>
          )}

          {/* Due date badge — prominent pill with urgency colour */}
          {dueInfo && !showDateInput && (
            <button
              onClick={openDateInput}
              className={`text-[10px] font-mono font-medium tabular-nums px-1.5 py-0.5 rounded flex-shrink-0 border-none cursor-pointer transition-colors ${DUE_BADGE[dueInfo.urgency]}`}
              title={`Due: ${item.dueDate} — click to edit`}
            >
              {dueInfo.label}
            </button>
          )}

          {/* Linked goal badge */}
          {linkedGoal && (
            <span
              className="group/goal inline-flex items-center gap-1 flex-shrink-0 max-w-[180px] text-[10px] font-mono font-medium tabular-nums px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100/80 transition-colors"
              title={`Goal: ${linkedGoal.title || 'Untitled goal'} — click to open Goals`}
            >
              <button
                onClick={handleGoalClick}
                className="inline-flex items-center gap-1 border-none bg-transparent cursor-pointer p-0 text-amber-700 min-w-0"
              >
                <Target className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {linkedGoal.title || <span className="italic text-amber-600/70">Untitled goal</span>}
                </span>
              </button>
              <button
                onClick={handleGoalUnlink}
                className="opacity-0 group-hover/goal:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 text-amber-500 hover:text-red-500 flex-shrink-0"
                title="Unlink from goal"
                aria-label="Unlink from goal"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* External link icon */}
          {item.link && !showLinkInput && (
            <a
              href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 flex-shrink-0"
              title={item.link}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Date input (inline, replaces date badge while open) */}
          {showDateInput && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                ref={dateTextRef}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-500 w-28 bg-white"
                placeholder="tomorrow, +3d, fri…"
                value={dateInputValue}
                onChange={handleDateInputChange}
                onKeyDown={handleDateInputKeyDown}
                onBlur={handleDateInputBlur}
                autoFocus
              />
              {datePreview && (
                <span className="text-[10px] text-blue-600 whitespace-nowrap">{datePreview}</span>
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
          )}

          {/* ── Hover-only action buttons (appear after active indicators) ── */}
          {!isArchived && !showDateInput && (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-0.5">
              <button
                onClick={() => togglePinItem(groupId, item.id)}
                className={`group/btn border-none bg-transparent cursor-pointer p-0.5 rounded transition-opacity ${
                  item.pinned ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'
                }`}
                title={item.pinned ? 'Unpin' : 'Pin to top'}
              >
                <img src={item.pinned ? '/icons/toolbar/pin_blue.png' : '/icons/toolbar/pin.png'} className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/pin_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
              <div className={`flex items-center gap-0.5 transition-opacity ${showSubGroupPicker ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}>
              <button
                onClick={() => { setLinkValue(item.link); setShowLinkInput(!showLinkInput); }}
                className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                title={item.link ? 'Edit link' : 'Add link'}
              >
                <img src="/icons/toolbar/link.png" className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/link_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
              <button
                onClick={cycleDevStatus}
                className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Set dev status"
              >
                <img src="/icons/toolbar/code.png" className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/code_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
              <button
                onClick={openDateInput}
                className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                title={item.dueDate ? 'Edit due date' : 'Set due date'}
              >
                <img src="/icons/toolbar/calendar.png" className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/calendar_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
              <button
                onClick={() => archiveItem(groupId, item.id)}
                className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Archive item"
              >
                <img src="/icons/toolbar/archive.png" className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/archive_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
              <div className="relative" ref={subGroupPickerRef}>
                <button
                  ref={subGroupBtnRef}
                  onClick={() => setShowSubGroupPicker((v) => !v)}
                  className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                  title={item.subGroupId ? 'Move / remove from sub-group' : 'Add to sub-group'}
                >
                  <img src={item.subGroupId ? '/icons/toolbar/layers_blue.png' : '/icons/toolbar/layers.png'} className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                  <img src="/icons/toolbar/layers_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
                </button>
                {showSubGroupPicker && subGroupMenuPos && createPortal(
                  <div
                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] py-1"
                    style={{ top: subGroupMenuPos.top, right: subGroupMenuPos.right }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {subGroups.length > 0 && (
                      <>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 px-3 pt-1 pb-0.5">Sub-groups</p>
                        {subGroups.map((sg) => (
                          <button
                            key={sg.id}
                            onClick={() => {
                              moveItemToSubGroup(groupId, item.id, sg.id);
                              setShowSubGroupPicker(false);
                            }}
                            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono hover:bg-gray-50 border-none bg-transparent cursor-pointer ${item.subGroupId === sg.id ? 'text-blue-600' : 'text-gray-700'}`}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sg.color }} />
                            {sg.name || 'Unnamed'}
                            {item.subGroupId === sg.id && <span className="ml-auto text-[10px] text-blue-500">current</span>}
                          </button>
                        ))}
                        <div className="border-t border-gray-100 my-1" />
                      </>
                    )}
                    <button
                      onClick={() => {
                        createSubGroup(groupId, [item.id]);
                        setShowSubGroupPicker(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[12px] font-mono text-gray-700 hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                    >
                      + New sub-group
                    </button>
                    {item.subGroupId && (
                      <button
                        onClick={() => {
                          removeItemFromSubGroup(groupId, item.id);
                          setShowSubGroupPicker(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[12px] font-mono text-red-500 hover:bg-red-50 border-none bg-transparent cursor-pointer"
                      >
                        Remove from sub-group
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>
              <button
                onClick={() => removeItem(groupId, item.id)}
                className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Delete item"
              >
                <img src="/icons/toolbar/trash.png" className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/trash_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
              </div>
            </div>
          )}

          {/* Archived item actions */}
          {isArchived && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 ml-0.5">
              <button
                onClick={() => unarchiveItem(groupId, item.id)}
                className="text-gray-300 hover:text-blue-800 border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Restore item"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => removeItem(groupId, item.id)}
                className="group/btn border-none bg-transparent cursor-pointer p-0.5 rounded"
                title="Delete item"
              >
                <img src="/icons/toolbar/trash.png" className="w-3.5 h-3.5 group-hover/btn:hidden" alt="" />
                <img src="/icons/toolbar/trash_blue.png" className="w-3.5 h-3.5 hidden group-hover/btn:block" alt="" />
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Tags — right-aligned */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Completed-at timestamp */}
          {item.completed && item.completedAt && (
            <span
              className="text-[10px] font-mono uppercase tracking-wider text-gray-300 flex-shrink-0"
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
              className="text-sm border border-gray-300 rounded px-2 py-1.5 w-72 outline-none focus:border-blue-500"
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
          <div className="cursor-text rounded-md px-3 py-1.5 hover:bg-gray-50/40 transition-colors">
            <RichTextEditor
              content={notesValue}
              onBlur={handleNotesSave}
              placeholder="Add a note… select text to format"
            />
          </div>
        </div>
      )}
    </div>
  );
}
