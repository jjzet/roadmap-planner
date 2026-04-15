import { useState } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { TOOLBAR_HEIGHT } from '../../lib/constants';
import { formatDate } from '../../lib/dates';

export function RoadmapToolbar() {
  const roadmapName = useRoadmapStore((s) => s.roadmapName);
  const renameRoadmap = useRoadmapStore((s) => s.renameRoadmap);
  const saveStatus = useRoadmapStore((s) => s.saveStatus);
  const streams = useRoadmapStore((s) => s.roadmap.streams);
  const addMilestone = useRoadmapStore((s) => s.addMilestone);
  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const showMonthColors = useUIStore((s) => s.showMonthColors);
  const toggleMonthColors = useUIStore((s) => s.toggleMonthColors);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(roadmapName);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [msName, setMsName] = useState('');
  const [msDate, setMsDate] = useState(formatDate(new Date()));
  const [msStreamId, setMsStreamId] = useState('');

  const handleNameClick = () => {
    setNameInput(roadmapName);
    setIsEditing(true);
  };

  const handleNameBlur = () => {
    setIsEditing(false);
    if (nameInput.trim() && nameInput !== roadmapName) {
      renameRoadmap(nameInput.trim());
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleOpenMilestoneForm = () => {
    if (streams.length === 0) {
      alert('Add a stream first before creating a milestone.');
      return;
    }
    setMsName('');
    setMsDate(formatDate(new Date()));
    setMsStreamId(streams[0].id);
    setShowMilestoneForm(true);
  };

  const handleAddMilestone = () => {
    if (msName.trim() && msDate && msStreamId) {
      addMilestone(msName.trim(), msDate, msStreamId);
      setShowMilestoneForm(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 border-b border-gray-200 bg-white relative"
      style={{ height: TOOLBAR_HEIGHT }}
    >
      <SidebarTrigger />

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Roadmap name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 tech-glow flex-shrink-0" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-gray-400 flex-shrink-0">Roadmap</span>
        {isEditing ? (
          <input
            className="text-[13px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-800 px-2 py-0.5 border border-cyan-400 rounded-sm outline-none"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        ) : (
          <h1
            className="text-[13px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-800 cursor-pointer hover:text-cyan-600 truncate max-w-64"
            onClick={handleNameClick}
            title="Click to rename"
          >
            {roadmapName}
          </h1>
        )}
      </div>

      {/* Milestone button */}
      <button
        onClick={handleOpenMilestoneForm}
        className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 bg-white text-gray-600 rounded-sm hover:bg-cyan-50/40 hover:text-cyan-700 border border-gray-200 hover:border-cyan-300 transition-colors"
        title="Add a milestone marker to a stream"
      >
        + Milestone
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 w-20 text-right mr-2">
        {saveStatus === 'saving' && 'saving…'}
        {saveStatus === 'saved' && '✓ saved'}
        {saveStatus === 'error' && '✗ error'}
      </div>

      {/* Month colors toggle */}
      <button
        onClick={toggleMonthColors}
        className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm border transition-colors ${
          showMonthColors
            ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
            : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-700'
        }`}
        title={showMonthColors ? 'Hide month colors' : 'Show month colors'}
      >
        Colors
      </button>

      {/* Zoom toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-sm p-0.5">
        <button
          onClick={() => setZoom('week')}
          className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm border-none transition-colors ${
            zoom === 'week'
              ? 'bg-white shadow-sm text-cyan-700 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => setZoom('month')}
          className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm border-none transition-colors ${
            zoom === 'month'
              ? 'bg-white shadow-sm text-cyan-700 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Month
        </button>
      </div>

      {/* Logo */}
      <img
        src="/logo.png"
        alt="Roadmap Planner"
        className="h-8 w-auto object-contain"
      />

      {/* Milestone creation popover */}
      {showMilestoneForm && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMilestoneForm(false)} />
          <div
            className="absolute top-full left-64 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50"
            style={{ width: 300 }}
          >
            <div className="text-sm font-medium text-gray-700 mb-3">Add Milestone</div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-3 outline-none focus:border-cyan-500"
              placeholder="Milestone name..."
              value={msName}
              onChange={(e) => setMsName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestone(); }}
              autoFocus
            />
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-3 outline-none focus:border-cyan-500"
              value={msDate}
              onChange={(e) => setMsDate(e.target.value)}
            />
            <label className="block text-xs text-gray-500 mb-1">Stream</label>
            <select
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-3 bg-white outline-none focus:border-cyan-500"
              value={msStreamId}
              onChange={(e) => setMsStreamId(e.target.value)}
            >
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleAddMilestone} className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 bg-cyan-600 text-white rounded-sm hover:bg-cyan-700 border-none cursor-pointer">Add</button>
              <button onClick={() => setShowMilestoneForm(false)} className="text-sm px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 border-none cursor-pointer">Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
