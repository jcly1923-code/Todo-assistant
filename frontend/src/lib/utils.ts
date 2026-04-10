import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Todo } from '../types/todo';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCreatedDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地日历「今天」的 yyyy-mm-dd，用于新建待办默认创建日 */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地「明天」12:00 的 ISO 时间，用于创建日=明日 */
export function localTomorrowNoonIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function formatCreatedDayLabel(dayKey: string): string {
  const [ys, ms, ds] = dayKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ref = new Date(date);
  ref.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - ref.getTime()) / (86400 * 1000));
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === -1) return '明天';
  if (diffDays === -2) return '后天';
  if (diffDays < 0) {
    return date.toLocaleDateString('zh-CN', { weekday: 'short', month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('zh-CN', { weekday: 'short', month: 'long', day: 'numeric' });
}

function sortCreatedDayKeys(keys: string[]): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parse = (k: string) => {
    const [ys, ms, ds] = k.split('-').map(Number);
    return new Date(ys, ms - 1, ds);
  };
  const rank = (k: string): [number, number] => {
    const d = parse(k);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / (86400 * 1000));
    if (diffDays === 0) return [0, 0];
    if (diffDays > 0) return [1, diffDays];
    return [2, -diffDays];
  };
  return [...keys].sort((a, b) => {
    const [ta, ra] = rank(a);
    const [tb, rb] = rank(b);
    if (ta !== tb) return ta - tb;
    return ra - rb;
  });
}

export function groupTodosByCreatedDay(todos: Todo[]): { dayKey: string; todos: Todo[] }[] {
  const map = new Map<string, Todo[]>();
  for (const t of todos) {
    const k = formatCreatedDayKey(t.created_at);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  const keys = sortCreatedDayKeys([...map.keys()]);
  return keys.map((dayKey) => ({ dayKey, todos: map.get(dayKey)! }));
}
