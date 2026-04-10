import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import TodoPage from './pages/TodoPage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import ToneLibraryPage from './pages/ToneLibraryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminUsersPage from './pages/AdminUsersPage';
import { useAuthStore } from './stores/authStore';

function ProtectedLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<TodoPage />} />
          <Route path="reports" element={<ReportPage />} />
          <Route path="tone" element={<ToneLibraryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
