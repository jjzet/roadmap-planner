import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { TimelineArea } from './components/layout/TimelineArea';
import { EditPanel } from './components/layout/EditPanel';
import { useRoadmapLoader } from './hooks/useRoadmapLoader';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRoadmapStore } from './store/roadmapStore';
import { TOOLBAR_HEIGHT } from './lib/constants';

function App() {
  useRoadmapLoader();
  useAutoSave();
  useKeyboardShortcuts();

  const isLoading = useRoadmapStore((s) => s.isLoading);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);
  const roadmapList = useRoadmapStore((s) => s.roadmapList);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden" style={{ height: `calc(100vh - ${TOOLBAR_HEIGHT}px)` }}>
        <Sidebar />
        <TimelineArea />
        <EditPanel />
      </div>

      {/* Loading / Empty state overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="text-gray-500 text-sm">Loading roadmap...</div>
        </div>
      )}

      {!isLoading && !currentRoadmapId && roadmapList.length === 0 && (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  const createRoadmap = useRoadmapStore((s) => s.createRoadmap);

  const handleCreate = async () => {
    await createRoadmap('My Roadmap');
  };

  return (
    <div className="fixed inset-0 bg-white/90 flex items-center justify-center z-50">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Roadmaps Yet</h2>
        <p className="text-sm text-gray-500 mb-4">Create your first roadmap to get started.</p>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 border-none cursor-pointer text-sm"
        >
          Create Roadmap
        </button>
      </div>
    </div>
  );
}

export default App;
