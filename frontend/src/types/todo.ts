export type TodoStatus = 'in_progress' | 'completed';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  status: TodoStatus;
  location: string | null;
  due_date: string | null;
  tags: Tag[];
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface TodoCreate {
  title: string;
  description?: string;
  status?: TodoStatus;
  location?: string;
  due_date?: string;
  created_at?: string;
  tag_ids?: number[];
}

export interface TodoUpdate {
  title?: string;
  description?: string;
  status?: TodoStatus;
  location?: string;
  due_date?: string;
  created_at?: string;
  tag_ids?: number[];
}

export interface TodoStats {
  total: number;
  in_progress: number;
  completed: number;
}

export interface TagCreate {
  name: string;
  color?: string;
}

export const STATUS_MAP: Record<TodoStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: '进行中', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: '已完成', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};
