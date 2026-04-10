import client from './client';
import type { Tag, TagCreate } from '../types/todo';

export async function fetchTags(): Promise<Tag[]> {
  const { data } = await client.get('/tags/');
  return data;
}

export async function createTag(payload: TagCreate): Promise<Tag> {
  const { data } = await client.post('/tags/', payload);
  return data;
}

export async function deleteTag(id: number): Promise<void> {
  await client.delete(`/tags/${id}`);
}
