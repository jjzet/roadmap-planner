import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TodoData, TodoGroup, TodoItem } from '../types';
import { supabase } from '../lib/supabase';

function uuid(): string {
  return crypto.randomUUID();
}

function emptyTodoData(): TodoData {
  return { groups: [] };
}

interface TodoListItem {
  id: string;
  name: string;
}

interface TodoStore {
  currentTodoId: string | null;
  todoName: string;
  todo: TodoData;
  todoList: TodoListItem[];
  isDirty: boolean;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  // Group actions
  addGroup: (name: string) => void;
  updateGroup: (groupId: string, patch: Partial<Pick<TodoGroup, 'name'>>) => void;
  removeGroup: (groupId: string) => void;
  reorderGroups: (activeId: string, overId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;

  // Item actions
  addItem: (groupId: string, text?: string) => string;
  updateItem: (groupId: string, itemId: string, patch: Partial<TodoItem>) => void;
  removeItem: (groupId: string, itemId: string) => void;
  toggleItem: (groupId: string, itemId: string) => void;
  reorderItems: (groupId: string, activeId: string, overId: string) => void;
  moveItemToGroup: (fromGroupId: string, toGroupId: string, itemId: string) => void;

  // Persistence
  fetchTodoList: () => Promise<void>;
  loadTodo: (id: string) => Promise<void>;
  createTodo: (name: string) => Promise<string | null>;
  saveTodo: () => Promise<void>;
  renameTodo: (name: string) => void;
  setDirty: () => void;
}

export const useTodoStore = create<TodoStore>()(
  immer((set, get) => ({
    currentTodoId: null,
    todoName: 'My Tasks',
    todo: emptyTodoData(),
    todoList: [],
    isDirty: false,
    isLoading: false,
    saveStatus: 'idle' as const,

    setDirty: () => set({ isDirty: true }),

    // ── Group Actions ──

    addGroup: (name) => {
      set((s) => {
        s.todo.groups.push({
          id: uuid(),
          name,
          collapsed: false,
          order: s.todo.groups.length,
          items: [],
        });
        s.isDirty = true;
      });
    },

    updateGroup: (groupId, patch) => {
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (group) {
          Object.assign(group, patch);
          s.isDirty = true;
        }
      });
    },

    removeGroup: (groupId) => {
      set((s) => {
        s.todo.groups = s.todo.groups.filter((g: TodoGroup) => g.id !== groupId);
        s.todo.groups.forEach((g: TodoGroup, i: number) => {
          g.order = i;
        });
        s.isDirty = true;
      });
    },

    reorderGroups: (activeId, overId) => {
      set((s) => {
        const groups = s.todo.groups;
        const oldIdx = groups.findIndex((g: TodoGroup) => g.id === activeId);
        const newIdx = groups.findIndex((g: TodoGroup) => g.id === overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const [moved] = groups.splice(oldIdx, 1);
        groups.splice(newIdx, 0, moved);
        groups.forEach((g: TodoGroup, i: number) => {
          g.order = i;
        });
        s.isDirty = true;
      });
    },

    toggleGroupCollapse: (groupId) => {
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (group) {
          group.collapsed = !group.collapsed;
          s.isDirty = true;
        }
      });
    },

    // ── Item Actions ──

    addItem: (groupId, text = '') => {
      const newId = uuid();
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (!group) return;
        group.items.push({
          id: newId,
          text,
          completed: false,
          link: '',
          tags: [],
          order: group.items.length,
        });
        s.isDirty = true;
      });
      return newId;
    },

    updateItem: (groupId, itemId, patch) => {
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (!item) return;
        Object.assign(item, patch);
        s.isDirty = true;
      });
    },

    removeItem: (groupId, itemId) => {
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (!group) return;
        group.items = group.items.filter((it: TodoItem) => it.id !== itemId);
        group.items.forEach((it: TodoItem, i: number) => {
          it.order = i;
        });
        s.isDirty = true;
      });
    },

    toggleItem: (groupId, itemId) => {
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (!group) return;
        const item = group.items.find((it: TodoItem) => it.id === itemId);
        if (item) {
          item.completed = !item.completed;
          s.isDirty = true;
        }
      });
    },

    reorderItems: (groupId, activeId, overId) => {
      set((s) => {
        const group = s.todo.groups.find((g: TodoGroup) => g.id === groupId);
        if (!group) return;
        const items = group.items;
        const oldIdx = items.findIndex((it: TodoItem) => it.id === activeId);
        const newIdx = items.findIndex((it: TodoItem) => it.id === overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const [moved] = items.splice(oldIdx, 1);
        items.splice(newIdx, 0, moved);
        items.forEach((it: TodoItem, i: number) => {
          it.order = i;
        });
        s.isDirty = true;
      });
    },

    moveItemToGroup: (fromGroupId, toGroupId, itemId) => {
      set((s) => {
        const from = s.todo.groups.find((g: TodoGroup) => g.id === fromGroupId);
        const to = s.todo.groups.find((g: TodoGroup) => g.id === toGroupId);
        if (!from || !to) return;
        const idx = from.items.findIndex((it: TodoItem) => it.id === itemId);
        if (idx === -1) return;
        const [item] = from.items.splice(idx, 1);
        item.order = to.items.length;
        to.items.push(item);
        from.items.forEach((it: TodoItem, i: number) => {
          it.order = i;
        });
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
        set({
          currentTodoId: data.id,
          todoName: data.name,
          todo: { groups: todoData.groups || [] },
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
