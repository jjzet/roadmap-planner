import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Plus, Trash2, ChevronRight, GripVertical } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useRoadmapStore } from '@/store/roadmapStore';
import { useTodoStore } from '@/store/todoStore';
import { TOOLBAR_HEIGHT } from '@/lib/constants';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface FlatPage {
  id: string;
  name: string;
  parentId: string | null;
  orderIndex: number;
  depth: number;
  hasChildren: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const INDENT_WIDTH = 20;

function buildFlatList(
  todoList: { id: string; name: string; parentId: string | null; orderIndex: number }[],
  expandedIds: Set<string>
): FlatPage[] {
  const roots = todoList
    .filter((t) => !t.parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const result: FlatPage[] = [];
  for (const root of roots) {
    const children = todoList.filter((t) => t.parentId === root.id);
    result.push({ ...root, depth: 0, hasChildren: children.length > 0 });
    if (expandedIds.has(root.id)) {
      children
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .forEach((child) => {
          result.push({ ...child, depth: 1, hasChildren: false });
        });
    }
  }
  return result;
}

function getProjected(
  items: FlatPage[],
  activeId: string,
  overId: string,
  dragX: number
): { parentId: string | null; depth: number } {
  const activeItem = items.find((i) => i.id === activeId);
  if (!activeItem) return { parentId: null, depth: 0 };

  const overIdx = items.findIndex((i) => i.id === overId);

  const depthChange = Math.round(dragX / INDENT_WIDTH);
  const projectedDepth = Math.max(0, Math.min(1, activeItem.depth + depthChange));

  if (projectedDepth === 0) return { parentId: null, depth: 0 };

  // Look above the drop position for a top-level item to serve as parent
  for (let i = overIdx - 1; i >= 0; i--) {
    const item = items[i];
    if (item.id === activeId) continue;
    if (item.depth === 0) return { parentId: item.id, depth: 1 };
  }
  return { parentId: null, depth: 0 };
}

function computeNewOrder(
  items: FlatPage[],
  activeId: string,
  overId: string,
  projected: { parentId: string | null; depth: number }
): { id: string; parentId: string | null; orderIndex: number }[] {
  const activeIdx = items.findIndex((i) => i.id === activeId);
  const overIdx = items.findIndex((i) => i.id === overId);
  if (activeIdx === -1 || overIdx === -1) return [];

  const reordered = [...items];
  const [moved] = reordered.splice(activeIdx, 1);
  const insertAt = activeIdx < overIdx ? overIdx : overIdx;
  reordered.splice(insertAt, 0, { ...moved, parentId: projected.parentId, depth: projected.depth });

  // Group by parentId and assign orderIndex (use __root__ sentinel for null keys)
  const groups: Record<string, FlatPage[]> = {};
  for (const item of reordered) {
    const key = item.parentId ?? '__root__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  const updates: { id: string; parentId: string | null; orderIndex: number }[] = [];
  for (const [key, group] of Object.entries(groups)) {
    const parentId = key === '__root__' ? null : key;
    for (let i = 0; i < group.length; i++) {
      updates.push({ id: group[i].id, parentId, orderIndex: i });
    }
  }
  return updates;
}

// ── Sortable Page Item ─────────────────────────────────────────────────────

interface PageItemProps {
  page: FlatPage;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onClickPage: (id: string) => void;
  onAddSubPage: (parentId: string) => void;
  onDelete: (id: string, name: string, hasChildren: boolean) => void;
  isDragOverlay?: boolean;
}

function PageItem({
  page,
  isActive,
  isExpanded,
  onToggleExpand,
  onClickPage,
  onAddSubPage,
  onDelete,
  isDragOverlay = false,
}: PageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id, disabled: isDragOverlay });

  const style = isDragOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={`group/page relative flex items-center gap-0.5 rounded-md pr-1 ${
        isDragOverlay ? 'shadow-lg bg-white border border-gray-200 opacity-95' : ''
      }`}
      data-depth={page.depth}
    >
      {/* Indentation */}
      {page.depth > 0 && (
        <div style={{ width: page.depth * INDENT_WIDTH }} className="flex-shrink-0" />
      )}

      {/* Drag handle — always reserves its width so chevron column stays fixed */}
      {!isDragOverlay && (
        <span
          className="flex-shrink-0 flex items-center justify-center w-4 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover/page:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}

      {/* Chevron slot — same width for all items; shows chevron for parents, blank for leaves */}
      <div className="w-4 flex-shrink-0 flex items-center justify-center">
        {page.hasChildren && (
          <button
            onClick={() => onToggleExpand(page.id)}
            className="flex items-center justify-center rounded border-none bg-transparent text-gray-400 hover:text-gray-700 cursor-pointer p-0"
            tabIndex={-1}
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Page button — checklist icon + name */}
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onClickPage(page.id)}
        tooltip={page.name}
        className="flex-1 min-w-0 h-8 px-2 gap-1.5"
      >
        <img src="/icons/checklist_512.png" alt="" className="w-6 h-6 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wider truncate">{page.name}</span>
      </SidebarMenuButton>

      {/* Hover actions */}
      {!isDragOverlay && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover/page:opacity-100 transition-opacity flex-shrink-0">
          {page.depth === 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddSubPage(page.id); }}
              className="p-1 rounded text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 border-none bg-transparent cursor-pointer transition-colors"
              title="Add sub-page"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(page.id, page.name, page.hasChildren); }}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 border-none bg-transparent cursor-pointer transition-colors"
            title="Delete page"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────

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
  const createSubPage = useTodoStore((s) => s.createSubPage);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const reorderTodos = useTodoStore((s) => s.reorderTodos);

  // Sidebar expand/collapse state for parents
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const parents = new Set(todoList.filter((t) => t.parentId).map((t) => t.parentId as string));
    return parents;
  });

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);

  const flatItems = buildFlatList(todoList, expandedIds);

  const projected =
    activeId && overId
      ? getProjected(flatItems, activeId, overId, dragX)
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNewRoadmap = async () => {
    const name = prompt('Enter roadmap name:');
    if (name?.trim()) {
      await createRoadmap(name.trim());
      setActiveView('roadmap');
    }
  };

  const handleNewPage = async () => {
    const name = prompt('Enter page name:');
    if (name?.trim()) {
      await createTodo(name.trim());
      setActiveView('tasks');
    }
  };

  const handleAddSubPage = async (parentId: string) => {
    const name = prompt('Enter sub-page name:');
    if (name?.trim()) {
      // Auto-expand the parent
      setExpandedIds((prev) => new Set([...prev, parentId]));
      await createSubPage(parentId, name.trim());
      setActiveView('tasks');
    }
  };

  const handleTodoClick = (id: string) => {
    loadTodo(id);
    setActiveView('tasks');
  };

  const handleRoadmapClick = (id: string) => {
    loadRoadmap(id);
    setActiveView('roadmap');
  };

  const handleDeleteRoadmap = async (id: string, name: string) => {
    if (window.confirm(`Delete roadmap "${name}"? This cannot be undone.`)) {
      await deleteRoadmap(id);
    }
  };

  const handleDeletePage = async (id: string, name: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? `Delete page "${name}" and all its sub-pages? This cannot be undone.`
      : `Delete page "${name}"? This cannot be undone.`;
    if (window.confirm(msg)) {
      await deleteTodo(id);
    }
  };

  // ── DnD handlers ──

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
    setDragX(0);
  };

  const handleDragMove = ({ delta }: DragMoveEvent) => {
    setDragX(delta.x);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over?.id as string ?? null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id && projected) {
      const updates = computeNewOrder(flatItems, active.id as string, over.id as string, projected);
      if (updates.length > 0) {
        await reorderTodos(updates);
      }
    }
    setActiveId(null);
    setOverId(null);
    setDragX(0);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setDragX(0);
  };

  const activePageItem = activeId ? flatItems.find((i) => i.id === activeId) : null;

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader
        style={{ height: TOOLBAR_HEIGHT, minHeight: TOOLBAR_HEIGHT }}
        className="flex items-center justify-start px-2"
      >
        <img src="/icons/avocado_256.png" alt="Logo" className="w-12 h-12 shrink-0" />
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        {/* Primary nav */}
        <SidebarGroup className="px-1 pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {[
                { view: 'today',    icon: '/icons/calendar_512.png',  label: 'Today' },
                { view: 'insights', icon: '/icons/idea_512.png',      label: 'Insights' },
                { view: 'goals',    icon: '/icons/bookmark_512.png',  label: 'Goals' },
                { view: 'journal',  icon: '/icons/pencil_512.png',    label: 'Journal' },
              ].map(({ view, icon, label }) => (
                <SidebarMenuItem key={view}>
                  <SidebarMenuButton
                    isActive={activeView === view}
                    onClick={() => setActiveView(view as typeof activeView)}
                    tooltip={label}
                    className="gap-2 h-9 px-2"
                  >
                    <img src={icon} alt="" className="w-9 h-9 shrink-0" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Roadmaps Section */}
        <SidebarGroup className="px-1 pt-3">
          {/* Section header — label only */}
          <div className="flex items-center px-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex-1 group-data-[collapsible=icon]:hidden">Roadmaps</span>
            <button
              onClick={handleNewRoadmap}
              className="border-none bg-transparent cursor-pointer text-gray-400 hover:text-gray-600 p-0 group-data-[collapsible=icon]:hidden"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {roadmapList.map((r) => (
                <SidebarMenuItem key={r.id}>
                  <div className="group/rm relative flex items-center gap-0.5 pr-1">
                    <SidebarMenuButton
                      isActive={activeView === 'roadmap' && currentRoadmapId === r.id}
                      onClick={() => handleRoadmapClick(r.id)}
                      tooltip={r.name}
                      className="flex-1 min-w-0 h-8 px-2 gap-1.5"
                    >
                      <img src="/icons/folder_512.png" alt="" className="w-6 h-6 shrink-0" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">{r.name}</span>
                    </SidebarMenuButton>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteRoadmap(r.id, r.name); }}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 border-none bg-transparent cursor-pointer transition-colors opacity-0 group-hover/rm:opacity-100 flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pages Section with DnD */}
        <SidebarGroup className="px-1 pt-3">
          {/* Section header — label only */}
          <div className="flex items-center px-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex-1 group-data-[collapsible=icon]:hidden">Pages</span>
            <button
              onClick={handleNewPage}
              className="border-none bg-transparent cursor-pointer text-gray-400 hover:text-gray-600 p-0 group-data-[collapsible=icon]:hidden"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={flatItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu className="gap-0">
                  {flatItems.map((page) => (
                    <SidebarMenuItem key={page.id} className="py-0">
                      <PageItem
                        page={page}
                        isActive={activeView === 'tasks' && currentTodoId === page.id}
                        isExpanded={expandedIds.has(page.id)}
                        onToggleExpand={toggleExpand}
                        onClickPage={handleTodoClick}
                        onAddSubPage={handleAddSubPage}
                        onDelete={handleDeletePage}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activePageItem ? (
                  <PageItem
                    page={activePageItem}
                    isActive={false}
                    isExpanded={false}
                    onToggleExpand={() => {}}
                    onClickPage={() => {}}
                    onAddSubPage={() => {}}
                    onDelete={() => {}}
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
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
