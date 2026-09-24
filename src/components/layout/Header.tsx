'use client';

import { useState, useEffect } from 'react';
import { Menu, LogOut, User, FlaskConical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { clearCredentials } from '@/lib/store/authSlice';
import { useLogoutMutation } from '@/lib/auth/authApi';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

function DateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-base font-semibold text-muted">
      {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      {' · '}
      {now.toLocaleTimeString()}
    </span>
  );
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
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-border flex items-center px-4 gap-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-secondary hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <FlaskConical size={26} className="text-emerald" />
          <span className="text-2xl font-black text-emerald tracking-tight">Health Care Cosmetics</span>
          <span className="text-xs font-bold text-white bg-emerald px-1.5 py-0.5 rounded">ERP</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <DateTime />
      </div>

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
