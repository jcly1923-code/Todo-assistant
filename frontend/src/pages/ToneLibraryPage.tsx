import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  BookOpen,
  AlertCircle,
  FileText,
} from 'lucide-react';
import * as toneApi from '../api/tone';
import type { ToneStatus, WritingSample } from '../api/tone';
import { getApiErrorDetail } from '../lib/apiError';
import { cn } from '../lib/utils';

export default function ToneLibraryPage() {
  const [status, setStatus] = useState<ToneStatus | null>(null);
  const [samples, setSamples] = useState<WritingSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [st, list] = await Promise.all([toneApi.fetchToneStatus(), toneApi.fetchWritingSamples()]);
      setStatus(st);
      setSamples(list);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setError('请填写标题与正文');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await toneApi.createWritingSample({ title: t, body: b });
      setTitle('');
      setBody('');
      await load();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '添加失败');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (!status) return;
    setBusy(true);
    setError('');
    try {
      const st = await toneApi.patchToneSettings(!status.tone_enabled);
      setStatus(st);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '更新失败');
    } finally {
      setBusy(false);
    }
  };

  const handleRebuild = async () => {
    setBusy(true);
    setError('');
    try {
      const st = await toneApi.rebuildToneProfile();
      setStatus(st);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '重建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除这条自写日报吗？')) return;
    setBusy(true);
    setError('');
    try {
      await toneApi.deleteWritingSample(id);
      if (editingId === id) {
        setEditingId(null);
      }
      await load();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '删除失败');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('确定清空全部自写日报并重置语气库吗？此操作不可恢复。')) return;
    setBusy(true);
    setError('');
    try {
      await toneApi.clearWritingSamples();
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '清空失败');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: WritingSample) => {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditBody(s.body);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const t = editTitle.trim();
    const b = editBody.trim();
    if (!t || !b) {
      setError('标题与正文不能为空');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await toneApi.updateWritingSample(editingId, { title: t, body: b });
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-stone-500">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const atMax = status != null && status.sample_count >= status.samples_max;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-amber-100/90 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30 shadow-lg shadow-amber-100/40">
        <div className="border-b border-amber-100/80 bg-white/60 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200/50">
              <BookOpen size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">语气库</h1>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                粘贴或录入你亲自写的日报作为训练素材；系统会提炼语气摘要，在生成日报/周报时
                <span className="font-medium text-stone-700">仅润色措辞</span>，不改变待办事实。
              </p>
              <p className="mt-2 text-sm text-stone-600">
                <Link to="/reports" className="font-medium text-amber-700 hover:underline">
                  返回报告
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-amber-100/80 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">语气开关与摘要</h2>
        <p className="mt-1 text-sm text-stone-500">
          已保存 {status?.sample_count ?? 0} / {status?.samples_max ?? 30} 条素材
          {status?.profile_updated_at
            ? ` · 摘要更新于 ${new Date(status.profile_updated_at).toLocaleString('zh-CN')}`
            : ''}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || !status?.sample_count}
            onClick={handleToggle}
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
              status?.tone_enabled
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'border border-amber-200 bg-stone-50 text-stone-700 hover:bg-amber-50'
            )}
          >
            {status?.tone_enabled ? '已开启：生成报告时使用语气' : '未开启：点击开启'}
          </button>
          <button
            type="button"
            disabled={busy || !status?.sample_count}
            onClick={handleRebuild}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            重新学习
          </button>
        </div>
        {status?.last_error ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            上次学习失败：{status.last_error}
          </p>
        ) : null}
        {status?.profile_text ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">当前语气摘要</p>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-800">
              {status.profile_text}
            </pre>
          </div>
        ) : status && status.sample_count > 0 ? (
          <p className="mt-4 text-sm text-stone-500">暂无摘要，请点击「重新学习」（需已配置 AI）。</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-amber-100/80 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">添加自写日报</h2>
        <div className="mt-3 space-y-3">
          <input
            type="text"
            placeholder="标题（如：2026-04-03 工作记录）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy || atMax}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none ring-amber-400/0 transition focus:border-amber-300 focus:ring-2 focus:ring-amber-400/30 disabled:bg-stone-50"
          />
          <textarea
            placeholder="正文（你的真实日报内容，系统只学语气不学具体业务细节）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy || atMax}
            rows={8}
            className="w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none ring-amber-400/0 transition focus:border-amber-300 focus:ring-2 focus:ring-amber-400/30 disabled:bg-stone-50"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || atMax}
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-amber-200/50 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              保存素材
            </button>
            {atMax ? (
              <span className="self-center text-sm text-amber-800">已达上限，请删除旧条目后再添加。</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100/80 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900">已保存素材</h2>
          {samples.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleClearAll}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              清空全部
            </button>
          ) : null}
        </div>
        {samples.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">暂无素材。可从历史日报复制粘贴到上方表单。</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {samples.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-stone-200/90 bg-stone-50/50 p-4"
              >
                {editingId === s.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={busy}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      disabled={busy}
                      rows={6}
                      className="w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={saveEdit}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-white disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <span className="font-medium text-stone-900">{s.title}</span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(s)}
                          className="text-sm font-medium text-amber-700 hover:underline disabled:opacity-50"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(s.id)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          aria-label="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                      {s.body.length > 400 ? `${s.body.slice(0, 400)}…` : s.body}
                    </p>
                    <p className="mt-2 text-xs text-stone-400">
                      更新于 {new Date(s.updated_at).toLocaleString('zh-CN')}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
