import client from './client';

export interface WritingSample {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ToneStatus {
  tone_enabled: boolean;
  profile_text: string | null;
  last_error: string | null;
  sample_count: number;
  samples_max: number;
  profile_updated_at: string | null;
}

export async function fetchToneStatus(): Promise<ToneStatus> {
  const { data } = await client.get<ToneStatus>('/tone/status');
  return data;
}

export async function fetchWritingSamples(): Promise<WritingSample[]> {
  const { data } = await client.get<WritingSample[]>('/tone/samples');
  return data;
}

export async function createWritingSample(payload: {
  title: string;
  body: string;
}): Promise<WritingSample> {
  const { data } = await client.post<WritingSample>('/tone/samples', payload);
  return data;
}

export async function updateWritingSample(
  id: number,
  payload: { title?: string; body?: string }
): Promise<WritingSample> {
  const { data } = await client.patch<WritingSample>(`/tone/samples/${id}`, payload);
  return data;
}

export async function deleteWritingSample(id: number): Promise<void> {
  await client.delete(`/tone/samples/${id}`);
}

export async function clearWritingSamples(): Promise<void> {
  await client.delete('/tone/samples');
}

export async function patchToneSettings(tone_enabled: boolean): Promise<ToneStatus> {
  const { data } = await client.patch<ToneStatus>('/tone/settings', { tone_enabled });
  return data;
}

export async function rebuildToneProfile(): Promise<ToneStatus> {
  const { data } = await client.post<ToneStatus>('/tone/rebuild');
  return data;
}
