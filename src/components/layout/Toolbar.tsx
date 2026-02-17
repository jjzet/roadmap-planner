import { useState } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';

export function Toolbar() {
  const roadmapName = useRoadmapStore((s) => s.roadmapName);
  const renameRoadmap = useRoadmapStore((s) => s.renameRoadmap);
  const roadmapList = useRoadmapStore((s) => s.roadmapList);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap);
  const createRoadmap = useRoadmapStore((s) => s.createRoadmap);
  const saveStatus = useRoadmapStore((s) => s.saveStatus);
  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(roadmapName);

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

  const handleRoadmapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id) loadRoadmap(id);
  };

  const handleNewRoadmap = async () => {
    const name = prompt('Enter roadmap name:');
    if (name?.trim()) {
      await createRoadmap(name.trim());
    }
  };

  return (
    <div
      className="flex items-center gap-4 px-4 border-b border-gray-200 bg-white"
      style={{ height: 52 }}
    >
      {/* Roadmap name */}
      {isEditing ? (
        <input
          className="text-lg font-semibold px-2 py-1 border border-blue-400 rounded outline-none"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          autoFocus
        />
      ) : (
        <h1
          className="text-lg font-semibold cursor-pointer hover:text-blue-600 truncate max-w-64"
          onClick={handleNameClick}
          title="Click to rename"
        >
          {roadmapName}
        </h1>
      )}

      {/* Divider */}
      <div className="h-6 w-px bg-gray-300" />

      {/* Roadmap selector */}
      <select
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
        value={currentRoadmapId || ''}
        onChange={handleRoadmapChange}
      >
        {roadmapList.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleNewRoadmap}
        className="text-sm px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 border-none"
      >
        + New
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => setZoom('week')}
          className={`text-sm px-3 py-1 rounded-md border-none transition-colors ${
            zoom === 'week'
              ? 'bg-white shadow-sm text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => setZoom('month')}
          className={`text-sm px-3 py-1 rounded-md border-none transition-colors ${
            zoom === 'month'
              ? 'bg-white shadow-sm text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Month
        </button>
      </div>

      {/* Save status */}
      <div className="text-xs text-gray-400 w-16 text-right">
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && '✓ Saved'}
        {saveStatus === 'error' && '✗ Error'}
      </div>

      {/* Logo */}
      <img
        src="/logo.png"
        alt="Roadmap Planner"
        className="h-8 w-auto object-contain"
      />
    </div>
  );
}
