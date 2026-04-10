import { create } from 'zustand';
import type { Todo, TodoCreate, TodoUpdate, TodoStats, TodoStatus } from '../types/todo';
import * as api from '../api/todos';

interface TodoFilter {
  status?: TodoStatus;
  tag_id?: number;
  due_date?: string;
}

interface TodoState {
  todos: Todo[];
  stats: TodoStats;
  filter: TodoFilter;
  expandCompleted: boolean;
  loading: boolean;

  setFilter: (filter: TodoFilter) => void;
  loadMoreCompleted: () => Promise<void>;
  collapseCompleted: () => Promise<void>;
  loadTodos: () => Promise<void>;
  loadStats: () => Promise<void>;
  addTodo: (payload: TodoCreate) => Promise<void>;
  editTodo: (id: number, payload: TodoUpdate) => Promise<void>;
  removeTodo: (id: number) => Promise<void>;
  toggleStatus: (todo: Todo) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  stats: { total: 0, completed: 0, in_progress: 0 },
  filter: {},
  expandCompleted: false,
  loading: false,

  setFilter: (filter) => {
    set({ filter, expandCompleted: false });
    get().loadTodos();
  },

  loadMoreCompleted: async () => {
    set({ expandCompleted: true });
    await get().loadTodos();
  },

  collapseCompleted: async () => {
    set({ expandCompleted: false });
    await get().loadTodos();
  },

  loadTodos: async () => {
    set({ loading: true });
    try {
      const { filter, expandCompleted } = get();
      const todos = await api.fetchTodos({
        ...filter,
        expand_completed: expandCompleted,
      });
      set({ todos });
    } finally {
      set({ loading: false });
    }
  },

  loadStats: async () => {
    const stats = await api.fetchTodoStats();
    set({ stats });
  },

  addTodo: async (payload) => {
    await api.createTodo(payload);
    await Promise.all([get().loadTodos(), get().loadStats()]);
  },

  editTodo: async (id, payload) => {
    await api.updateTodo(id, payload);
    await Promise.all([get().loadTodos(), get().loadStats()]);
  },

  removeTodo: async (id) => {
    await api.deleteTodo(id);
    await Promise.all([get().loadTodos(), get().loadStats()]);
  },

  toggleStatus: async (todo) => {
    const next = todo.status === 'completed' ? 'in_progress' : 'completed';
    await api.updateTodo(todo.id, { status: next });
    await Promise.all([get().loadTodos(), get().loadStats()]);
  },
}));
