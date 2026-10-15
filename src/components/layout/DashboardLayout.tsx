'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/formatters';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={setCollapsed}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Sidebar toggle — fixed independently above all layers */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'hidden sm2:flex fixed top-[13px] z-[9999] print:hidden',
          'items-center justify-center w-9 h-9 rounded-full',
          'bg-emerald hover:bg-emerald-600 active:scale-95',
          'shadow-[0_0_0_3px_white,0_2px_12px_rgba(16,185,129,0.6)]',
          'transition-all duration-200',
          collapsed ? 'left-[47px]' : 'left-[221px]',
        )}
      >
        {collapsed
          ? <ChevronRight size={18} className="text-white" />
          : <ChevronLeft size={18} className="text-white" />}
      </button>

      {/* Main content */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-200 min-w-0 print:ml-0',
          'sm2:ml-60',
          collapsed && 'sm2:ml-16',
        )}
      >
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
