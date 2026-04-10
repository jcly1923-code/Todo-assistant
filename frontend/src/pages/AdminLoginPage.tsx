import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2, Shield } from 'lucide-react';
import * as adminApi from '../api/admin';
import { useAdminStore } from '../stores/adminStore';
import PasswordField from '../components/PasswordField';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const token = useAdminStore((s) => s.token);
  const setAuth = useAdminStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/admin/users" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.adminLogin(email.trim(), password);
      setAuth(res.access_token, res.admin);
      navigate('/admin/users', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-slate-900/95 to-slate-800">
      <div className="flex items-center gap-2 mb-8 text-slate-300">
        <Shield size={28} className="text-amber-400" />
        <span className="text-xl font-bold text-white">管理后台</span>
      </div>
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-xl p-8">
        <p className="text-xs text-slate-500 mb-4">
          与业务账户独立。初始管理员由后端通过环境变量创建（见 README 中 ADMIN_BOOTSTRAP_*）；生产环境须显式配置。
        </p>
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-100">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">管理员邮箱</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 outline-none text-slate-800"
            />
          </div>
          <PasswordField
            label="密码"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            className="border-slate-200 focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : '登录'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="inline-flex items-center gap-1 text-amber-700 font-medium hover:underline">
            <ClipboardList size={14} />
            返回用户登录
          </Link>
        </p>
      </div>
    </div>
  );
}
