import client from './client';
import type { AuthUser } from '../stores/authStore';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export async function register(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/auth/register', { email, password });
  return data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/auth/login', { email, password });
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await client.get<AuthUser>('/auth/me');
  return data;
}

export async function changePassword(
  current_password: string,
  new_password: string
): Promise<void> {
  await client.post('/auth/change-password', { current_password, new_password });
}
