'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Factory, TrendingUp,
  DollarSign, Users, BarChart2, Settings, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/formatters';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/procurement', label: 'Procurement', icon: ShoppingCart },
  { href: '/production', label: 'Production', icon: Factory },
  { href: '/sales', label: 'Sales', icon: TrendingUp },
  { href: '/finance', label: 'Finance', icon: DollarSign },
  { href: '/hr', label: 'HR', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: (v: boolean) => void;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onCollapse, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-navy-800 shrink-0">
        <div className="w-7 h-7 rounded-md bg-emerald flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">H</span>
        </div>
        {!collapsed && (
          <span className="text-white font-semibold text-sm truncate">HCC ERP</span>
        )}
      </div>

      {/* Nav links */}
      <ul className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-navy-700 text-white'
                    : 'text-slate-400 hover:bg-navy-800 hover:text-white',
                )}
                title={collapsed ? label : undefined}
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:flex px-2 pb-3">
        <button
          onClick={() => onCollapse(!collapsed)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-slate-400 hover:bg-navy-800 hover:text-white text-sm transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Collapse</span></>}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-navy transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {navContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative flex flex-col w-64 max-w-[85vw] bg-navy h-full z-50">
            <button
              onClick={onMobileClose}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
