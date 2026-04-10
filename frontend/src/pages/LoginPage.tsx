import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import * as authApi from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import PasswordField from '../components/PasswordField';

export default function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      setAuth(res.access_token, res.user);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : '登录失败');
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
        <h1 className="text-lg font-bold text-stone-800 mb-1">登录</h1>
        <p className="text-sm text-stone-500 mb-6">使用邮箱与密码进入账户</p>
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
            autoComplete="current-password"
          />
          <div className="flex justify-end -mt-1">
            <Link
              to="/reset-password"
              className="text-xs text-amber-700 font-medium hover:underline"
            >
              忘记密码？
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium shadow-lg shadow-amber-200 hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : '登录'}
          </button>
        </form>
        <p className="text-center text-sm text-stone-500 mt-6">
          还没有账户？{' '}
          <Link to="/register" className="text-amber-700 font-medium hover:underline">
            注册
          </Link>
        </p>
        <p className="text-center text-xs text-stone-400 mt-3">
          <Link to="/admin/login" className="hover:text-stone-600 hover:underline">
            管理后台
          </Link>
        </p>
      </div>
    </div>
  );
}
