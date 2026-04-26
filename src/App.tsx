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
import { DashboardDataProvider } from './hooks/DashboardDataContext';
import { BottomStatsStrip } from './components/layout/BottomStatsStrip';
import { SlideUpDashboard } from './components/layout/SlideUpDashboard';
import { ChatDockBar } from './components/layout/ChatDockBar';
import { ChatThreadPanel } from './components/layout/ChatThreadPanel';

function App() {
  useRoadmapLoader();
  useTodoLoader();
  useInsightLoader();
  useGoalLoader();

  const activeView = useUIStore((s) => s.activeView);

  return (
    <TooltipProvider>
      <DashboardDataProvider>
        <SidebarProvider>
          <AppSidebar />
          <main className="relative flex-1 min-w-0 flex flex-col overflow-clip h-screen bg-gray-50">
            <div className="flex-1 flex flex-col overflow-hidden pb-24">
              {activeView === 'roadmap' && <RoadmapView />}
              {activeView === 'tasks' && <TasksView />}
              {activeView === 'today' && <TodayView />}
              {activeView === 'insights' && <InsightsView />}
              {activeView === 'goals' && <GoalsView />}
            </div>
            <ChatThreadPanel />
            <SlideUpDashboard />
            <ChatDockBar />
            <BottomStatsStrip />
          </main>
        </SidebarProvider>
      </DashboardDataProvider>
    </TooltipProvider>
  );
}

export default App;
