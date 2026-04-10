import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTodoStore } from '../../stores/todoStore';

interface Props {
  onOpenForm: () => void;
}

export default function QuickAdd({ onOpenForm }: Props) {
  const { addTodo } = useTodoStore();
  const [value, setValue] = useState('');

  const handleQuickAdd = async () => {
    if (!value.trim()) return;
    await addTodo({ title: value.trim(), status: 'in_progress' });
    setValue('');
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
        placeholder="快速添加待办，回车确认..."
        className="w-full min-w-0 flex-1 px-4 py-3 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 placeholder-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 focus:bg-white transition-all duration-200 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      />
      <button
        type="button"
        onClick={onOpenForm}
        className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-2.5 font-medium text-white shadow-lg shadow-amber-200 transition-all duration-200 hover:shadow-xl hover:shadow-amber-300 hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:hover:scale-105 sm:active:scale-95"
      >
        <Plus size={16} />
        详细创建
      </button>
    </div>
  );
}
