'use client';

import { Menu, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { clearCredentials } from '@/lib/store/authSlice';
import { useLogoutMutation } from '@/lib/auth/authApi';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [logout] = useLogoutMutation();

  async function handleLogout() {
    try { await logout().unwrap(); } catch { /* ignore */ }
    dispatch(clearCredentials());
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-border flex items-center px-4 gap-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-secondary hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <NotificationBell />

      {/* User menu */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end min-w-0">
          <span className="text-sm font-medium text-foreground leading-none truncate max-w-[120px]">{user?.name ?? '—'}</span>
          <span className="text-xs text-muted capitalize">{user?.role?.toLowerCase() ?? ''}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald flex items-center justify-center">
          <User size={16} className="text-white" aria-hidden="true" />
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-md text-secondary hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
