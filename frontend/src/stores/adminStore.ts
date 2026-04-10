import { create } from 'zustand';
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY } from '../lib/adminConstants';

export interface AdminUser {
  id: number;
  email: string;
  created_at: string;
  is_active: boolean;
  last_login_at: string | null;
}

interface AdminState {
  token: string | null;
  admin: AdminUser | null;
  setAuth: (token: string, admin: AdminUser) => void;
  logout: () => void;
}

function readToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function readAdmin(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export const useAdminStore = create<AdminState>((set) => ({
  token: readToken(),
  admin: readAdmin(),

  setAuth: (token, admin) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(admin));
    set({ token, admin });
  },

  logout: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    set({ token: null, admin: null });
  },
}));
