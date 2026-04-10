import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import * as authApi from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import PasswordField from '../components/PasswordField';
import { getPasswordRuleError } from '../lib/passwordValidation';

export default function RegisterPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const rule = getPasswordRuleError(password);
    if (rule) {
      setError(rule);
      return;
    }
    if (password !== passwordConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(email.trim(), password);
      setAuth(res.access_token, res.user);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-amber-50/80 to-stone-100">
      <div className="flex items-center gap-2 mb-8 text-amber-600">
        <ClipboardList size={32} />
        <span className="text-xl font-bold text-stone-800">待办助手</span>
      </div>
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl border border-amber-100 shadow-xl shadow-amber-100/50 p-8">
        <h1 className="text-lg font-bold text-stone-800 mb-1">注册</h1>
        <p className="text-sm text-stone-500 mb-6">
          创建账户后数据仅本人可见。密码需 6～72 位且同时含大写与小写字母。
        </p>
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-100">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-stone-500 block mb-1">邮箱</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-amber-100 focus:border-amber-400 outline-none text-stone-800"
            />
          </div>
          <PasswordField
            label="密码"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label="确认密码"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium shadow-lg shadow-amber-200 hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : '注册并登录'}
          </button>
        </form>
        <p className="text-center text-sm text-stone-500 mt-6">
          已有账户？{' '}
          <Link to="/login" className="text-amber-700 font-medium hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
