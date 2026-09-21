'use client';

import Link from 'next/link';
import { TrendingUp, Star, UserCheck, ShoppingBag } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { StatusBadge } from '@/components/feedback';
import type { SalesSummary } from '@/features/reports/types';

interface Props {
  sales: SalesSummary | undefined;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardSalesPanel({ sales }: Props) {
  const topProducts = sales?.topProducts ?? [];
  const topCustomers = sales?.topCustomers ?? [];
  const orderSummary = sales?.orderSummary ?? [];
  const maxProductRevenue = topProducts[0]?.totalRevenue ?? 1;
  const maxCustomerAmount = topCustomers[0]?.totalAmount ?? 1;
  const totalOrders = orderSummary.reduce((s, r) => s + r.count, 0);
  const totalRevenue = orderSummary.reduce((s, r) => s + r.totalAmount, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Sales Overview</h2>
            <p className="text-[11px] text-secondary">Orders, products & customer performance</p>
          </div>
        </div>
        <Link href="/reports/sales" className="text-xs text-emerald-600 hover:underline font-semibold">
          View report →
        </Link>
      </div>

      <div className="p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag size={14} className="text-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Total Orders</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{formatNumber(totalOrders, 0)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-blue-600" />
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <Star size={14} className="text-violet-600" />
              <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">Avg Order Value</span>
            </div>
            <p className="text-2xl font-bold text-violet-700">{formatCurrency(avgOrderValue)}</p>
          </div>
        </div>

        {/* 3-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Status */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">Order Status</p>
            {orderSummary.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <div className="space-y-3">
                {orderSummary.map((row) => {
                  const pct = totalOrders > 0 ? Math.round((row.count / totalOrders) * 100) : 0;
                  return (
                    <div key={row._id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <StatusBadge status={row._id} />
                        <span className="text-secondary shrink-0">{row.count} ({pct}%)</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">Value</span>
                        <span className="font-semibold text-foreground">{formatCurrency(row.totalAmount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Star size={12} className="text-amber-500" />
              <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Top Products</p>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {topProducts.slice(0, 8).map((p, i) => (
                  <div key={p._id}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-muted w-4 shrink-0">#{i + 1}</span>
                        <span className="text-foreground truncate">{p.itemName}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-semibold text-foreground">{formatCurrency(p.totalRevenue)}</span>
                        <span className="text-muted ml-1 text-[10px]">{formatNumber(p.totalQty, 0)} u</span>
                      </div>
                    </div>
                    <Bar value={p.totalRevenue} max={maxProductRevenue} color="bg-amber-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <UserCheck size={12} className="text-blue-500" />
              <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Top Customers</p>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {topCustomers.slice(0, 8).map((c, i) => (
                  <div key={c._id}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-muted w-4 shrink-0">#{i + 1}</span>
                        <span className="text-foreground truncate">{c.customerName}</span>
                      </div>
                      <span className="font-semibold text-foreground shrink-0 ml-2">{formatCurrency(c.totalAmount)}</span>
                    </div>
                    <Bar value={c.totalAmount} max={maxCustomerAmount} color="bg-blue-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
