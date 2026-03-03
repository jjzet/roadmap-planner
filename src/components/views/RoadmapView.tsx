import { RoadmapToolbar } from '../layout/RoadmapToolbar';
import { Sidebar as StreamsSidebar } from '../layout/Sidebar';
import { TimelineArea } from '../layout/TimelineArea';
import { EditPanel } from '../layout/EditPanel';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useRoadmapStore } from '../../store/roadmapStore';

export function RoadmapView() {
  useAutoSave();
  useKeyboardShortcuts();

  const isLoading = useRoadmapStore((s) => s.isLoading);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading roadmap...</div>
      </div>
    );
  }

  if (!currentRoadmapId) {
    return (
      <>
        <RoadmapToolbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 text-sm">
            Select or create a roadmap from the sidebar.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <RoadmapToolbar />
      <div className="flex flex-1 overflow-hidden">
        <StreamsSidebar />
        <TimelineArea />
        <EditPanel />
      </div>
    </>
  );
}
