import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Save, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import * as settingsApi from '../api/settings';
import type {
  AIRuntimeConfig,
  ReportScheduleConfig,
  ReportScheduleConfigUpdate,
} from '../api/settings';
import * as authApi from '../api/auth';
import CenterToast from '../components/CenterToast';
import PasswordField from '../components/PasswordField';
import { getPasswordRuleError } from '../lib/passwordValidation';
import { getBrowserTimeZone } from '../lib/timezones';

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '一' },
  { value: 1, label: '二' },
  { value: 2, label: '三' },
  { value: 3, label: '四' },
  { value: 4, label: '五' },
  { value: 5, label: '六' },
  { value: 6, label: '日' },
];

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'dashscope', label: '千问 (Qwen)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'volcengine', label: '豆包 (Doubao)' },
  { value: 'moonshot', label: 'Kimi (Moonshot)' },
  { value: 'ollama', label: 'Ollama' },
];

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  azure: '',
  anthropic: 'https://api.anthropic.com',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  moonshot: 'https://api.moonshot.cn/v1',
  ollama: 'http://localhost:11434/v1',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationOk, setValidationOk] = useState<boolean | null>(null);

  const [providerMode, setProviderMode] = useState<'preset' | 'custom'>('preset');
  const [provider, setProvider] = useState('openai');
  const [customProvider, setCustomProvider] = useState('');
  const [modelName, setModelName] = useState('gpt-3.5-turbo');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const [schedule, setSchedule] = useState<ReportScheduleConfig | null>(null);
  const [lastSavedSchedule, setLastSavedSchedule] = useState<ReportScheduleConfig | null>(null);
  const [hasStoredAutomationAi, setHasStoredAutomationAi] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [pendingSchedulePayload, setPendingSchedulePayload] =
    useState<ReportScheduleConfigUpdate | null>(null);
  const [automationModalError, setAutomationModalError] = useState('');
  const [consentSaving, setConsentSaving] = useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdFormError, setPwdFormError] = useState('');

  const resolvedProvider =
    providerMode === 'custom' ? customProvider.trim() : provider.trim();

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const saved = settingsApi.getRuntimeAIConfig();
    if (saved) {
      const isPreset = PROVIDERS.some((p) => p.value === saved.provider);
      if (isPreset) {
        setProviderMode('preset');
        setProvider(saved.provider);
      } else {
        setProviderMode('custom');
        setCustomProvider(saved.provider);
      }
      setModelName(saved.model_name);
      setApiKey(saved.api_key);
      setBaseUrl(saved.base_url || '');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      settingsApi.fetchScheduleConfig(),
      settingsApi.fetchAIAutomationStatus().catch(() => ({ has_stored_automation_ai: false })),
    ])
      .then(([cfg, st]) => {
        const adj = { ...cfg, timezone: getBrowserTimeZone() };
        setSchedule(adj);
        setLastSavedSchedule({ ...adj });
        setHasStoredAutomationAi(st.has_stored_automation_ai);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '加载设置失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleValidate = async () => {
    if (!resolvedProvider || !modelName.trim() || !apiKey.trim()) {
      setValidationOk(false);
      setValidationMessage('请先完整填写 provider、model 与 API Key');
      return;
    }
    setValidating(true);
    setValidationMessage('');
    setValidationOk(null);
    try {
      const result = await settingsApi.validateAIConfig({
        provider: resolvedProvider,
        model_name: modelName.trim(),
        api_key: apiKey.trim(),
        base_url: baseUrl.trim() || undefined,
      });
      setValidationOk(result.ok);
      setValidationMessage(result.message || '配置可用');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setValidationOk(false);
      setValidationMessage(msg || '校验失败，请检查配置');
    } finally {
      setValidating(false);
    }
  };

  const handleSaveLocalConfig = () => {
    if (!resolvedProvider || !modelName.trim() || !apiKey.trim()) {
      setError('provider、model、API Key 不能为空');
      return;
    }
    settingsApi.saveRuntimeAIConfig({
      provider: resolvedProvider,
      model_name: modelName.trim(),
      api_key: apiKey.trim(),
      base_url: baseUrl.trim() || undefined,
    });
    setError('');
    setToastMessage('已保存到浏览器本地（不会写入后端数据库）');
  };

  const handleClearLocalConfig = () => {
    settingsApi.clearRuntimeAIConfig();
    setApiKey('');
    setToastMessage('本地 API Key 已清空');
    setValidationMessage('');
    setValidationOk(null);
  };

  const updateScheduleDraft = (patch: Partial<ReportScheduleConfig>) => {
    setSchedule((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const getLocalAiForUpload = (): AIRuntimeConfig | null => {
    const fromStore = settingsApi.getRuntimeAIConfig();
    if (fromStore) return fromStore;
    if (resolvedProvider && modelName.trim() && apiKey.trim()) {
      return {
        provider: resolvedProvider,
        model_name: modelName.trim(),
        api_key: apiKey.trim(),
        base_url: baseUrl.trim() || undefined,
      };
    }
    return null;
  };

  const persistSchedule = async (payload: ReportScheduleConfigUpdate) => {
    setScheduleSaving(true);
    setError('');
    try {
      const saved = await settingsApi.updateScheduleConfig(payload);
      const withLocalTz = { ...saved, timezone: getBrowserTimeZone() };
      setSchedule(withLocalTz);
      setLastSavedSchedule({ ...withLocalTz });
      setToastMessage('定时触发配置已保存');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || '保存定时配置失败');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    const payload: ReportScheduleConfigUpdate = {
      timezone: getBrowserTimeZone(),
      daily_enabled: schedule.daily_enabled,
      daily_hour: Number(schedule.daily_hour),
      daily_minute: Number(schedule.daily_minute),
      weekly_enabled: schedule.weekly_enabled,
      weekly_day_of_week: Number(schedule.weekly_day_of_week),
      weekly_hour: Number(schedule.weekly_hour),
      weekly_minute: Number(schedule.weekly_minute),
    };
    const enablingAuto = !!(payload.daily_enabled || payload.weekly_enabled);
    if (enablingAuto && !hasStoredAutomationAi) {
      setPendingSchedulePayload(payload);
      setAutomationModalError('');
      setShowAutomationModal(true);
      return;
    }
    await persistSchedule(payload);
  };

  const handleAutomationAgree = async () => {
    const cfg = getLocalAiForUpload();
    if (!cfg) {
      setAutomationModalError(
        '未找到可用的本地配置：请先点击「保存到本地」，或在上方填写完整的 provider、模型与 API Key。'
      );
      return;
    }
    setConsentSaving(true);
    setAutomationModalError('');
    try {
      await settingsApi.saveAIAutomationForSchedule(cfg);
      setHasStoredAutomationAi(true);
      setShowAutomationModal(false);
      const pending = pendingSchedulePayload;
      setPendingSchedulePayload(null);
      if (pending) {
        await persistSchedule(pending);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAutomationModalError(typeof msg === 'string' ? msg : '上传失败');
    } finally {
      setConsentSaving(false);
    }
  };

  const handleAutomationRefuse = () => {
    setShowAutomationModal(false);
    setPendingSchedulePayload(null);
    if (lastSavedSchedule) {
      setSchedule({ ...lastSavedSchedule });
    }
    setToastMessage('已取消。未将 API Key 上传到服务器时，只能手动生成日报与周报。');
  };

  const handleClearServerAutomationAi = async () => {
    if (
      !window.confirm(
        '确定清除账户中为自动报告保存的 API Key？清除后定时生成将无法调用 AI，直至重新同意上传。'
      )
    ) {
      return;
    }
    try {
      await settingsApi.clearAIAutomationOnServer();
      setHasStoredAutomationAi(false);
      setToastMessage('已清除账户中的自动化 AI 凭据');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : '清除失败');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFormError('');
    const rule = getPasswordRuleError(newPwd);
    if (rule) {
      setPwdFormError(rule);
      return;
    }
    if (newPwd !== newPwdConfirm) {
      setPwdFormError('两次输入的新密码不一致');
      return;
    }
    setPwdSaving(true);
    try {
      await authApi.changePassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setNewPwdConfirm('');
      setToastMessage('密码已更新');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPwdFormError(typeof msg === 'string' ? msg : '修改失败');
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-900">
          <Settings size={20} className="inline mr-2 -mt-0.5 text-amber-500" />
          系统设置
        </h2>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-800">
          {error}
        </div>
      )}
      <CenterToast message={toastMessage} />

      {loading ? (
        <div className="text-center py-20 text-stone-500">加载中...</div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-100/50 bg-white/80 p-4 shadow-lg shadow-amber-100/50 backdrop-blur-sm sm:p-5">
            <h3 className="text-base font-semibold text-stone-800 mb-1">AI 运行配置（仅前端本地）</h3>
            <p className="text-xs text-stone-500 mb-4">
              API Key 仅保存在浏览器 localStorage，不会保存到后端数据库。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">提供商</label>
                <div className="space-y-2">
                  <select
                    value={providerMode === 'preset' ? provider : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setProviderMode('custom');
                      } else {
                        setProviderMode('preset');
                        setProvider(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 focus:outline-none focus:border-amber-400"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                    <option value="__custom__">自定义 provider</option>
                  </select>
                  {providerMode === 'custom' && (
                    <input
                      value={customProvider}
                      onChange={(e) => setCustomProvider(e.target.value)}
                      placeholder="如 openrouter / myproxy / company-ai"
                      className="w-full px-4 py-2.5 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">模型</label>
                <input
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-stone-500 mb-1 block">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-amber-600"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-stone-500 mb-1 block">Base URL（可选）</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  DEFAULT_BASE_URLS[providerMode === 'preset' ? provider : ''] ||
                  'https://api.openai.com/v1'
                }
                className="w-full px-4 py-2.5 rounded-xl bg-amber-50/30 border-2 border-amber-200 text-stone-700 focus:outline-none focus:border-amber-400"
              />
            </div>

            {validationMessage && (
              <div
                className={
                  validationOk
                    ? 'mt-3 px-3 py-2 text-xs rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'mt-3 px-3 py-2 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700'
                }
              >
                {validationMessage}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="px-4 py-2 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-medium disabled:opacity-50"
              >
                {validating ? '校验中...' : '校验可用性'}
              </button>
              <button
                onClick={handleSaveLocalConfig}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-medium shadow-md"
              >
                <Save size={14} />
                保存到本地
              </button>
              <button
                onClick={handleClearLocalConfig}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200"
              >
                <Trash2 size={14} />
                清空本地 Key
              </button>
            </div>
          </div>

          {schedule && (
            <div className="rounded-2xl border border-amber-100/50 bg-white/80 p-4 shadow-lg shadow-amber-100/50 backdrop-blur-sm sm:p-5">
              <h3 className="text-base font-semibold text-stone-800 mb-1">
                <ShieldCheck size={16} className="inline mr-1 -mt-0.5 text-amber-500" />
                日报/周报定时触发
              </h3>
              <p className="text-xs text-stone-500 mb-2">
                定时任务在服务器执行，按<strong className="font-medium">您本机（浏览器）所在时区</strong>
                判断「当天」与触发时刻。一周按自然周计算：<strong className="font-medium">星期一是星期一，星期日是星期日</strong>
                （周报在下方选择的星期触发）。
              </p>
              <p className="text-xs text-amber-800/90 mb-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                定时任务在服务器运行，无法读取浏览器本地 Key。开启自动生成前需将当前本地（或上方表单）中的
                API 配置上传到您的账户；若拒绝上传，仅可使用「报告」页手动生成。
              </p>
              <p className="text-xs text-stone-600 mb-4">
                账户自动化凭据：
                <span className={hasStoredAutomationAi ? 'text-emerald-700 font-medium' : 'text-stone-500'}>
                  {hasStoredAutomationAi ? '已保存（将用于定时生成）' : '未保存'}
                </span>
                {hasStoredAutomationAi && (
                  <button
                    type="button"
                    onClick={handleClearServerAutomationAi}
                    className="ml-2 text-rose-600 hover:underline"
                  >
                    清除账户中的 Key
                  </button>
                )}
              </p>

              <div className="mt-4 p-3 rounded-xl border border-amber-100 bg-amber-50/20 space-y-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={schedule.daily_enabled}
                    onChange={(e) => updateScheduleDraft({ daily_enabled: e.target.checked })}
                  />
                  启用日报自动生成
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">执行时间</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={schedule.daily_hour}
                    onChange={(e) => updateScheduleDraft({ daily_hour: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded-lg border border-amber-200"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={schedule.daily_minute}
                    onChange={(e) => updateScheduleDraft({ daily_minute: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded-lg border border-amber-200"
                  />
                </div>
              </div>

              <div className="mt-3 p-3 rounded-xl border border-amber-100 bg-amber-50/20 space-y-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={schedule.weekly_enabled}
                    onChange={(e) => updateScheduleDraft({ weekly_enabled: e.target.checked })}
                  />
                  启用周报自动生成
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-stone-500">星期</span>
                  <select
                    value={schedule.weekly_day_of_week}
                    onChange={(e) =>
                      updateScheduleDraft({ weekly_day_of_week: Number(e.target.value) })
                    }
                    className="min-w-[6rem] px-2 py-1 rounded-lg border border-amber-200 bg-white text-stone-700"
                  >
                    {WEEKDAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-stone-500">时间</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={schedule.weekly_hour}
                    onChange={(e) => updateScheduleDraft({ weekly_hour: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded-lg border border-amber-200"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={schedule.weekly_minute}
                    onChange={(e) => updateScheduleDraft({ weekly_minute: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded-lg border border-amber-200"
                  />
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-medium shadow-md disabled:opacity-50"
                >
                  <Save size={14} />
                  {scheduleSaving ? '保存中...' : '保存定时配置'}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-amber-100/50 bg-white/80 p-4 shadow-lg shadow-amber-100/50 backdrop-blur-sm sm:p-5">
            <h3 className="text-base font-semibold text-stone-800 mb-1">
              <KeyRound size={16} className="inline mr-1 -mt-0.5 text-amber-500" />
              账户与安全
            </h3>
            <h4 className="text-sm font-semibold text-stone-800 mb-2 mt-1">修改密码</h4>
            {pwdFormError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-100">
                {pwdFormError}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
              <PasswordField
                label="当前密码"
                value={currentPwd}
                onChange={setCurrentPwd}
                autoComplete="current-password"
              />
              <PasswordField
                label="新密码"
                value={newPwd}
                onChange={setNewPwd}
                autoComplete="new-password"
              />
              <PasswordField
                label="确认新密码"
                value={newPwdConfirm}
                onChange={setNewPwdConfirm}
                autoComplete="new-password"
              />
              <p className="text-xs text-stone-500">新密码需 6～72 位，且同时包含大写与小写英文字母。</p>
              <button
                type="submit"
                disabled={pwdSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-medium shadow-md disabled:opacity-50"
              >
                {pwdSaving ? <Loader2 className="animate-spin" size={16} /> : null}
                {pwdSaving ? '保存中...' : '更新密码'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAutomationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="automation-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-amber-200 shadow-xl p-6 space-y-4">
            <h3 id="automation-modal-title" className="text-lg font-bold text-stone-800">
              开启自动生成
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              日报/周报定时任务在<strong>服务器</strong>上执行，无法访问您浏览器里的配置。若要开启自动生成，需要将当前
              <strong>本地已保存</strong>（或本页已填写）的 API Key、模型等信息写入<strong>与您账户关联的数据库</strong>
              ，仅用于定时调用 AI。
            </p>
            <p className="text-xs text-stone-500">
              若您不同意上传，请点击「不同意」，系统将关闭自动生成选项；您仍可在「报告」页随时手动生成。
            </p>
            {automationModalError && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {automationModalError}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={handleAutomationRefuse}
                disabled={consentSaving}
                className="px-4 py-2.5 rounded-xl border-2 border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                不同意，仅手动生成
              </button>
              <button
                type="button"
                onClick={handleAutomationAgree}
                disabled={consentSaving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-medium shadow-md disabled:opacity-50"
              >
                {consentSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                同意并上传到账户
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
