'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Truck, Factory, TrendingUp,
  DollarSign, Users, BarChart2, Settings, X, ChevronLeft, ChevronRight,
  ChevronDown, UserCircle, ClipboardList, FileText, ShoppingCart,
  Warehouse, ReceiptText, Building2, Plus,
} from 'lucide-react';
import { cn } from '@/lib/formatters';

type NavChild = { href: string; label: string; icon: React.ElementType };
type NavItem =
  | { href: string; label: string; icon: React.ElementType; children?: never }
  | { href: string; label: string; icon: React.ElementType; children: NavChild[] };

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/procurement', label: 'Suppliers', icon: Truck,
    children: [
      { href: '/procurement/suppliers', label: 'Suppliers List', icon: Building2 },
      { href: '/procurement/orders', label: 'Purchase Orders', icon: ShoppingCart },
    ],
  },
  {
    href: '/inventory', label: 'Raw Materials', icon: Package,
    children: [
      { href: '/inventory', label: 'Material List', icon: Package },
      { href: '/inventory/stock', label: 'Material Stock', icon: Warehouse },
    ],
  },
  { href: '/production', label: 'Production', icon: Factory },
  {
    href: '/sales', label: 'Sales', icon: TrendingUp,
    children: [
      { href: '/sales/orders/new', label: 'Create Sale', icon: Plus },
      { href: '/sales/orders', label: 'Orders', icon: ClipboardList },
      { href: '/sales/invoices', label: 'Invoices', icon: FileText },
      { href: '/sales/customers', label: 'Customers', icon: UserCircle },
    ],
  },
  {
    href: '/finance', label: 'Finance', icon: DollarSign,
    children: [
      { href: '/finance/expenses', label: 'Expenses', icon: ReceiptText },
      { href: '/finance/categories', label: 'Categories', icon: ClipboardList },
      { href: '/finance/summary', label: 'Summary', icon: BarChart2 },
    ],
  },
  {
    href: '/hr', label: 'HR', icon: Users,
    children: [
      { href: '/hr/departments', label: 'Departments', icon: Building2 },
      { href: '/hr/employees', label: 'Employees', icon: Users },
      { href: '/hr/attendance', label: 'Attendance', icon: ClipboardList },
      { href: '/hr/leaves', label: 'Leaves', icon: FileText },
      { href: '/hr/payroll', label: 'Payroll', icon: ReceiptText },
    ],
  },
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

  // Determine which group is active based on current path
  function isGroupActive(item: NavItem) {
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  // Track open groups — auto-open the active one on mount
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_ITEMS.forEach((item) => {
      if (item.children && isGroupActive(item)) initial[item.href] = true;
    });
    return initial;
  });

  // Auto-open group when navigating to a child route
  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.children && isGroupActive(item)) {
        setOpenGroups((prev) => ({ ...prev, [item.href]: true }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(href: string) {
    setOpenGroups((prev) => ({ ...prev, [href]: !prev[href] }));
  }

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
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const groupActive = isGroupActive(item);

          if (!item.children) {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    groupActive
                      ? 'bg-navy-700 text-white'
                      : 'text-slate-400 hover:bg-navy-800 hover:text-white',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          }

          const isOpen = !collapsed && !!openGroups[item.href];

          return (
            <li key={item.href}>
              {/* Group header — clicking toggles children when expanded, navigates when collapsed */}
              {collapsed ? (
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center justify-center px-3 py-2 rounded-md text-sm transition-colors',
                    groupActive ? 'bg-navy-700 text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white',
                  )}
                  title={item.label}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                </Link>
              ) : (
                <button
                  onClick={() => toggleGroup(item.href)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    groupActive ? 'text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white',
                  )}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-200', isOpen ? 'rotate-180' : '')}
                    aria-hidden="true"
                  />
                </button>
              )}

              {/* Children */}
              {isOpen && (
                <ul className="mt-0.5 ml-4 pl-3 border-l border-navy-700 space-y-0.5">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = pathname === child.href || (child.href !== '/sales/orders/new' && pathname.startsWith(child.href + '/'));
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={onMobileClose}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                            childActive
                              ? 'bg-navy-700 text-white'
                              : 'text-slate-400 hover:bg-navy-800 hover:text-white',
                          )}
                        >
                          <ChildIcon size={15} className="shrink-0" aria-hidden="true" />
                          <span>{child.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
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
