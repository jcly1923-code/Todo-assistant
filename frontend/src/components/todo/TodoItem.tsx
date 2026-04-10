import { Check, Circle, Trash2, MapPin, Calendar, Edit3 } from 'lucide-react';
import type { Todo, TodoStatus } from '../../types/todo';
import { cn, formatDateTime } from '../../lib/utils';
import { useTodoStore } from '../../stores/todoStore';

const STATUS_ICONS: Record<TodoStatus, typeof Check> = {
  in_progress: Circle,
  completed: Check,
};

interface Props {
  todo: Todo;
  onEdit: (todo: Todo) => void;
}

export default function TodoItem({ todo, onEdit }: Props) {
  const { toggleStatus, removeTodo } = useTodoStore();
  const StatusIcon = STATUS_ICONS[todo.status];

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-4 rounded-2xl border transition-all duration-300',
        todo.status === 'completed'
          ? 'bg-white/60 backdrop-blur border-amber-100/50 opacity-75'
          : 'bg-white/80 backdrop-blur-sm border-amber-100/50 shadow-lg shadow-amber-100/50 hover:shadow-xl hover:shadow-amber-100/50 hover:-translate-y-0.5'
      )}
    >
      <div className="relative pt-0.5">
        <button
          onClick={() => toggleStatus(todo)}
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            todo.status === 'completed'
              ? 'border-emerald-500 bg-emerald-100 text-emerald-600'
              : 'border-amber-500 text-amber-600'
          )}
        >
          {todo.status === 'completed' && <StatusIcon size={14} />}
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-[15px] leading-snug text-stone-800',
            todo.status === 'completed' && 'line-through text-stone-500'
          )}
        >
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-sm text-stone-500 mt-0.5 truncate">{todo.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {todo.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: tag.color + '30', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {todo.due_date && (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <Calendar size={12} />
              <span className="text-stone-600">期望截止</span>
              {formatDateTime(todo.due_date)}
            </span>
          )}
          {todo.location && (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <MapPin size={12} />
              {todo.location}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(todo)}
          className="p-1.5 text-stone-500 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={() => removeTodo(todo.id)}
          className="p-1.5 text-stone-500 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
