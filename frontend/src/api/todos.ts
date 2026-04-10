import client from './client';
import type { Todo, TodoCreate, TodoUpdate, TodoStats, TodoStatus } from '../types/todo';

export async function fetchTodos(params?: {
  status?: TodoStatus;
  tag_id?: number;
  due_date?: string;
  expand_completed?: boolean;
}): Promise<Todo[]> {
  const { data } = await client.get('/todos/', { params });
  return data;
}

export async function fetchTodoStats(): Promise<TodoStats> {
  const { data } = await client.get('/todos/stats/summary');
  return data;
}

export async function createTodo(payload: TodoCreate): Promise<Todo> {
  const { data } = await client.post('/todos/', payload);
  return data;
}

export async function updateTodo(id: number, payload: TodoUpdate): Promise<Todo> {
  const { data } = await client.put(`/todos/${id}`, payload);
  return data;
}

export async function deleteTodo(id: number): Promise<void> {
  await client.delete(`/todos/${id}`);
}
