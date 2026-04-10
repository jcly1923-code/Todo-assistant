import axios from 'axios';
import { ADMIN_TOKEN_KEY } from '../lib/adminConstants';
import { useAdminStore } from '../stores/adminStore';

const adminClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = String(err.config?.url || '');
    if (status === 401 && !url.includes('/admin/login')) {
      useAdminStore.getState().logout();
      const p = window.location.pathname;
      if (p.startsWith('/admin') && !p.endsWith('/admin/login')) {
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(err);
  }
);

export default adminClient;
