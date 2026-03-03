import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Map, FileText, Plus, Trash2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useRoadmapStore } from '@/store/roadmapStore';
import { useTodoStore } from '@/store/todoStore';
import { TOOLBAR_HEIGHT } from '@/lib/constants';

export function AppSidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const roadmapList = useRoadmapStore((s) => s.roadmapList);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap);
  const createRoadmap = useRoadmapStore((s) => s.createRoadmap);
  const deleteRoadmap = useRoadmapStore((s) => s.deleteRoadmap);

  const todoList = useTodoStore((s) => s.todoList);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const createTodo = useTodoStore((s) => s.createTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);

  const handleNewRoadmap = async () => {
    const name = prompt('Enter roadmap name:');
    if (name?.trim()) {
      await createRoadmap(name.trim());
      setActiveView('roadmap');
    }
  };

  const handleNewTodo = async () => {
    const name = prompt('Enter page name:');
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

  const handleDeleteRoadmap = async (id: string, name: string) => {
    if (window.confirm(`Delete roadmap "${name}"? This cannot be undone.`)) {
      await deleteRoadmap(id);
    }
  };

  const handleDeleteTodo = async (id: string, name: string) => {
    if (window.confirm(`Delete page "${name}"? This cannot be undone.`)) {
      await deleteTodo(id);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className="justify-center"
        style={{ height: TOOLBAR_HEIGHT, minHeight: TOOLBAR_HEIGHT }}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <img src="/logo.png" alt="Logo" className="w-5 h-5 shrink-0" />
              <span className="font-semibold sr-only">Planner</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

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
                  <SidebarMenuAction
                    showOnHover
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRoadmap(r.id, r.name);
                    }}
                    className="text-sidebar-foreground/50 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pages Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center">
            <span className="flex-1">Pages</span>
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
                    <FileText className="w-4 h-4" />
                    <span>{t.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTodo(t.id, t.name);
                    }}
                    className="text-sidebar-foreground/50 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </SidebarMenuAction>
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
