import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { useTodoStore } from '../stores/todoStore';
import { useTagStore } from '../stores/tagStore';
import TodoItem from '../components/todo/TodoItem';
import TodoForm from '../components/todo/TodoForm';
import TodoFilter from '../components/todo/TodoFilter';
import QuickAdd from '../components/todo/QuickAdd';
import type { Todo } from '../types/todo';
import { groupTodosByCreatedDay, formatCreatedDayLabel } from '../lib/utils';

const ONBOARDING_TIP_KEY = 'todo_app_onboarding_tip_v1';

export default function TodoPage() {
  const {
    todos,
    stats,
    loading,
    loadTodos,
    loadStats,
    loadMoreCompleted,
    collapseCompleted,
    expandCompleted,
    filter,
  } = useTodoStore();
  const { loadTags } = useTagStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showOnboardingTip, setShowOnboardingTip] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_TIP_KEY);
    } catch {
      return false;
    }
  });

  const dismissOnboardingTip = () => {
    try {
      localStorage.setItem(ONBOARDING_TIP_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowOnboardingTip(false);
  };

  useEffect(() => {
    loadTodos();
    loadStats();
    loadTags();
  }, []);

  const grouped = useMemo(() => groupTodosByCreatedDay(todos), [todos]);

  const showExpandControls = filter.status !== 'in_progress';
  const showLoadMore = !expandCompleted && showExpandControls;
  const showCollapse = expandCompleted && showExpandControls;

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTodo(null);
  };

  return (
    <div className="space-y-5">
      {showOnboardingTip && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-stone-700 shadow-sm">
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-medium text-amber-900">提示：</span>
            在「待办」中记录任务后，可在
            <Link
              to="/reports"
              className="mx-0.5 font-medium text-amber-800 underline underline-offset-2"
            >
              报告
            </Link>
            页使用 AI 生成日报与周报。
          </p>
          <button
            type="button"
            onClick={dismissOnboardingTip}
            className="shrink-0 rounded-lg p-1 text-stone-500 hover:bg-amber-100/80 hover:text-stone-700"
            aria-label="关闭提示"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: '总计', value: stats.total, color: 'text-stone-800' },
          { label: '进行中', value: stats.in_progress, color: 'text-amber-600' },
          { label: '已完成', value: stats.completed, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-amber-100/50 bg-white/80 px-2 py-3 text-center shadow-lg shadow-amber-100/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-amber-100/50 sm:rounded-2xl sm:px-4"
          >
            <div className={`text-xl font-bold tabular-nums sm:text-2xl ${color}`}>{value}</div>
            <div className="mt-0.5 text-[10px] text-stone-500 sm:text-xs">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick Add */}
      <QuickAdd onOpenForm={() => setShowForm(true)} />

      {/* Filters */}
      <TodoFilter />

      {/* Todo List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={24} />
        </div>
      ) : todos.length === 0 ? (
        <div className="text-center py-20 text-stone-600 bg-white/60 backdrop-blur rounded-2xl border border-amber-100">
          <p className="text-lg font-medium">暂无待办</p>
          <p className="text-sm mt-1">点击上方输入框开始添加任务</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ dayKey, todos: dayTodos }) => (
            <section key={dayKey}>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 px-1">
                {formatCreatedDayLabel(dayKey)}
              </h2>
              <div className="space-y-2">
                {dayTodos.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onEdit={handleEdit} />
                ))}
              </div>
            </section>
          ))}
          {showLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => loadMoreCompleted()}
                className="text-sm font-medium text-amber-700 hover:text-amber-900 px-4 py-2 rounded-full border border-amber-200 bg-white/80 hover:bg-amber-50/80 transition-colors"
              >
                查看更多
              </button>
            </div>
          )}
          {showCollapse && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => collapseCompleted()}
                className="text-sm font-medium text-stone-600 hover:text-stone-800 px-4 py-2 rounded-full border border-stone-200 bg-white/80 hover:bg-stone-50/80 transition-colors"
              >
                收起
              </button>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && <TodoForm todo={editingTodo} onClose={handleCloseForm} />}
    </div>
  );
}
