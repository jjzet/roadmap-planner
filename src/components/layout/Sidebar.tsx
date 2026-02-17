import { useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import {
  STREAM_HEADER_HEIGHT,
  ITEM_ROW_HEIGHT,
  TIMELINE_HEADER_HEIGHT,
  DEFAULT_STREAM_COLORS,
  DETAIL_COLUMN_WIDTH,
  PHASE_SHORT_LABELS,
} from '../../lib/constants';
import type { PhaseType, Stream } from '../../types';
import { ColorPicker } from '../shared/ColorPicker';

export function Sidebar() {
  const streams = useRoadmapStore((s) => s.roadmap.streams);
  const addStream = useRoadmapStore((s) => s.addStream);
  const reorderStreams = useRoadmapStore((s) => s.reorderStreams);
  const removeStream = useRoadmapStore((s) => s.removeStream);
  const addItem = useRoadmapStore((s) => s.addItem);
  const toggleStreamCollapse = useRoadmapStore((s) => s.toggleStreamCollapse);
  const selectItem = useUIStore((s) => s.selectItem);
  const openEditPanel = useUIStore((s) => s.openEditPanel);
  const selectedItemId = useUIStore((s) => s.selectedItemId);

  const showLead = useUIStore((s) => s.showLeadColumn);
  const showSupport = useUIStore((s) => s.showSupportColumn);
  const showPhase = useUIStore((s) => s.showPhaseColumn);
  const toggleLead = useUIStore((s) => s.toggleLeadColumn);
  const toggleSupport = useUIStore((s) => s.toggleSupportColumn);
  const togglePhase = useUIStore((s) => s.togglePhaseColumn);

  const [showAddStream, setShowAddStream] = useState(false);
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamColor, setNewStreamColor] = useState(DEFAULT_STREAM_COLORS[0]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderStreams(active.id as string, over.id as string);
    }
  };

  const handleAddStream = () => {
    if (newStreamName.trim()) {
      addStream(newStreamName.trim(), newStreamColor);
      setNewStreamName('');
      setNewStreamColor(DEFAULT_STREAM_COLORS[(streams.length + 1) % DEFAULT_STREAM_COLORS.length]);
      setShowAddStream(false);
    }
  };

  const handleAddStreamKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddStream();
    if (e.key === 'Escape') setShowAddStream(false);
  };

  const handleItemDoubleClick = (itemId: string, streamId: string) => {
    selectItem(itemId, streamId);
    openEditPanel();
  };

  // Compute sidebar total width dynamically
  const nameColumnWidth = 160;
  const totalWidth =
    nameColumnWidth +
    (showLead ? DETAIL_COLUMN_WIDTH : 0) +
    (showSupport ? DETAIL_COLUMN_WIDTH : 0) +
    (showPhase ? DETAIL_COLUMN_WIDTH : 0);

  const streamIds = streams.map((s) => s.id);

  return (
    <div
      className="bg-white border-r border-gray-200 flex-shrink-0 overflow-x-hidden"
      style={{ width: totalWidth + 20 }}
    >
      {/* Header row with column toggles */}
      <div
        className="border-b border-gray-200 flex items-end px-2 pb-1 gap-0"
        style={{ height: TIMELINE_HEADER_HEIGHT }}
      >
        <div className="text-xs text-gray-400 font-medium" style={{ width: nameColumnWidth }}>
          STREAMS
        </div>
        <ColumnToggle label="Lead" active={showLead} onClick={toggleLead} />
        <ColumnToggle label="Support" active={showSupport} onClick={toggleSupport} />
        <ColumnToggle label="Phase" active={showPhase} onClick={togglePhase} />
      </div>

      {/* Column sub-headers */}
      {(showLead || showSupport || showPhase) && (
        <div
          className="flex items-center border-b border-gray-200 bg-gray-50 px-2"
          style={{ height: 24 }}
        >
          <div style={{ width: nameColumnWidth }} />
          {showLead && (
            <div className="text-[10px] text-gray-400 font-medium truncate" style={{ width: DETAIL_COLUMN_WIDTH }}>Lead</div>
          )}
          {showSupport && (
            <div className="text-[10px] text-gray-400 font-medium truncate" style={{ width: DETAIL_COLUMN_WIDTH }}>Support</div>
          )}
          {showPhase && (
            <div className="text-[10px] text-gray-400 font-medium truncate" style={{ width: DETAIL_COLUMN_WIDTH }}>Phase</div>
          )}
        </div>
      )}

      {/* Stream list with drag-and-drop reordering */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={streamIds} strategy={verticalListSortingStrategy}>
          <div>
            {streams.map((stream) => (
              <SortableStreamBlock
                key={stream.id}
                stream={stream}
                nameColumnWidth={nameColumnWidth}
                selectedItemId={selectedItemId}
                showLead={showLead}
                showSupport={showSupport}
                showPhase={showPhase}
                onToggleCollapse={toggleStreamCollapse}
                onRemoveStream={removeStream}
                onAddItem={addItem}
                onSelectItem={selectItem}
                onDoubleClickItem={handleItemDoubleClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add stream */}
      {showAddStream ? (
        <div className="p-2 border-t border-gray-200">
          <input
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 outline-none focus:border-blue-400"
            placeholder="Stream name..."
            value={newStreamName}
            onChange={(e) => setNewStreamName(e.target.value)}
            onKeyDown={handleAddStreamKeyDown}
            autoFocus
          />
          <ColorPicker value={newStreamColor} onChange={setNewStreamColor} />
          <div className="flex gap-1 mt-2">
            <button
              onClick={handleAddStream}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded border-none cursor-pointer hover:bg-blue-600"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddStream(false)}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded border-none cursor-pointer hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center px-3 text-sm text-gray-400 hover:text-blue-500 cursor-pointer border-t border-gray-200"
          style={{ height: STREAM_HEADER_HEIGHT }}
          onClick={() => setShowAddStream(true)}
        >
          + Add Stream
        </div>
      )}
    </div>
  );
}

// ── Sortable stream block ──

interface SortableStreamBlockProps {
  stream: Stream;
  nameColumnWidth: number;
  selectedItemId: string | null;
  showLead: boolean;
  showSupport: boolean;
  showPhase: boolean;
  onToggleCollapse: (id: string) => void;
  onRemoveStream: (id: string) => void;
  onAddItem: (id: string) => void;
  onSelectItem: (itemId: string, streamId: string) => void;
  onDoubleClickItem: (itemId: string, streamId: string) => void;
}

function SortableStreamBlock({
  stream,
  nameColumnWidth,
  selectedItemId,
  showLead,
  showSupport,
  showPhase,
  onToggleCollapse,
  onRemoveStream,
  onAddItem,
  onSelectItem,
  onDoubleClickItem,
}: SortableStreamBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stream.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Stream header — the drag handle is the grip icon */}
      <div
        className="flex items-center gap-1 px-1 border-b border-gray-100 hover:bg-gray-50 group"
        style={{ height: STREAM_HEADER_HEIGHT }}
      >
        {/* Drag handle */}
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 px-0.5 text-xs select-none"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⠿
        </span>

        {/* Collapse toggle */}
        <span
          className="text-xs text-gray-400 w-4 flex-shrink-0 cursor-pointer"
          onClick={() => onToggleCollapse(stream.id)}
        >
          {stream.collapsed ? '▶' : '▼'}
        </span>

        <div
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: stream.color }}
        />
        <span
          className="text-sm font-medium truncate flex-1 cursor-pointer"
          onClick={() => onToggleCollapse(stream.id)}
        >
          {stream.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete stream "${stream.name}"?`)) {
              onRemoveStream(stream.id);
            }
          }}
          className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 border-none bg-transparent p-0 cursor-pointer"
          title="Delete stream"
        >
          ✕
        </button>
      </div>

      {/* Items */}
      {!stream.collapsed && (
        <>
          {stream.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center px-2 border-b border-gray-50 cursor-pointer ${
                selectedItemId === item.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
              style={{ height: ITEM_ROW_HEIGHT }}
              onClick={() => onSelectItem(item.id, stream.id)}
              onDoubleClick={() => onDoubleClickItem(item.id, stream.id)}
            >
              <div className="text-sm truncate pl-6" style={{ width: nameColumnWidth }}>
                {item.name}
              </div>
              {showLead && (
                <div className="text-xs text-gray-400 truncate" style={{ width: DETAIL_COLUMN_WIDTH }} title={item.lead || '—'}>
                  {item.lead || '—'}
                </div>
              )}
              {showSupport && (
                <div className="text-xs text-gray-400 truncate" style={{ width: DETAIL_COLUMN_WIDTH }} title={item.support || '—'}>
                  {item.support || '—'}
                </div>
              )}
              {showPhase && (
                <div className="text-xs text-gray-400 truncate" style={{ width: DETAIL_COLUMN_WIDTH }} title={PHASE_SHORT_LABELS[item.phase as PhaseType] || item.phase}>
                  {PHASE_SHORT_LABELS[item.phase as PhaseType] || item.phase}
                </div>
              )}
            </div>
          ))}
          <div
            className="flex items-center px-2 pl-8 text-sm text-gray-400 hover:text-blue-500 cursor-pointer border-b border-gray-50"
            style={{ height: ITEM_ROW_HEIGHT }}
            onClick={() => onAddItem(stream.id)}
          >
            + Add Item
          </div>
        </>
      )}
    </div>
  );
}

// ── Column toggle button ──

function ColumnToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ml-1 ${
        active
          ? 'bg-blue-50 text-blue-600 border-blue-200'
          : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600'
      }`}
      title={`${active ? 'Hide' : 'Show'} ${label} column`}
    >
      {label}
    </button>
  );
}
