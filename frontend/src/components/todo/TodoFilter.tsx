import { Filter, X } from 'lucide-react';
import type { TodoStatus } from '../../types/todo';
import { STATUS_MAP } from '../../types/todo';
import { cn } from '../../lib/utils';
import { useTodoStore } from '../../stores/todoStore';
import { useTagStore } from '../../stores/tagStore';

const FILTER_STATUSES: TodoStatus[] = ['in_progress', 'completed'];

export default function TodoFilter() {
  const { filter, setFilter } = useTodoStore();
  const { tags } = useTagStore();

  const hasFilter = filter.status || filter.tag_id;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-stone-500 flex items-center gap-1">
        <Filter size={12} /> 筛选
      </span>

      {FILTER_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => setFilter({ ...filter, status: filter.status === s ? undefined : s })}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border-2 transition-colors',
            filter.status === s
              ? `${STATUS_MAP[s].color} ${STATUS_MAP[s].bg} border-amber-300`
              : 'border-amber-200 text-stone-600 hover:text-amber-700 hover:bg-amber-50'
          )}
        >
          {STATUS_MAP[s].label}
        </button>
      ))}

      <span className="w-px h-4 bg-amber-200" />

      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() =>
            setFilter({ ...filter, tag_id: filter.tag_id === tag.id ? undefined : tag.id })
          }
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            filter.tag_id === tag.id
              ? 'border-amber-400'
              : 'border-amber-200 opacity-70 hover:opacity-100'
          )}
          style={{
            color: tag.color,
            backgroundColor:
              filter.tag_id === tag.id ? tag.color + '30' : tag.color + '15',
          }}
        >
          {tag.name}
        </button>
      ))}

      {hasFilter && (
        <button
          onClick={() => setFilter({})}
          className="text-xs text-stone-500 hover:text-amber-600 flex items-center gap-0.5 ml-1"
        >
          <X size={12} /> 清除
        </button>
      )}
    </div>
  );
}
