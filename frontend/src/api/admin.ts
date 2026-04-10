import adminClient from './adminClient';
import type { AdminUser } from '../stores/adminStore';

export interface AdminTokenResponse {
  access_token: string;
  token_type: string;
  admin: AdminUser;
}

export interface AdminUserRow {
  id: number;
  email: string;
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
}

export interface AdminUserListResponse {
  items: AdminUserRow[];
  total: number;
}

export async function adminLogin(email: string, password: string): Promise<AdminTokenResponse> {
  const { data } = await adminClient.post<AdminTokenResponse>('/admin/login', { email, password });
  return data;
}

export async function adminFetchMe(): Promise<AdminUser> {
  const { data } = await adminClient.get<AdminUser>('/admin/me');
  return data;
}

export async function adminListUsers(skip = 0, limit = 50): Promise<AdminUserListResponse> {
  const { data } = await adminClient.get<AdminUserListResponse>('/admin/users', {
    params: { skip, limit },
  });
  return data;
}

export async function adminPatchUser(
  userId: number,
  patch: { is_active?: boolean }
): Promise<AdminUserRow> {
  const { data } = await adminClient.patch<AdminUserRow>(`/admin/users/${userId}`, patch);
  return data;
}

export async function adminRequestPasswordReset(userId: number): Promise<{ message: string }> {
  const { data } = await adminClient.post<{ message: string }>(
    `/admin/users/${userId}/request-password-reset`
  );
  return data;
}
