import client from './client';
import type { AIRuntimeConfig } from './settings';

export interface TomorrowSuggestion {
  title: string;
}

export interface DailyReport {
  id: number;
  report_date: string;
  content: string;
  method: string;
  created_at: string;
  tomorrow_suggestions?: TomorrowSuggestion[];
}

export interface WeeklyReport {
  id: number;
  week_start: string;
  week_end: string;
  content: string;
  method: string;
  created_at: string;
}

export async function fetchDailyReports(): Promise<DailyReport[]> {
  const { data } = await client.get('/reports/daily');
  return data;
}

export async function fetchDailyReport(date: string): Promise<DailyReport> {
  const { data } = await client.get(`/reports/daily/${date}`);
  return data;
}

export async function generateDailyReport(
  targetDate?: string,
  aiConfig?: AIRuntimeConfig | null
): Promise<DailyReport> {
  const { data } = await client.post('/reports/daily/generate', {
    target_date: targetDate || null,
    ai_config: aiConfig || null,
  });
  return data;
}

export async function deleteDailyReport(date: string): Promise<void> {
  await client.delete(`/reports/daily/${date}`);
}

export async function updateDailyTomorrowSuggestions(
  reportDate: string,
  items: TomorrowSuggestion[]
): Promise<DailyReport> {
  const { data } = await client.patch(`/reports/daily/${reportDate}/tomorrow-suggestions`, {
    items,
  });
  return data;
}

export async function fetchWeeklyReports(): Promise<WeeklyReport[]> {
  const { data } = await client.get('/reports/weekly');
  return data;
}

export async function generateWeeklyReport(
  weekStart?: string,
  aiConfig?: AIRuntimeConfig | null
): Promise<WeeklyReport> {
  const { data } = await client.post('/reports/weekly/generate', {
    week_start: weekStart || null,
    ai_config: aiConfig || null,
  });
  return data;
}

export async function deleteWeeklyReport(id: number): Promise<void> {
  await client.delete(`/reports/weekly/${id}`);
}
