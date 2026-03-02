import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Map, CheckSquare, Plus, LayoutDashboard } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useRoadmapStore } from '@/store/roadmapStore';
import { useTodoStore } from '@/store/todoStore';

export function AppSidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const roadmapList = useRoadmapStore((s) => s.roadmapList);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap);
  const createRoadmap = useRoadmapStore((s) => s.createRoadmap);

  const todoList = useTodoStore((s) => s.todoList);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const createTodo = useTodoStore((s) => s.createTodo);

  const handleNewRoadmap = async () => {
    const name = prompt('Enter roadmap name:');
    if (name?.trim()) {
      await createRoadmap(name.trim());
      setActiveView('roadmap');
    }
  };

  const handleNewTodo = async () => {
    const name = prompt('Enter task list name:');
    if (name?.trim()) {
      await createTodo(name.trim());
      setActiveView('tasks');
    }
  };

  const handleRoadmapClick = (id: string) => {
    loadRoadmap(id);
    setActiveView('roadmap');
  };

  const handleTodoClick = (id: string) => {
    loadTodo(id);
    setActiveView('tasks');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="font-semibold cursor-default">
              <LayoutDashboard className="w-5 h-5" />
              <span>Planner</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Roadmaps Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center">
            <span className="flex-1">Roadmaps</span>
            <button
              onClick={handleNewRoadmap}
              className="ml-auto border-none bg-transparent cursor-pointer text-sidebar-foreground/50 hover:text-sidebar-foreground p-0 group-data-[collapsible=icon]:hidden"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {roadmapList.map((r) => (
                <SidebarMenuItem key={r.id}>
                  <SidebarMenuButton
                    isActive={activeView === 'roadmap' && currentRoadmapId === r.id}
                    onClick={() => handleRoadmapClick(r.id)}
                    tooltip={r.name}
                  >
                    <Map className="w-4 h-4" />
                    <span>{r.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tasks Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center">
            <span className="flex-1">Tasks</span>
            <button
              onClick={handleNewTodo}
              className="ml-auto border-none bg-transparent cursor-pointer text-sidebar-foreground/50 hover:text-sidebar-foreground p-0 group-data-[collapsible=icon]:hidden"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {todoList.map((t) => (
                <SidebarMenuItem key={t.id}>
                  <SidebarMenuButton
                    isActive={activeView === 'tasks' && currentTodoId === t.id}
                    onClick={() => handleTodoClick(t.id)}
                    tooltip={t.name}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>{t.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
