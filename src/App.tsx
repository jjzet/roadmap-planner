import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { RoadmapView } from '@/components/views/RoadmapView';
import { TasksView } from '@/components/views/TasksView';
import { TodayView } from '@/components/views/TodayView';
import { InsightsView } from '@/components/views/InsightsView';
import { GoalsView } from '@/components/views/GoalsView';
import { useRoadmapLoader } from './hooks/useRoadmapLoader';
import { useTodoLoader } from './hooks/useTodoLoader';
import { useInsightLoader } from './hooks/useInsightLoader';
import { useGoalLoader } from './hooks/useGoalLoader';
import { useUIStore } from './store/uiStore';

function App() {
  useRoadmapLoader();
  useTodoLoader();
  useInsightLoader();
  useGoalLoader();

  const activeView = useUIStore((s) => s.activeView);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden h-screen bg-gray-50">
          {activeView === 'roadmap' && <RoadmapView />}
          {activeView === 'tasks' && <TasksView />}
          {activeView === 'today' && <TodayView />}
          {activeView === 'insights' && <InsightsView />}
          {activeView === 'goals' && <GoalsView />}
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
