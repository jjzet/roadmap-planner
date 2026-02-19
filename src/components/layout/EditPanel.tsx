import { useMemo } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useRoadmapStore } from '../../store/roadmapStore';
import { EDIT_PANEL_WIDTH, PHASE_LABELS, DEFAULT_STREAM_COLORS } from '../../lib/constants';
import type { RoadmapItem } from '../../types';

export function EditPanel() {
  const editPanelOpen = useUIStore((s) => s.editPanelOpen);
  const selectedItemId = useUIStore((s) => s.selectedItemId);
  const selectedStreamId = useUIStore((s) => s.selectedStreamId);
  const closeEditPanel = useUIStore((s) => s.closeEditPanel);
  const streams = useRoadmapStore((s) => s.roadmap.streams);
  const dependencies = useRoadmapStore((s) => s.roadmap.dependencies);
  const updateItem = useRoadmapStore((s) => s.updateItem);
  const removeItem = useRoadmapStore((s) => s.removeItem);
  const updateSubItem = useRoadmapStore((s) => s.updateSubItem);
  const removeSubItem = useRoadmapStore((s) => s.removeSubItem);
  const removeDependency = useRoadmapStore((s) => s.removeDependency);
  const updatePhaseBar = useRoadmapStore((s) => s.updatePhaseBar);
  const removePhaseBar = useRoadmapStore((s) => s.removePhaseBar);

  // Find selected item — may be a top-level item or a sub-item
  const { item, parentItemId } = useMemo(() => {
    if (!selectedStreamId || !selectedItemId) return { item: null, parentItemId: null };
    const stream = streams.find((s) => s.id === selectedStreamId);
    if (!stream) return { item: null, parentItemId: null };
    // Check top-level items first
    const topItem = stream.items.find((it) => it.id === selectedItemId);
    if (topItem) return { item: topItem, parentItemId: null };
    // Check sub-items
    for (const it of stream.items) {
      if (it.subItems) {
        const sub = it.subItems.find((si) => si.id === selectedItemId);
        if (sub) return { item: sub, parentItemId: it.id };
      }
    }
    return { item: null, parentItemId: null };
  }, [streams, selectedStreamId, selectedItemId]);

  const itemDependencies = useMemo(() => {
    if (!selectedItemId) return [];
    return dependencies.filter(
      (d) => d.fromItemId === selectedItemId || d.toItemId === selectedItemId
    );
  }, [dependencies, selectedItemId]);

  // Find item name by id (for dependency display)
  const getItemName = (itemId: string): string => {
    for (const stream of streams) {
      for (const it of stream.items) {
        if (it.id === itemId) return it.name;
        if (it.subItems) {
          const sub = it.subItems.find((si) => si.id === itemId);
          if (sub) return sub.name;
        }
      }
    }
    return 'Unknown';
  };

  const isSubItem = parentItemId !== null;

  // Get stream color for the "reset" option
  const streamColor = useMemo(() => {
    if (!selectedStreamId) return null;
    const stream = streams.find((s) => s.id === selectedStreamId);
    return stream?.color || null;
  }, [streams, selectedStreamId]);

  if (!editPanelOpen || !item || !selectedStreamId) return null;

  const handleChange = (field: keyof RoadmapItem, value: string) => {
    if (isSubItem) {
      updateSubItem(selectedStreamId, parentItemId, item.id, { [field]: value });
    } else {
      updateItem(selectedStreamId, item.id, { [field]: value });
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${item.name}"?`)) {
      if (isSubItem) {
        removeSubItem(selectedStreamId, parentItemId, item.id);
      } else {
        removeItem(selectedStreamId, item.id);
      }
      closeEditPanel();
    }
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-0 bg-white border-l border-gray-200 shadow-lg z-40 overflow-y-auto"
      style={{ width: EDIT_PANEL_WIDTH }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">{isSubItem ? 'Edit Sub-task' : 'Edit Item'}</h2>
        <button
          onClick={closeEditPanel}
          className="text-gray-400 hover:text-gray-600 text-lg border-none bg-transparent cursor-pointer p-0"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
            value={item.name}
            onChange={(e) => handleChange('name', e.target.value)}
          />
        </div>

        {/* Bar Color (sub-items only) */}
        {isSubItem && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bar Color</label>
            <div className="flex gap-1 flex-wrap items-center">
              {DEFAULT_STREAM_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border-2 cursor-pointer p-0"
                  style={{
                    backgroundColor: color,
                    borderColor: item.color === color ? '#1a1a2e' : 'transparent',
                  }}
                  onClick={() => handleChange('color', color)}
                  title={color}
                />
              ))}
              {item.color && (
                <button
                  className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer bg-white ml-1"
                  onClick={() => {
                    if (isSubItem) {
                      updateSubItem(selectedStreamId, parentItemId, item.id, { color: undefined } as Partial<RoadmapItem>);
                    }
                  }}
                  title="Reset to stream color"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lead */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Lead</label>
          <input
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
            value={item.lead}
            onChange={(e) => handleChange('lead', e.target.value)}
          />
        </div>

        {/* Support */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Support</label>
          <input
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
            value={item.support}
            onChange={(e) => handleChange('support', e.target.value)}
          />
        </div>

        {/* Phase */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Phase</label>
          <select
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400 bg-white"
            value={item.phase}
            onChange={(e) => handleChange('phase', e.target.value)}
          >
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
            <input
              type="date"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
              value={item.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
            <input
              type="date"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
              value={item.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <textarea
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400 min-h-20 resize-y"
            value={item.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        {/* Phase Bars (sub-items only) */}
        {isSubItem && item.phaseBars && item.phaseBars.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phase Bars</label>
            <div className="space-y-2">
              {item.phaseBars.map((bar) => (
                <div
                  key={bar.id}
                  className="bg-gray-50 rounded px-2 py-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                      value={bar.name}
                      onChange={(e) =>
                        updatePhaseBar(selectedStreamId, parentItemId!, item.id, bar.id, { name: e.target.value })
                      }
                    />
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete phase "${bar.name}"?`)) {
                          removePhaseBar(selectedStreamId, parentItemId!, item.id, bar.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 border-none bg-transparent cursor-pointer p-0 text-xs flex-shrink-0"
                      title="Delete phase bar"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Color swatches */}
                  <div className="flex gap-0.5 flex-wrap">
                    {DEFAULT_STREAM_COLORS.map((color) => (
                      <button
                        key={color}
                        className="w-4 h-4 rounded-sm border cursor-pointer p-0"
                        style={{
                          backgroundColor: color,
                          borderColor: bar.color === color ? '#1a1a2e' : 'transparent',
                          borderWidth: bar.color === color ? 2 : 1,
                        }}
                        onClick={() =>
                          updatePhaseBar(selectedStreamId, parentItemId!, item.id, bar.id, { color })
                        }
                        title={color}
                      />
                    ))}
                  </div>
                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-blue-400"
                      value={bar.startDate}
                      onChange={(e) =>
                        updatePhaseBar(selectedStreamId, parentItemId!, item.id, bar.id, { startDate: e.target.value })
                      }
                    />
                    <input
                      type="date"
                      className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-blue-400"
                      value={bar.endDate}
                      onChange={(e) =>
                        updatePhaseBar(selectedStreamId, parentItemId!, item.id, bar.id, { endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {itemDependencies.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dependencies</label>
            <div className="space-y-1">
              {itemDependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5"
                >
                  <span className="text-gray-600">
                    {dep.fromItemId === item.id ? '→ ' : '← '}
                    {getItemName(
                      dep.fromItemId === item.id ? dep.toItemId : dep.fromItemId
                    )}
                  </span>
                  <button
                    onClick={() => removeDependency(dep.id)}
                    className="text-gray-400 hover:text-red-500 border-none bg-transparent cursor-pointer p-0 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleDelete}
            className="w-full text-sm px-3 py-2 bg-red-50 text-red-600 rounded border border-red-200 cursor-pointer hover:bg-red-100"
          >
            Delete Item
          </button>
        </div>
      </div>
    </div>
  );
}
