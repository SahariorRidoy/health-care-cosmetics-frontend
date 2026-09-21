'use client';

import Link from 'next/link';
import { ShoppingCart, AlertCircle, Package, TrendingDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { StatusBadge } from '@/components/feedback';
import type { PurchaseSummary } from '@/features/reports/types';

interface Props {
  purchase: PurchaseSummary | undefined;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardProcurementPanel({ purchase }: Props) {
  const orderSummary = purchase?.orderSummary ?? [];
  const topSuppliers = purchase?.topSuppliers ?? [];
  const supplierDues = purchase?.supplierDues ?? [];
  const totalPO = orderSummary.reduce((s, r) => s + r.count, 0);
  const totalPOValue = orderSummary.reduce((s, r) => s + r.totalAmount, 0);
  const totalDues = supplierDues.reduce((s, r) => s + r.balance, 0);
  const maxSupplierAmount = topSuppliers[0]?.totalAmount ?? 1;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-orange-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
            <ShoppingCart size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Procurement Overview</h2>
            <p className="text-[11px] text-secondary">Purchase orders, suppliers & outstanding dues</p>
          </div>
        </div>
        <Link href="/procurement/orders" className="text-xs text-orange-600 hover:underline font-semibold">
          View orders →
        </Link>
      </div>

      <div className="p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-orange-600" />
              <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">Purchase Orders</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{formatNumber(totalPO, 0)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={14} className="text-blue-600" />
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Total PO Value</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalPOValue)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Outstanding Dues</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDues)}</p>
            <p className="text-[10px] text-red-400 mt-0.5">{supplierDues.length} suppliers</p>
          </div>
        </div>

        {/* 3-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PO Status */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">Order Status</p>
            {orderSummary.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <div className="space-y-3">
                {orderSummary.map((row) => {
                  const pct = totalPO > 0 ? Math.round((row.count / totalPO) * 100) : 0;
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
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Suppliers */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">Top Suppliers</p>
            {topSuppliers.length === 0 ? (
              <p className="text-xs text-muted">No data.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {topSuppliers.slice(0, 8).map((s, i) => (
                  <div key={s._id}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-muted w-4 shrink-0">#{i + 1}</span>
                        <span className="text-foreground truncate">{s.supplierName}</span>
                      </div>
                      <span className="font-semibold text-foreground shrink-0 ml-2">{formatCurrency(s.totalAmount)}</span>
                    </div>
                    <Bar value={s.totalAmount} max={maxSupplierAmount} color="bg-orange-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Dues */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <TrendingDown size={12} className="text-red-500" />
                <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Supplier Dues</p>
              </div>
              {totalDues > 0 && (
                <span className="text-xs font-bold text-red-600">{formatCurrency(totalDues)}</span>
              )}
            </div>
            {supplierDues.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <AlertCircle size={12} /> No outstanding dues
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {supplierDues.slice(0, 8).map((s) => (
                  <div key={s._id} className="flex items-center justify-between text-xs p-2 bg-red-50 rounded-lg">
                    <span className="text-foreground truncate max-w-[60%]">{s.name}</span>
                    <span className="font-bold text-red-600 shrink-0">{formatCurrency(s.balance)}</span>
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
