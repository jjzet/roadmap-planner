import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TodoData, TodoGroup, TodoItem, SubGroup, PageBlock } from '../types';
import { supabase } from '../lib/supabase';

function uuid(): string {
  return crypto.randomUUID();
}

function emptyTodoData(): TodoData {
  return { groups: [], blocks: [] };
}

interface TodoListItem {
  id: string;
  name: string;
}

// Default sub-group colour palette
export const SUBGROUP_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

interface TodoStore {
  currentTodoId: string | null;
  todoName: string;
  todo: TodoData;
  todoList: TodoListItem[];
  isDirty: boolean;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  // Selection state (transient — not persisted)
  selectedItemIds: string[];
  selectedGroupId: string | null;
  toggleItemSelection: (groupId: string, itemId: string) => void;
  clearSelection: () => void;

  // Block actions
  addTextBlock: () => void;
  addGroupBlock: (name: string) => void;
  addDividerBlock: () => void;
  addHeadingBlock: (level?: 1 | 2 | 3) => void;
  removeBlock: (blockId: string) => void;
  reorderBlocks: (activeId: string, overId: string) => void;
  updateTextBlock: (blockId: string, content: string) => void;
  updateHeadingBlock: (blockId: string, content: string) => void;
  insertBlockAfter: (afterBlockId: string, newBlock: PageBlock) => void;
  replaceBlock: (blockId: string, newBlock: PageBlock) => void;

  // Group actions (operate on group blocks)
  updateGroup: (groupId: string, patch: Partial<Pick<TodoGroup, 'name'>>) => void;
  removeGroup: (groupId: string) => void;
  reorderGroups: (activeId: string, overId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;

  // Sub-group actions
  createSubGroup: (groupId: string, itemIds: string[], color?: string) => string;
  updateSubGroup: (groupId: string, subGroupId: string, patch: Partial<Pick<SubGroup, 'name' | 'color'>>) => void;
  removeSubGroup: (groupId: string, subGroupId: string) => void;
  moveItemToSubGroup: (groupId: string, itemId: string, subGroupId: string) => void;
  removeItemFromSubGroup: (groupId: string, itemId: string) => void;
  reorderWithinSubGroup: (groupId: string, subGroupId: string, activeId: string, overId: string) => void;

  // Item actions
  addItem: (groupId: string, text?: string) => string;
  updateItem: (groupId: string, itemId: string, patch: Partial<TodoItem>) => void;
  removeItem: (groupId: string, itemId: string) => void;
  toggleItem: (groupId: string, itemId: string) => void;
  togglePinItem: (groupId: string, itemId: string) => void;
  toggleItemExpand: (groupId: string, itemId: string) => void;
  archiveItem: (groupId: string, itemId: string) => void;
  unarchiveItem: (groupId: string, itemId: string) => void;
  archiveCompletedItems: (groupId: string) => void;
  reorderItems: (groupId: string, activeId: string, overId: string) => void;
  moveItemToGroup: (fromGroupId: string, toGroupId: string, itemId: string) => void;

  // Persistence
  fetchTodoList: () => Promise<void>;
  loadTodo: (id: string) => Promise<void>;
  createTodo: (name: string) => Promise<string | null>;
  deleteTodo: (id: string) => Promise<void>;
  saveTodo: () => Promise<void>;
  renameTodo: (name: string) => void;
  setDirty: () => void;
}

function findGroupBlock(blocks: PageBlock[], groupId: string): TodoGroup | undefined {
  const block = blocks.find((b) => b.type === 'group' && b.data.id === groupId);
  return block?.type === 'group' ? block.data : undefined;
}

export const useTodoStore = create<TodoStore>()(
  immer((set, get) => ({
    currentTodoId: null,
    todoName: 'My Page',
    todo: emptyTodoData(),
    todoList: [],
    isDirty: false,
    isLoading: false,
    saveStatus: 'idle' as const,
    selectedItemIds: [],
    selectedGroupId: null,

    setDirty: () => set({ isDirty: true }),

    // ── Selection (transient) ──

    toggleItemSelection: (groupId, itemId) => {
      set((s) => {
        // If selecting in a different group, reset
        if (s.selectedGroupId && s.selectedGroupId !== groupId) {
          s.selectedItemIds = [];
        }
        s.selectedGroupId = groupId;
        const idx = s.selectedItemIds.indexOf(itemId);
        if (idx >= 0) {
          s.selectedItemIds.splice(idx, 1);
          if (s.selectedItemIds.length === 0) s.selectedGroupId = null;
        } else {
          s.selectedItemIds.push(itemId);
        }
      });
    },

    clearSelection: () => {
      set({ selectedItemIds: [], selectedGroupId: null });
    },

    // ── Block Actions ──

    addTextBlock: () => {
      set((s) => {
        s.todo.blocks.push({
          type: 'text',
          data: { id: uuid(), content: '', order: s.todo.blocks.length },
        });
        s.isDirty = true;
      });
    },

    addGroupBlock: (name) => {
      set((s) => {
        const group: TodoGroup = {
          id: uuid(),
          name,
          collapsed: false,
          order: s.todo.blocks.length,
          items: [],
        };
        s.todo.blocks.push({ type: 'group', data: group });
        s.isDirty = true;
      });
    },

    addDividerBlock: () => {
      set((s) => {
        s.todo.blocks.push({
          type: 'divider',
          data: { id: uuid(), order: s.todo.blocks.length },
        });
        s.isDirty = true;
      });
    },

    addHeadingBlock: (level = 2) => {
      set((s) => {
        s.todo.blocks.push({
          type: 'heading',
          data: { id: uuid(), content: '', level, order: s.todo.blocks.length },
        });
        s.isDirty = true;
      });
    },

    removeBlock: (blockId) => {
      set((s) => {
        s.todo.blocks = s.todo.blocks.filter((b) => b.data.id !== blockId);
        s.todo.blocks.forEach((b, i) => { b.data.order = i; });
        s.isDirty = true;
      });
    },

    reorderBlocks: (activeId, overId) => {
      set((s) => {
        const blocks = s.todo.blocks;
        const oldIdx = blocks.findIndex((b) => b.data.id === activeId);
        const newIdx = blocks.findIndex((b) => b.data.id === overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const [moved] = blocks.splice(oldIdx, 1);
        blocks.splice(newIdx, 0, moved);
        blocks.forEach((b, i) => { b.data.order = i; });
        s.isDirty = true;
      });
    },

    updateTextBlock: (blockId, content) => {
      set((s) => {
        const block = s.todo.blocks.find((b) => b.type === 'text' && b.data.id === blockId);
        if (block && block.type === 'text') {
          block.data.content = content;
          s.isDirty = true;
        }
      });
    },

    updateHeadingBlock: (blockId, content) => {
      set((s) => {
        const block = s.todo.blocks.find((b) => b.type === 'heading' && b.data.id === blockId);
        if (block && block.type === 'heading') {
          block.data.content = content;
          s.isDirty = true;
        }
      });
    },

    insertBlockAfter: (afterBlockId, newBlock) => {
      set((s) => {
        const idx = s.todo.blocks.findIndex((b) => b.data.id === afterBlockId);
        if (idx === -1) {
          s.todo.blocks.push(newBlock);
        } else {
          s.todo.blocks.splice(idx + 1, 0, newBlock);
        }
        s.todo.blocks.forEach((b, i) => { b.data.order = i; });
        s.isDirty = true;
      });
    },

    replaceBlock: (blockId, newBlock) => {
      set((s) => {
        const idx = s.todo.blocks.findIndex((b) => b.data.id === blockId);
        if (idx === -1) return;
        s.todo.blocks[idx] = newBlock;
        s.todo.blocks.forEach((b, i) => { b.data.order = i; });
        s.isDirty = true;
      });
    },

    // ── Group Actions (backward compat + blocks) ──

    updateGroup: (groupId, patch) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (group) {
          Object.assign(group, patch);
          s.isDirty = true;
        }
      });
    },

    removeGroup: (groupId) => {
      set((s) => {
        s.todo.blocks = s.todo.blocks.filter((b) => !(b.type === 'group' && b.data.id === groupId));
        s.todo.blocks.forEach((b, i) => { b.data.order = i; });
        s.isDirty = true;
      });
    },

    reorderGroups: (activeId, overId) => {
      // Delegate to block reorder
      get().reorderBlocks(activeId, overId);
    },

    toggleGroupCollapse: (groupId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (group) {
          group.collapsed = !group.collapsed;
          s.isDirty = true;
        }
      });
    },

    // ── Sub-Group Actions ──

    createSubGroup: (groupId, itemIds, color) => {
      const sgId = uuid();
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        if (!group.subGroups) group.subGroups = [];
        // Compute order: use the minimum order among the selected items
        const minOrder = Math.min(
          ...itemIds.map((id) => {
            const item = group.items.find((it: TodoItem) => it.id === id);
            return item ? item.order : Infinity;
          })
        );
        const sg: SubGroup = {
          id: sgId,
          name: '',
          color: color || SUBGROUP_COLORS[group.subGroups.length % SUBGROUP_COLORS.length],
          order: minOrder,
        };
        group.subGroups.push(sg);
        // Assign items to the sub-group
        itemIds.forEach((id) => {
          const item = group.items.find((it: TodoItem) => it.id === id);
          if (item) item.subGroupId = sg.id;
        });
        s.isDirty = true;
      });
      return sgId;
    },

    updateSubGroup: (groupId, subGroupId, patch) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group?.subGroups) return;
        const sg = group.subGroups.find((g: SubGroup) => g.id === subGroupId);
        if (sg) {
          Object.assign(sg, patch);
          s.isDirty = true;
        }
      });
    },

    removeSubGroup: (groupId, subGroupId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group?.subGroups) return;
        // Clear subGroupId on all member items
        group.items.forEach((item: TodoItem) => {
          if (item.subGroupId === subGroupId) item.subGroupId = undefined;
        });
        group.subGroups = group.subGroups.filter((g: SubGroup) => g.id !== subGroupId);
        s.isDirty = true;
      });
    },

    moveItemToSubGroup: (groupId, itemId, subGroupId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.subGroupId = subGroupId;
          s.isDirty = true;
        }
      });
    },

    removeItemFromSubGroup: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (!item) return;
        const prevSgId = item.subGroupId;
        item.subGroupId = undefined;
        // Auto-dissolve empty sub-groups
        if (prevSgId && group.subGroups) {
          const remaining = group.items.filter(
            (it: TodoItem) => it.subGroupId === prevSgId && !it.archived
          );
          if (remaining.length === 0) {
            group.subGroups = group.subGroups.filter((g: SubGroup) => g.id !== prevSgId);
          }
        }
        s.isDirty = true;
      });
    },

    reorderWithinSubGroup: (groupId, subGroupId, activeId, overId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        // Get all items in this sub-group, sorted by order
        const sgItems = group.items
          .filter((it: TodoItem) => it.subGroupId === subGroupId && !it.archived)
          .sort((a: TodoItem, b: TodoItem) => a.order - b.order);
        const oldIdx = sgItems.findIndex((it: TodoItem) => it.id === activeId);
        const newIdx = sgItems.findIndex((it: TodoItem) => it.id === overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const [moved] = sgItems.splice(oldIdx, 1);
        sgItems.splice(newIdx, 0, moved);
        // Reassign order values for items in this sub-group
        sgItems.forEach((it: TodoItem, i: number) => {
          const real = group.items.find((r: TodoItem) => r.id === it.id);
          if (real) real.order = i;
        });
        s.isDirty = true;
      });
    },

    // ── Item Actions ──

    addItem: (groupId, text = '') => {
      const newId = uuid();
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        group.items.push({
          id: newId,
          text,
          completed: false,
          pinned: false,
          link: '',
          tags: [],
          order: group.items.length,
          notes: '',
          expanded: false,
          archived: false,
        });
        s.isDirty = true;
      });
      return newId;
    },

    updateItem: (groupId, itemId, patch) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (!item) return;
        Object.assign(item, patch);
        s.isDirty = true;
      });
    },

    removeItem: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        group.items = group.items.filter((it: TodoItem) => it.id !== itemId);
        group.items.forEach((it: TodoItem, i: number) => { it.order = i; });
        s.isDirty = true;
      });
    },

    toggleItem: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.completed = !item.completed;
          item.completedAt = item.completed ? new Date().toISOString() : undefined;
          s.isDirty = true;
        }
      });
    },

    togglePinItem: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.pinned = !item.pinned;
          s.isDirty = true;
        }
      });
    },

    toggleItemExpand: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.expanded = !item.expanded;
          s.isDirty = true;
        }
      });
    },

    archiveItem: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.archived = true;
          s.isDirty = true;
        }
      });
    },

    unarchiveItem: (groupId, itemId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.archived = false;
          s.isDirty = true;
        }
      });
    },

    archiveCompletedItems: (groupId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        group.items.forEach((item: TodoItem) => {
          if (item.completed && !item.archived) {
            item.archived = true;
          }
        });
        s.isDirty = true;
      });
    },

    reorderItems: (groupId, activeId, overId) => {
      set((s) => {
        const group = findGroupBlock(s.todo.blocks, groupId);
        if (!group) return;
        const items = group.items;
        const oldIdx = items.findIndex((it: TodoItem) => it.id === activeId);
        const newIdx = items.findIndex((it: TodoItem) => it.id === overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const [moved] = items.splice(oldIdx, 1);
        items.splice(newIdx, 0, moved);
        items.forEach((it: TodoItem, i: number) => { it.order = i; });
        s.isDirty = true;
      });
    },

    moveItemToGroup: (fromGroupId, toGroupId, itemId) => {
      set((s) => {
        const from = findGroupBlock(s.todo.blocks, fromGroupId);
        const to = findGroupBlock(s.todo.blocks, toGroupId);
        if (!from || !to) return;
        const idx = from.items.findIndex((it: TodoItem) => it.id === itemId);
        if (idx === -1) return;
        const [item] = from.items.splice(idx, 1);
        item.order = to.items.length;
        to.items.push(item);
        from.items.forEach((it: TodoItem, i: number) => { it.order = i; });
        s.isDirty = true;
      });
    },

    // ── Persistence ──

    fetchTodoList: async () => {
      const { data, error } = await supabase
        .from('todo_lists')
        .select('id, name')
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch todo list:', error);
        return;
      }
      set({ todoList: data || [] });
    },

    loadTodo: async (id) => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('todo_lists')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Failed to load todo:', error);
        set({ isLoading: false });
        return;
      }
      if (data) {
        const todoData = data.data as TodoData;
        // Migrate legacy data: if blocks is missing, convert groups to blocks
        let blocks = todoData.blocks || [];
        if (blocks.length === 0 && todoData.groups && todoData.groups.length > 0) {
          blocks = todoData.groups.map((g, i) => ({
            type: 'group' as const,
            data: { ...g, order: i },
          }));
        }
        // Ensure all items have required fields (migration for existing data)
        blocks.forEach((b) => {
          if (b.type === 'group') {
            if (!b.data.subGroups) b.data.subGroups = [];
            b.data.items.forEach((item) => {
              if (item.pinned === undefined) item.pinned = false;
              if (item.notes === undefined) item.notes = '';
              if (item.expanded === undefined) item.expanded = false;
              if (item.archived === undefined) item.archived = false;
            });
          }
        });
        set({
          currentTodoId: data.id,
          todoName: data.name,
          todo: { groups: [], blocks },
          isDirty: false,
          isLoading: false,
        });
      }
    },

    createTodo: async (name) => {
      const newData = emptyTodoData();
      const { data, error } = await supabase
        .from('todo_lists')
        .insert({ name, data: newData })
        .select()
        .single();
      if (error) {
        console.error('Failed to create todo list:', error);
        return null;
      }
      set({
        currentTodoId: data.id,
        todoName: data.name,
        todo: newData,
        isDirty: false,
      });
      get().fetchTodoList();
      return data.id;
    },

    deleteTodo: async (id) => {
      const { error } = await supabase.from('todo_lists').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete todo list:', error);
        return;
      }
      const { currentTodoId } = get();
      if (currentTodoId === id) {
        set({
          currentTodoId: null,
          todoName: 'My Page',
          todo: emptyTodoData(),
          isDirty: false,
        });
      }
      get().fetchTodoList();
    },

    saveTodo: async () => {
      const { currentTodoId, todo, todoName } = get();
      if (!currentTodoId) return;
      set({ saveStatus: 'saving' });
      const { error } = await supabase
        .from('todo_lists')
        .update({
          data: todo,
          name: todoName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentTodoId);
      if (error) {
        console.error('Failed to save todo:', error);
        set({ saveStatus: 'error', isDirty: true });
      } else {
        set({ isDirty: false, saveStatus: 'saved' });
        setTimeout(() => {
          set((s) => {
            if (s.saveStatus === 'saved') s.saveStatus = 'idle';
          });
        }, 2000);
      }
    },

    renameTodo: (name) => {
      set({ todoName: name, isDirty: true });
    },
  }))
);
