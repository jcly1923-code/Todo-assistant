import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { Todo, TodoCreate, TodoUpdate } from '../../types/todo';
import { cn, getLocalDateKey, formatCreatedDayKey } from '../../lib/utils';
import { useTodoStore } from '../../stores/todoStore';
import { useTagStore } from '../../stores/tagStore';

interface Props {
  todo?: Todo | null;
  onClose: () => void;
}

export default function TodoForm({ todo, onClose }: Props) {
  const { addTodo, editTodo } = useTodoStore();
  const { tags, addTag } = useTagStore();
  const isEditing = !!todo;

  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [location, setLocation] = useState(todo?.location ?? '');
  const [createdDate, setCreatedDate] = useState(
    () => (todo ? formatCreatedDayKey(todo.created_at) : getLocalDateKey())
  );
  const [dueDate, setDueDate] = useState(todo?.due_date?.slice(0, 16) ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    todo?.tags.map((t) => t.id) ?? []
  );
  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (todo) {
      setCreatedDate(formatCreatedDayKey(todo.created_at));
    } else {
      setCreatedDate(getLocalDateKey());
    }
  }, [todo?.id]);

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const colors = ['#f59e0b', '#f97316', '#e11d48', '#22c55e', '#3b82f6', '#8b5cf6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const tag = await addTag({ name: newTagName.trim(), color });
    setSelectedTagIds((prev) => [...prev, tag.id]);
    setNewTagName('');
    setShowTagInput(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const [y, m, d] = createdDate.split('-').map(Number);
      const createdAtIso = new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        due_date: dueDate || undefined,
        created_at: createdAtIso,
        tag_ids: selectedTagIds,
      };
      if (isEditing) {
        await editTodo(todo!.id, payload as TodoUpdate);
      } else {
        await addTodo(payload as TodoCreate);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="max-h-[min(92dvh,100%)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-amber-100/50 bg-white shadow-2xl shadow-amber-100/50 sm:rounded-2xl sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-0 sm:p-5">
          <h2 className="text-lg font-bold text-amber-900">
            {isEditing ? '编辑待办' : '新建待办'}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="待办标题..."
            className="w-full px-4 py-3 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 placeholder-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 focus:bg-white transition-all duration-200 outline-none"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述（可选）"
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 placeholder-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 focus:bg-white resize-none transition-all duration-200 outline-none"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-stone-500 mb-1.5 block">创建日期</label>
              <input
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none [color-scheme:light]"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1.5 block">期望截止时间</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none [color-scheme:light]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1.5 block">地点</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="可选"
              className="w-full px-3 py-2 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 text-sm placeholder-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1.5 block">标签</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border-2 transition-colors font-medium',
                    selectedTagIds.includes(tag.id)
                      ? 'border-amber-400'
                      : 'border-amber-200 opacity-60 hover:opacity-100'
                  )}
                  style={{
                    color: tag.color,
                    backgroundColor: selectedTagIds.includes(tag.id) ? tag.color + '25' : tag.color + '10',
                  }}
                >
                  {tag.name}
                </button>
              ))}
              {showTagInput ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    placeholder="标签名"
                    className="w-20 px-2 py-0.5 rounded-lg border-2 border-amber-200 text-stone-700 text-xs focus:outline-none focus:border-amber-400"
                  />
                  <button onClick={handleCreateTag} className="text-emerald-600 text-xs font-medium">
                    确定
                  </button>
                  <button onClick={() => setShowTagInput(false)} className="text-stone-500 text-xs">
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="text-xs px-2.5 py-1 rounded-full border-2 border-dashed border-amber-200 text-amber-600 hover:bg-amber-50 flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} />
                  新标签
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-amber-100/60 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:border-t-0 sm:px-5 sm:pb-5 sm:pt-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-500 hover:text-amber-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium rounded-full shadow-lg shadow-amber-200 hover:shadow-xl hover:shadow-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {saving ? '保存中...' : isEditing ? '保存修改' : '创建待办'}
          </button>
        </div>
      </div>
    </div>
  );
}
