import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { RoadmapView } from '@/components/views/RoadmapView';
import { TasksView } from '@/components/views/TasksView';
import { useRoadmapLoader } from './hooks/useRoadmapLoader';
import { useTodoLoader } from './hooks/useTodoLoader';
import { useUIStore } from './store/uiStore';

function App() {
  useRoadmapLoader();
  useTodoLoader();

  const activeView = useUIStore((s) => s.activeView);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden h-screen bg-gray-50">
          {activeView === 'roadmap' && <RoadmapView />}
          {activeView === 'tasks' && <TasksView />}
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
