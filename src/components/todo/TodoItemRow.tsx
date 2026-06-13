import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import { useGoalStore } from '@/store/goalStore';
import { useUIStore } from '@/store/uiStore';
import type { TodoItem, DevStatus } from '@/types';
import {
  GripVertical, ExternalLink, ChevronRight, ArchiveRestore, X, Target,
  Pin, Link2, CodeXml, CalendarDays, Archive, Layers, Trash2,
} from 'lucide-react';
import { RichTextEditor } from '../editor/RichTextEditor';
import { OTick } from '../shared/OTick';
import { parseDateExpression, formatDatePreview, formatRelativeTime } from '@/lib/dates';
import type { SubGroup } from '@/types';

const DEV_STATUS_CONFIG: Record<DevStatus, { label: string; next: DevStatus | undefined }> = {
  dev:    { label: 'dev',    next: 'test' },
  test:   { label: 'test',   next: 'pr' },
  pr:     { label: 'pr',     next: 'merged' },
  merged: { label: 'merged', next: 'build' },
  build:  { label: 'build',  next: undefined },
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

  if (diffDays < 0)  return { label: `${Math.abs(diffDays)}d over`, urgency: 'overdue' };
  if (diffDays === 0) return { label: 'today',                      urgency: 'today' };
  if (diffDays === 1) return { label: 'tmrw',                       urgency: 'soon' };
  if (diffDays <= 7)  return { label: `${diffDays}d`,               urgency: 'soon' };
  const m = due.toLocaleString('default', { month: 'short' });
  return { label: `${m} ${due.getDate()}`, urgency: 'future' };
}

// Urgency reads through the blue, never a new hue: overdue shouts, today hums.
const DUE_BADGE: Record<Urgency, React.CSSProperties> = {
  overdue: { background: 'var(--blue)', color: 'var(--on-blue)' },
  today:   { background: 'var(--blue-soft)', color: 'var(--blue)' },
  soon:    { background: 'var(--ink-07)', color: 'var(--ink-65)' },
  future:  { background: 'transparent', color: 'var(--ink-45)' },
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
  const [pressed, setPressed] = useState(false);

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

  const handleToggle = () => {
    if (!item.completed) {
      setPressed(true);
      setTimeout(() => setPressed(false), 320);
    }
    toggleItem(groupId, item.id);
  };

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

  const handleRowClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleItemSelection(groupId, item.id);
    }
  };

  const hoverIconClass =
    'flex-shrink-0 border-none bg-transparent cursor-pointer p-0.5 rounded transition-colors text-o-ink-28 hover:text-o-blue';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item relative ${pressed ? 'o-row-press' : ''} ${isSelected ? 'rounded-lg' : ''}`}
      onClick={handleRowClick}
    >
      {isSelected && (
        <span
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ background: 'var(--blue-soft)', boxShadow: 'inset 0 0 0 1.5px var(--blue-mid)' }}
          aria-hidden
        />
      )}

      {/* Main row */}
      <div
        className="relative flex items-center gap-2.5 py-[9px] px-1 rounded-lg transition-colors hover:bg-o-ink-04"
        style={{ borderBottom: '1px solid var(--ink-07)' }}
      >
        {/* Drag handle */}
        <span
          className="text-o-ink-14 hover:text-o-ink-45 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 -ml-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>

        {/* Expand chevron */}
        <button
          onClick={() => toggleItemExpand(groupId, item.id)}
          className={`flex-shrink-0 border-none bg-transparent cursor-pointer p-0 transition-all -ml-1 ${
            isExpanded || hasNotes
              ? 'text-o-ink-45 opacity-100'
              : 'text-o-ink-28 opacity-0 group-hover/item:opacity-100'
          }`}
          title={isExpanded ? 'Collapse notes' : 'Expand notes'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        {/* Soft-square tick */}
        <OTick checked={item.completed} onToggle={handleToggle} />

        {/* Pin marker — small soft square before the text */}
        {item.pinned && (
          <span
            className="w-2 h-2 rounded-[2.5px] flex-shrink-0"
            style={{ background: 'var(--blue)' }}
            title="Pinned"
          />
        )}

        {/* ── Content area ── */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">

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
              className="todo-text-inline text-[15px] font-medium cursor-text whitespace-nowrap overflow-hidden text-ellipsis"
              style={
                item.completed
                  ? {
                      color: 'var(--ink-45)',
                      textDecoration: 'line-through',
                      textDecorationColor: 'var(--blue)',
                      textDecorationThickness: '1.5px',
                    }
                  : { color: 'var(--ink)', letterSpacing: '-0.008em' }
              }
              onClick={() => setIsEditing(true)}
            >
              {item.text ? (
                <span dangerouslySetInnerHTML={{ __html: item.text }} />
              ) : (
                <span style={{ color: 'var(--ink-28)' }}>Untitled</span>
              )}
            </span>
          )}

          {/* Dev status chip */}
          {item.devStatus && (
            <button
              onClick={cycleDevStatus}
              className={`o-stage ${item.devStatus} flex-shrink-0`}
              title={`Stage: ${item.devStatus} — click to advance`}
            >
              {DEV_STATUS_CONFIG[item.devStatus].label}
            </button>
          )}

          {/* Due date chip */}
          {dueInfo && !showDateInput && (
            <button
              onClick={openDateInput}
              className="o-dot flex-shrink-0 border-none cursor-pointer rounded-[6px] px-2 py-[3px] text-[10.5px]"
              style={DUE_BADGE[dueInfo.urgency]}
              title={`Due: ${item.dueDate} — click to edit`}
            >
              {dueInfo.label}
            </button>
          )}

          {/* Linked goal chip */}
          {linkedGoal && (
            <span
              className="group/goal inline-flex items-center gap-1 flex-shrink-0 max-w-[180px] rounded-[6px] px-2 py-[3px] transition-colors"
              style={{ background: 'var(--sand)', color: 'var(--on-sand)' }}
              title={`Goal: ${linkedGoal.title || 'Untitled goal'} — click to open Goals`}
            >
              <button
                onClick={handleGoalClick}
                className="inline-flex items-center gap-1 border-none bg-transparent cursor-pointer p-0 min-w-0"
                style={{ color: 'var(--on-sand)' }}
              >
                <Target className="w-3 h-3 flex-shrink-0" />
                <span className="o-dot truncate text-[10px]">{linkedGoal.title || 'Untitled goal'}</span>
              </button>
              <button
                onClick={handleGoalUnlink}
                className="opacity-0 group-hover/goal:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
                style={{ color: 'var(--on-sand)' }}
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
              className="flex-shrink-0 text-o-blue hover:opacity-70"
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
                className="text-xs rounded-md px-2 py-1 outline-none w-28"
                style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)', color: 'var(--ink)' }}
                placeholder="tomorrow, +3d, fri…"
                value={dateInputValue}
                onChange={handleDateInputChange}
                onKeyDown={handleDateInputKeyDown}
                onBlur={handleDateInputBlur}
                autoFocus
              />
              {datePreview && (
                <span className="o-dot text-[10px] whitespace-nowrap text-o-blue">{datePreview}</span>
              )}
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowDateInput(false);
                  setDateInputValue('');
                  setDatePreview('');
                }}
                className="text-o-ink-28 hover:text-o-ink-65 border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* ── Hover-only action buttons ── */}
          {!isArchived && !showDateInput && (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-0.5">
              <button
                onClick={() => togglePinItem(groupId, item.id)}
                className={`${hoverIconClass} ${item.pinned ? 'opacity-100 !text-o-blue' : 'opacity-0 group-hover/item:opacity-100'}`}
                title={item.pinned ? 'Unpin' : 'Pin to top'}
              >
                <Pin className="w-3.5 h-3.5" fill={item.pinned ? 'currentColor' : 'none'} />
              </button>
              <div className={`flex items-center gap-0.5 transition-opacity ${showSubGroupPicker ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}>
                <button
                  onClick={() => { setLinkValue(item.link); setShowLinkInput(!showLinkInput); }}
                  className={hoverIconClass}
                  title={item.link ? 'Edit link' : 'Add link'}
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={cycleDevStatus} className={hoverIconClass} title="Set dev status">
                  <CodeXml className="w-3.5 h-3.5" />
                </button>
                <button onClick={openDateInput} className={hoverIconClass} title={item.dueDate ? 'Edit due date' : 'Set due date'}>
                  <CalendarDays className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => archiveItem(groupId, item.id)} className={hoverIconClass} title="Archive item">
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <div className="relative" ref={subGroupPickerRef}>
                  <button
                    ref={subGroupBtnRef}
                    onClick={() => setShowSubGroupPicker((v) => !v)}
                    className={`${hoverIconClass} ${item.subGroupId ? '!text-o-blue' : ''}`}
                    title={item.subGroupId ? 'Move / remove from sub-group' : 'Add to sub-group'}
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  {showSubGroupPicker && subGroupMenuPos && createPortal(
                    <div
                      className="fixed rounded-xl z-50 min-w-[180px] py-1.5"
                      style={{
                        top: subGroupMenuPos.top,
                        right: subGroupMenuPos.right,
                        background: 'var(--paper-raise)',
                        border: '1px solid var(--ink-14)',
                        boxShadow: '0 16px 40px -12px rgba(0,0,0,.25)',
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {subGroups.length > 0 && (
                        <>
                          <p className="o-dot text-[9.5px] text-o-ink-45 px-3 pt-1 pb-0.5">Sub-groups</p>
                          {subGroups.map((sg) => (
                            <button
                              key={sg.id}
                              onClick={() => {
                                moveItemToSubGroup(groupId, item.id, sg.id);
                                setShowSubGroupPicker(false);
                              }}
                              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium hover:bg-o-ink-04 border-none bg-transparent cursor-pointer ${item.subGroupId === sg.id ? 'text-o-blue' : 'text-o-ink'}`}
                            >
                              <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ backgroundColor: sg.color }} />
                              {sg.name || 'Unnamed'}
                              {item.subGroupId === sg.id && <span className="o-dot ml-auto text-[9px] text-o-blue">now</span>}
                            </button>
                          ))}
                          <div className="my-1" style={{ borderTop: '1px solid var(--ink-07)' }} />
                        </>
                      )}
                      <button
                        onClick={() => {
                          createSubGroup(groupId, [item.id]);
                          setShowSubGroupPicker(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[13px] font-medium text-o-ink hover:bg-o-ink-04 border-none bg-transparent cursor-pointer"
                      >
                        + New sub-group
                      </button>
                      {item.subGroupId && (
                        <button
                          onClick={() => {
                            removeItemFromSubGroup(groupId, item.id);
                            setShowSubGroupPicker(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[13px] font-medium text-o-blue hover:bg-o-ink-04 border-none bg-transparent cursor-pointer"
                        >
                          Remove from sub-group
                        </button>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
                <button onClick={() => removeItem(groupId, item.id)} className={hoverIconClass} title="Delete item">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Archived item actions */}
          {isArchived && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 ml-0.5">
              <button
                onClick={() => unarchiveItem(groupId, item.id)}
                className={hoverIconClass}
                title="Restore item"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeItem(groupId, item.id)} className={hoverIconClass} title="Delete item">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Tags — right-aligned */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.tags.map((tag) => (
                <span key={tag} className="o-dot text-[9.5px] px-1.5 py-0.5 rounded-[5px] bg-o-ink-07 text-o-ink-45">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Completed-at timestamp */}
          {item.completed && item.completedAt && (
            <span
              className="o-dot text-[10px] text-o-ink-28 flex-shrink-0"
              title={new Date(item.completedAt).toLocaleString()}
            >
              {formatRelativeTime(item.completedAt)}
            </span>
          )}
        </div>

        {/* Link input popover */}
        {showLinkInput && (
          <div
            className="absolute left-8 top-full mt-1 rounded-xl p-2 z-10"
            style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)', boxShadow: '0 16px 40px -12px rgba(0,0,0,.25)' }}
          >
            <input
              className="text-sm rounded-md px-2 py-1.5 w-72 outline-none"
              style={{ background: 'transparent', border: '1px solid var(--ink-14)', color: 'var(--ink)' }}
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
        <div className="ml-[3.4rem] mr-2 pb-2 pt-1">
          <div
            className="cursor-text rounded-lg px-3 py-2 transition-colors"
            style={{ borderLeft: '2.5px solid var(--ink-14)' }}
          >
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
