import client from './client';

const RUNTIME_AI_CONFIG_KEY = 'todo_runtime_ai_config';

export interface AIRuntimeConfig {
  provider: string;
  model_name: string;
  api_key: string;
  base_url?: string;
}

export type AIConfigValidatePayload = AIRuntimeConfig;

export interface AIConfigValidateResult {
  ok: boolean;
  message: string;
}

export interface ReportScheduleConfig {
  id: number;
  timezone: string;
  daily_enabled: boolean;
  daily_hour: number;
  daily_minute: number;
  weekly_enabled: boolean;
  weekly_day_of_week: number;
  weekly_hour: number;
  weekly_minute: number;
  created_at: string;
  updated_at: string;
}

export interface ReportScheduleConfigUpdate {
  timezone?: string;
  daily_enabled?: boolean;
  daily_hour?: number;
  daily_minute?: number;
  weekly_enabled?: boolean;
  weekly_day_of_week?: number;
  weekly_hour?: number;
  weekly_minute?: number;
}

export function getRuntimeAIConfig(): AIRuntimeConfig | null {
  const raw = localStorage.getItem(RUNTIME_AI_CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AIRuntimeConfig;
    if (!parsed.provider || !parsed.model_name || !parsed.api_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRuntimeAIConfig(payload: AIRuntimeConfig): void {
  localStorage.setItem(
    RUNTIME_AI_CONFIG_KEY,
    JSON.stringify({
      provider: payload.provider.trim(),
      model_name: payload.model_name.trim(),
      api_key: payload.api_key.trim(),
      base_url: payload.base_url?.trim() || undefined,
    })
  );
}

export function clearRuntimeAIConfig(): void {
  localStorage.removeItem(RUNTIME_AI_CONFIG_KEY);
}

export async function validateAIConfig(
  payload: AIConfigValidatePayload
): Promise<AIConfigValidateResult> {
  const { data } = await client.post('/settings/ai-configs/validate', payload);
  return data;
}

export async function fetchScheduleConfig(): Promise<ReportScheduleConfig> {
  const { data } = await client.get('/reports/schedule');
  return data;
}

export async function updateScheduleConfig(
  payload: ReportScheduleConfigUpdate
): Promise<ReportScheduleConfig> {
  const { data } = await client.put('/reports/schedule', payload);
  return data;
}

export interface AIAutomationStatus {
  has_stored_automation_ai: boolean;
}

export async function fetchAIAutomationStatus(): Promise<AIAutomationStatus> {
  const { data } = await client.get<AIAutomationStatus>('/settings/ai-automation/status');
  return data;
}

export async function saveAIAutomationForSchedule(payload: AIRuntimeConfig): Promise<void> {
  await client.put('/settings/ai-automation', {
    provider: payload.provider,
    model_name: payload.model_name,
    api_key: payload.api_key,
    base_url: payload.base_url,
  });
}

export async function clearAIAutomationOnServer(): Promise<void> {
  await client.delete('/settings/ai-automation');
}
