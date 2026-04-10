import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, FileText, LogOut, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

const NAV_ITEMS = [
  { to: '/', label: '待办', icon: ClipboardList },
  { to: '/reports', label: '报告', icon: FileText },
  { to: '/tone', label: '语气库', icon: BookOpen },
  { to: '/settings', label: '设置', icon: Settings },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-40 border-b border-amber-100 bg-white/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-5xl px-3 sm:px-4">
          <div className="grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:py-0 sm:min-h-[3.5rem]">
            <div className="flex min-w-0 w-full items-center gap-2 sm:w-auto">
              <h1 className="flex min-w-0 shrink-0 items-center gap-1.5 text-base font-bold text-transparent sm:gap-2 sm:text-lg">
                <ClipboardList size={20} className="shrink-0 text-amber-500 sm:h-[22px] sm:w-[22px]" />
                <span className="truncate bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text">
                  待办助手
                </span>
              </h1>
              <div className="flex min-h-[40px] min-w-0 flex-1 items-center justify-end gap-2 sm:hidden">
                <span
                  className="min-w-0 flex-1 truncate text-right text-xs leading-snug text-stone-500"
                  title={user?.email}
                >
                  {user?.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex shrink-0 items-center justify-center rounded-lg p-2 text-stone-600 hover:bg-amber-50 hover:text-amber-700"
                  title="退出登录"
                  aria-label="退出登录"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
            <nav
              className="flex min-w-0 justify-between gap-0.5 rounded-xl bg-stone-100/90 p-1 sm:justify-center sm:bg-transparent sm:p-0"
              aria-label="主导航"
            >
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-[44px] min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors sm:min-h-0 sm:flex-initial sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm',
                      isActive
                        ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200/80 sm:bg-amber-50 sm:shadow-none sm:ring-0'
                        : 'text-stone-600 hover:bg-white/70 hover:text-amber-800 sm:hover:bg-amber-50/50'
                    )
                  }
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="hidden min-w-0 items-center justify-end gap-2 sm:flex sm:shrink-0">
              <span
                className="min-w-0 max-w-[min(28rem,46vw)] text-right text-xs leading-snug text-stone-500 [overflow-wrap:anywhere] break-words"
                title={user?.email}
              >
                {user?.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:bg-amber-50 hover:text-amber-700"
                title="退出登录"
              >
                <LogOut size={16} />
                <span>退出</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-6 sm:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
