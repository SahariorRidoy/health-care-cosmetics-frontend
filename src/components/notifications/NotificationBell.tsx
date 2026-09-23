'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Package, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/formatters';
import { useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { useGetCustomersQuery } from '@/features/sales/services/salesApi';
import type { StockBalance } from '@/features/inventory/types';
import type { Customer } from '@/features/sales/types';

interface Notification {
  id: string;
  type: 'low_stock' | 'overdue_dues';
  title: string;
  detail: string;
  href: string;
}

function buildNotifications(
  balances: StockBalance[],
  customers: Customer[],
): Notification[] {
  const stockAlerts: Notification[] = balances.map((b) => {
    const item = typeof b.item === 'object' ? b.item : null;
    return {
      id: `stock-${b._id}`,
      type: 'low_stock',
      title: item?.name ?? 'Unknown item',
      detail: `Stock: ${b.quantity} (reorder: ${item?.reorderLevel ?? '—'})`,
      href: '/inventory/stock',
    };
  });

  const duesAlerts: Notification[] = customers
    .filter((c) => c.balance > 0)
    .map((c) => ({
      id: `dues-${c._id}`,
      type: 'overdue_dues',
      title: c.name,
      detail: `Outstanding: ${formatCurrency(c.balance)}`,
      href: `/sales/customers/${c._id}`,
    }));

  return [...stockAlerts, ...duesAlerts];
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: stockData } = useGetStockBalancesQuery(
    { lowStock: true, page: 1 },
    { pollingInterval: 5 * 60 * 1000 },
  );
  const { data: customersData } = useGetCustomersQuery(
    { page: 1 },
    { pollingInterval: 5 * 60 * 1000 },
  );

  const balances = stockData?.data?.balances ?? [];
  const customers = customersData?.data?.customers ?? [];
  const notifications = buildNotifications(balances, customers);
  const count = notifications.length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-secondary hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
        aria-label={`Notifications${count > 0 ? ` (${count} alerts)` : ''}`}
        title="Notifications"
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            'absolute right-0 top-full mt-1 z-50',
            'w-[320px] max-w-[calc(100vw-2rem)]',
            'bg-white rounded-lg border border-border shadow-lg',
            'overflow-hidden',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Alerts</span>
            {count > 0 && (
              <span className="text-xs text-muted">{count} active</span>
            )}
          </div>

          {/* List */}
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <li className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell size={28} className="text-muted mb-2" aria-hidden="true" />
                <p className="text-sm text-secondary">No alerts right now</p>
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 w-7 h-7 rounded-md flex items-center justify-center',
                        n.type === 'low_stock'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-red-100 text-red-500',
                      )}
                    >
                      {n.type === 'low_stock'
                        ? <Package size={14} aria-hidden="true" />
                        : <AlertCircle size={14} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5">{n.detail}</p>
                      <p className="text-[11px] text-muted mt-0.5 capitalize">
                        {n.type === 'low_stock' ? 'Low stock' : 'Outstanding dues'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>

          {/* Footer links */}
          {notifications.length > 0 && (
            <div className="flex border-t border-border divide-x divide-border">
              <Link
                href="/materials/stock"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 text-center text-xs text-secondary hover:text-foreground hover:bg-slate-50 transition-colors"
              >
                View stock
              </Link>
              <Link
                href="/sales/customers"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 text-center text-xs text-secondary hover:text-foreground hover:bg-slate-50 transition-colors"
              >
                View dues
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
