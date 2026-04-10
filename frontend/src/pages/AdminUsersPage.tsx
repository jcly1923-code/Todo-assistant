import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, RefreshCw, Shield, Send } from 'lucide-react';
import CenterToast from '../components/CenterToast';
import * as adminApi from '../api/admin';
import type { AdminUserRow } from '../api/admin';
import { useAdminStore } from '../stores/adminStore';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const token = useAdminStore((s) => s.token);
  const admin = useAdminStore((s) => s.admin);
  const logout = useAdminStore((s) => s.logout);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.adminListUsers(0, 200);
      setRows(res.items);
      setTotal(res.total);
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const toggleActive = async (row: AdminUserRow) => {
    setBusyId(row.id);
    try {
      const updated = await adminApi.adminPatchUser(row.id, { is_active: !row.is_active });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setToast(updated.is_active ? '已启用' : '已禁用');
    } catch {
      setToast('更新失败');
    } finally {
      setBusyId(null);
    }
  };

  const sendReset = async (row: AdminUserRow) => {
    setBusyId(row.id);
    try {
      const r = await adminApi.adminRequestPasswordReset(row.id);
      setToast(r.message);
    } catch {
      setToast('请求失败');
    } finally {
      setBusyId(null);
    }
  };

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CenterToast message={toast} />
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Shield size={20} className="text-amber-400 shrink-0" />
          <span className="font-semibold truncate">用户管理</span>
          <span className="text-slate-400 text-sm truncate hidden sm:inline">{admin?.email}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/"
            className="text-sm text-slate-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10"
          >
            用户端
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <LogOut size={16} />
            退出
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">共 {total} 个业务用户（不展示待办数据）</p>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-20 text-slate-500">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">邮箱</th>
                  <th className="px-3 py-2 font-medium">注册时间</th>
                  <th className="px-3 py-2 font-medium">最近登录</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{row.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{row.email}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {row.last_login_at
                        ? new Date(row.last_login_at).toLocaleString('zh-CN')
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.is_active
                            ? 'text-emerald-600 font-medium'
                            : 'text-rose-600 font-medium'
                        }
                      >
                        {row.is_active ? '正常' : '已禁用'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => toggleActive(row)}
                          className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                        >
                          {row.is_active ? '禁用' : '启用'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => sendReset(row)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        >
                          <Send size={12} />
                          发送重置链接
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="text-center py-10 text-slate-500">暂无用户</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
