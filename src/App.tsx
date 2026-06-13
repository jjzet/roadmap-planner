import { TooltipProvider } from '@/components/ui/tooltip';
import { TasksView } from '@/components/views/TasksView';
import { PagesView } from '@/components/views/PagesView';
import { JournalView } from '@/components/views/JournalView';
import { LibraryView } from '@/components/views/LibraryView';
import { BoardView } from '@/components/views/BoardView';
import { GoalsView } from '@/components/views/GoalsView';
import { InsightsView } from '@/components/views/InsightsView';
import { Dock } from '@/components/navigation/Dock';
import { CaptureOverlay } from '@/components/navigation/CaptureOverlay';
import { useTodoLoader } from './hooks/useTodoLoader';
import { useInsightLoader } from './hooks/useInsightLoader';
import { useGoalLoader } from './hooks/useGoalLoader';
import { useJournalLoader } from './hooks/useJournalLoader';
import { useTodoAutoSave } from './hooks/useTodoAutoSave';
import { useUIStore } from './store/uiStore';
import { DashboardDataProvider } from './hooks/DashboardDataContext';

function App() {
  useTodoLoader();
  useInsightLoader();
  useGoalLoader();
  useJournalLoader();
  useTodoAutoSave();

  const activeView = useUIStore((s) => s.activeView);

  return (
    <TooltipProvider>
      <DashboardDataProvider>
        <div className="relative h-screen w-screen overflow-hidden" style={{ background: 'var(--paper)' }}>
          {/* ambient layers */}
          <div className="o-graph" />
          <div className="o-wash" />

          <main className="relative z-10 h-full flex flex-col">
            {activeView === 'tasks' && <TasksView />}
            {activeView === 'pages' && <PagesView />}
            {activeView === 'journal' && <JournalView />}
            {activeView === 'library' && <LibraryView />}
            {activeView === 'board' && <BoardView />}
            {activeView === 'goals' && <GoalsView />}
            {activeView === 'insights' && <InsightsView />}
          </main>

          <Dock />
          <CaptureOverlay />
        </div>
      </DashboardDataProvider>
    </TooltipProvider>
  );
}

export default App;
