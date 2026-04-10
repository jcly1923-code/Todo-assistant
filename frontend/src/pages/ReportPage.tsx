import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import * as reportsApi from '../api/reports';
import type { DailyReport, WeeklyReport } from '../api/reports';
import { getRuntimeAIConfig } from '../api/settings';
import { createTodo } from '../api/todos';
import { ReportMarkdownContent } from '../components/report/ReportMarkdown';
import { getApiErrorDetail } from '../lib/apiError';
import { cn, getLocalDateKey, localTomorrowNoonIso } from '../lib/utils';

const TOMORROW_STORAGE_KEY = 'daily_tomorrow_suggestions_v1';

type PendingTomorrow = {
  reportDate: string;
  generatedOn: string;
  items: { id: string; title: string }[];
};

type Tab = 'daily' | 'weekly';

export default function ReportPage() {
  const [tab, setTab] = useState<Tab>('daily');
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [pendingTomorrow, setPendingTomorrow] = useState<PendingTomorrow | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState('');

  const persistPendingTomorrow = useCallback((p: PendingTomorrow | null) => {
    if (p && p.items.length > 0) {
      sessionStorage.setItem(TOMORROW_STORAGE_KEY, JSON.stringify(p));
    } else {
      sessionStorage.removeItem(TOMORROW_STORAGE_KEY);
    }
  }, []);

  const clearPendingIfStale = useCallback(() => {
    setPendingTomorrow((prev) => {
      if (!prev) return null;
      if (getLocalDateKey() !== prev.generatedOn) {
        sessionStorage.removeItem(TOMORROW_STORAGE_KEY);
        return null;
      }
      return prev;
    });
  }, []);

  const loadDaily = async () => {
    try {
      const list = await reportsApi.fetchDailyReports();
      setDailyReports(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载日报失败');
    }
  };

  const loadWeekly = async () => {
    try {
      const list = await reportsApi.fetchWeeklyReports();
      setWeeklyReports(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载周报失败');
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([loadDaily(), loadWeekly()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TOMORROW_STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as PendingTomorrow;
      if (p.generatedOn === getLocalDateKey() && p.items?.length) {
        setPendingTomorrow(p);
      } else {
        sessionStorage.removeItem(TOMORROW_STORAGE_KEY);
      }
    } catch {
      sessionStorage.removeItem(TOMORROW_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => clearPendingIfStale(), 60_000);
    return () => clearInterval(t);
  }, [clearPendingIfStale]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') clearPendingIfStale();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [clearPendingIfStale]);

  const handleGenerateDaily = async () => {
    setGenerating(true);
    setError('');
    setAcceptError('');
    try {
      const report = await reportsApi.generateDailyReport(undefined, getRuntimeAIConfig());
      setDailyReports((prev) => [report, ...prev]);
      setExpandedId(report.report_date);
      const list = report.tomorrow_suggestions ?? [];
      if (list.length > 0) {
        const genOn = getLocalDateKey();
        const next: PendingTomorrow = {
          reportDate: report.report_date,
          generatedOn: genOn,
          items: list.map((s, i) => ({
            id: `s-${report.report_date}-${i}-${s.title.slice(0, 12)}`,
            title: s.title,
          })),
        };
        setPendingTomorrow(next);
        persistPendingTomorrow(next);
      } else {
        setPendingTomorrow(null);
        persistPendingTomorrow(null);
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '生成日报失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptSuggestion = async (itemId: string, reportDate: string) => {
    setAcceptingId(itemId);
    setAcceptError('');
    try {
      const serverIdx = itemId.match(/^server:[\d-]+:(\d+)$/);
      if (serverIdx) {
        const idx = Number(serverIdx[1]);
        const report = dailyReports.find((d) => d.report_date === reportDate);
        const list = report?.tomorrow_suggestions ?? [];
        const item = list[idx];
        if (!item?.title?.trim()) return;
        await createTodo({
          title: item.title.trim(),
          status: 'in_progress',
          created_at: localTomorrowNoonIso(),
        });
        const rest = list.filter((_, i) => i !== idx);
        const updated = await reportsApi.updateDailyTomorrowSuggestions(reportDate, rest);
        setDailyReports((prev) =>
          prev.map((d) => (d.report_date === reportDate ? updated : d))
        );
        return;
      }

      if (!pendingTomorrow) return;
      const item = pendingTomorrow.items.find((x) => x.id === itemId);
      if (!item) return;
      await createTodo({
        title: item.title,
        status: 'in_progress',
        created_at: localTomorrowNoonIso(),
      });
      const rest = pendingTomorrow.items.filter((x) => x.id !== itemId);
      if (rest.length === 0) {
        setPendingTomorrow(null);
        persistPendingTomorrow(null);
      } else {
        const next = { ...pendingTomorrow, items: rest };
        setPendingTomorrow(next);
        persistPendingTomorrow(next);
      }
    } catch (e: unknown) {
      setAcceptError(getApiErrorDetail(e) || '创建待办失败');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleGenerateWeekly = async () => {
    setGenerating(true);
    setError('');
    try {
      const report = await reportsApi.generateWeeklyReport(undefined, getRuntimeAIConfig());
      setWeeklyReports((prev) => [report, ...prev]);
      setExpandedId(report.id);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) || '生成周报失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDaily = async (date: string) => {
    if (!window.confirm('确定删除该日报吗？此操作不可恢复。')) return;
    try {
      await reportsApi.deleteDailyReport(date);
      setDailyReports((prev) => prev.filter((r) => r.report_date !== date));
      setPendingTomorrow((p) => {
        if (p?.reportDate === date) {
          sessionStorage.removeItem(TOMORROW_STORAGE_KEY);
          return null;
        }
        return p;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleDeleteWeekly = async (id: number) => {
    if (!window.confirm('确定删除该周报吗？此操作不可恢复。')) return;
    try {
      await reportsApi.deleteWeeklyReport(id);
      setWeeklyReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatWeek = (start: string, end: string) =>
    `${new Date(start).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} - ${new Date(end).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-amber-100/90 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30 shadow-lg shadow-amber-100/40">
        <div className="border-b border-amber-100/80 bg-white/60 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200/50">
              <Sparkles size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">报告</h1>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                由 AI 根据待办生成，可展开阅读、复制全文；支持 Markdown 排版。
              </p>
              <p className="mt-2 text-sm text-stone-600">
                <Link to="/tone" className="font-medium text-amber-700 hover:underline">
                  语气库
                </Link>
                ：用自写日报训练语气，生成时仅润色措辞、不改变事实。
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="inline-flex w-full rounded-xl border border-amber-200/80 bg-stone-100/60 p-1 sm:w-auto"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'daily'}
                onClick={() => setTab('daily')}
                disabled={loading || generating}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 sm:flex-initial',
                  tab === 'daily'
                    ? 'bg-white text-amber-900 shadow-sm ring-1 ring-amber-200/80'
                    : 'text-stone-600 hover:bg-white/70 hover:text-stone-800'
                )}
              >
                <Calendar size={16} className="shrink-0 opacity-80" />
                日报
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'weekly'}
                onClick={() => setTab('weekly')}
                disabled={loading || generating}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 sm:flex-initial',
                  tab === 'weekly'
                    ? 'bg-white text-amber-900 shadow-sm ring-1 ring-amber-200/80'
                    : 'text-stone-600 hover:bg-white/70 hover:text-stone-800'
                )}
              >
                <FileText size={16} className="shrink-0 opacity-80" />
                周报
              </button>
            </div>
            <button
              type="button"
              onClick={tab === 'daily' ? handleGenerateDaily : handleGenerateWeekly}
              disabled={loading || generating}
              aria-busy={generating}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-300/40 transition hover:from-amber-500 hover:to-orange-600 hover:shadow-xl disabled:opacity-50 sm:w-auto"
            >
              <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent transition-opacity',
                    generating ? 'opacity-100 animate-spin' : 'opacity-0'
                  )}
                />
                <Plus
                  size={16}
                  className={cn('absolute transition-opacity', generating ? 'opacity-0' : 'opacity-100')}
                />
              </span>
              {generating
                ? tab === 'daily'
                  ? '正在生成日报…'
                  : '正在生成周报…'
                : tab === 'daily'
                  ? '生成日报'
                  : '生成周报'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-stone-500 sm:text-[13px]">
        日报、周报根据<strong className="font-medium text-stone-600">待办与完成情况</strong>
        由 AI 生成；若待办为空或很少，生成内容可能较简略。请先前往
        <Link to="/" className="mx-0.5 font-medium text-amber-800 underline underline-offset-2">
          待办
        </Link>
        补充任务。
      </p>

      {generating && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-2 rounded-xl border-2 border-amber-300 bg-amber-50/90 px-3 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:px-4"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-600 sm:h-[22px] sm:w-[22px]" />
          <span className="text-xs font-medium leading-relaxed sm:text-sm">
            {tab === 'daily'
              ? '正在根据待办调用 AI 生成日报，可能需要数十秒，请勿关闭页面。'
              : '正在根据本周待办调用 AI 生成周报，可能需要数十秒，请勿关闭页面。'}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>{error}</p>
          <p className="mt-2 text-xs text-stone-600 leading-relaxed">
            若与 AI 配置或网络有关，可前往
            <Link
              to="/settings"
              className="mx-0.5 font-medium text-amber-900 underline underline-offset-2"
            >
              设置
            </Link>
            检查本地 API Key、模型与网络；定时生成另需在设置中上传自动化凭据。
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={28} />
        </div>
      ) : tab === 'daily' ? (
        <div className="space-y-4">
          {dailyReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white/80 px-6 py-16 text-center text-stone-600">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-600 shadow-inner">
                <Calendar size={32} strokeWidth={1.5} />
              </div>
              <p className="text-base font-semibold text-stone-800">暂无日报</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
                内容依据<strong className="text-stone-700">待办</strong>生成；请先在「待办」中添加任务，再点击上方「生成日报」。
              </p>
            </div>
          ) : (
            dailyReports.map((r) => {
              const localToday = getLocalDateKey();
              const usePending =
                !!(
                  pendingTomorrow &&
                  pendingTomorrow.reportDate === r.report_date &&
                  pendingTomorrow.generatedOn === localToday &&
                  pendingTomorrow.items.length > 0
                );
              const serverList = (r.tomorrow_suggestions ?? []).filter((x) => x.title?.trim());
              const useServer =
                !usePending && serverList.length > 0 && r.report_date === localToday;
              const tomorrowRows = usePending
                ? pendingTomorrow!.items
                : useServer
                  ? serverList.map((s, i) => ({
                      id: `server:${r.report_date}:${i}`,
                      title: s.title.trim(),
                    }))
                  : [];
              const showTomorrow = tomorrowRows.length > 0;
              return (
                <ReportCard
                  key={r.id}
                  variant="daily"
                  title={formatDate(r.report_date)}
                  content={r.content}
                  expanded={expandedId === r.report_date}
                  onToggle={() =>
                    setExpandedId(expandedId === r.report_date ? null : r.report_date)
                  }
                  onDelete={() => handleDeleteDaily(r.report_date)}
                  footer={
                    showTomorrow ? (
                      <div className="mt-2 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-orange-50/40 px-4 py-4">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-950">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-amber-600 shadow-sm">
                            <CheckCircle2 size={16} />
                          </span>
                          建议明日计划
                        </h3>
                        <p className="mb-3 text-xs leading-relaxed text-stone-600">
                          以下为 AI 根据本次日报生成的建议；点击「接受」将创建<strong className="text-stone-800">创建日为明天</strong>的待办。跨自然日后本区域会自动隐藏。
                        </p>
                        {acceptError && (
                          <p className="mb-2 text-xs text-rose-600">{acceptError}</p>
                        )}
                        <ul className="space-y-2">
                          {tomorrowRows.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-start justify-between gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm"
                            >
                              <span className="flex-1 text-sm leading-snug text-stone-800">{it.title}</span>
                              <button
                                type="button"
                                disabled={acceptingId === it.id}
                                onClick={() => handleAcceptSuggestion(it.id, r.report_date)}
                                className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                              >
                                {acceptingId === it.id ? '创建中…' : '接受'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  }
                />
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {weeklyReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white/80 px-6 py-16 text-center text-stone-600">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-600 shadow-inner">
                <FileText size={32} strokeWidth={1.5} />
              </div>
              <p className="text-base font-semibold text-stone-800">暂无周报</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
                周报汇总<strong className="text-stone-700">本周待办</strong>；若无记录可先补充待办，再点击「生成周报」。
              </p>
            </div>
          ) : (
            weeklyReports.map((r) => (
              <ReportCard
                key={r.id}
                variant="weekly"
                title={formatWeek(r.week_start, r.week_end)}
                content={r.content}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onDelete={() => handleDeleteWeekly(r.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  variant,
  title,
  content,
  expanded,
  onToggle,
  onDelete,
  footer,
}: {
  variant: 'daily' | 'weekly';
  title: string;
  content: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  footer?: ReactNode;
}) {
  const copyContent = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-amber-100/90 bg-gradient-to-br from-white via-amber-50/20 to-orange-50/15 shadow-md shadow-amber-100/50 ring-1 ring-stone-900/[0.03] transition hover:border-amber-200/90 hover:shadow-lg">
      <div className="h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" aria-hidden />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-amber-50/35 sm:px-5 sm:py-4"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
            {variant === 'daily' ? '日报' : '周报'}
          </span>
          <h2 className="mt-2 text-base font-semibold leading-snug text-stone-900 sm:text-lg">{title}</h2>
          <p className="mt-1 text-xs text-stone-500">{expanded ? '点击收起正文' : '点击展开阅读全文'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyContent();
            }}
            className="rounded-full p-2 text-stone-500 transition hover:bg-amber-100 hover:text-amber-800"
            title="复制全文"
          >
            <Copy size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-full p-2 text-stone-500 transition hover:bg-rose-50 hover:text-rose-600"
            title="删除"
          >
            <Trash2 size={18} />
          </button>
          <span className="ml-0.5 text-stone-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-amber-100/90 bg-gradient-to-b from-stone-100/40 via-stone-50/30 to-white">
          <div className="mx-auto max-w-[52rem] px-3 py-5 sm:px-5 sm:py-7">
            <div
              className={cn(
                'report-reading-surface px-4 py-6 sm:px-10 sm:py-9',
                variant === 'daily' && 'report-reading-surface--daily'
              )}
            >
              <ReportMarkdownContent content={content} variant={variant} />
            </div>
          </div>
          {footer ? (
            <div className="border-t border-amber-100/80 bg-white/40 px-4 pb-6 pt-5 backdrop-blur-[2px] sm:px-8">
              {footer}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
