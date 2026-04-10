import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import client from '../api/client';
import PasswordField from '../components/PasswordField';
import { getPasswordRuleError } from '../lib/passwordValidation';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  const [valid, setValid] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await client.get<{ valid: boolean }>('/auth/reset-password/validate', {
          params: { token },
        });
        if (!cancelled) setValid(data.valid);
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      await client.post('/auth/reset-password', { token, new_password: password });
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : '重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-amber-50/80 to-stone-100">
      <div className="flex items-center gap-2 mb-8 text-amber-600">
        <KeyRound size={28} />
        <span className="text-xl font-bold text-stone-800">重置密码</span>
      </div>
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl border border-amber-100 shadow-xl p-8">
        <p className="text-xs text-stone-500 mb-4 leading-relaxed">
          重置需使用<strong className="text-stone-600">带 token 的完整链接</strong>
          打开本页（由管理员在后台发起「发送重置」后，可从<strong className="text-stone-600">服务器日志</strong>
          复制 URL）。若忘记密码，请联系管理员获取链接。
        </p>
        {checking && (
          <div className="flex justify-center py-8 text-stone-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        {!checking && !token && (
          <div className="text-sm text-stone-700 space-y-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-3">
            <p>当前链接<strong className="text-amber-900">缺少 token</strong>，无法在此重置。</p>
            <p className="text-xs text-stone-600">
              请向管理员索取重置链接，或使用日志中的完整地址（含 <code className="text-amber-900">?token=</code>
              ）。从登录页「忘记密码」进入仅作说明，不能直接完成重置。
            </p>
          </div>
        )}
        {!checking && token && valid === false && (
          <p className="text-sm text-rose-600">链接无效或已过期，请联系管理员重新发送。</p>
        )}
        {!checking && token && valid === true && !done && (
          <>
            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-100">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField
                label="新密码"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                label="确认新密码"
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                autoComplete="new-password"
              />
              <p className="text-xs text-stone-500">6～72 位，须同时含大写与小写英文字母。</p>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : '确认重置'}
              </button>
            </form>
          </>
        )}
        {done && (
          <p className="text-sm text-emerald-700 font-medium">
            密码已更新，请使用新密码
            <Link to="/login" className="ml-1 text-amber-700 underline">
              登录
            </Link>
            。
          </p>
        )}
        <p className="text-center text-sm text-stone-500 mt-6">
          <Link to="/login" className="text-amber-700 font-medium hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
