import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  id?: string;
  className?: string;
};

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  required = true,
  id: idProp,
  className = '',
}: Props) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="text-xs text-stone-500 block mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`w-full px-4 py-3 pr-11 rounded-xl border-2 border-amber-100 focus:border-amber-400 outline-none text-stone-800 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-amber-600 p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
