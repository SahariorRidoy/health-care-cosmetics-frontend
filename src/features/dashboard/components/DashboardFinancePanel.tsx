'use client';

import Link from 'next/link';
import { DollarSign, TrendingUp, TrendingDown, CheckCircle, Clock, BarChart3, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { FinanceSummary } from '@/features/finance/types';
import type { SalesSummary } from '@/features/reports/types';

interface Props {
  fin: FinanceSummary | undefined;
  sales: SalesSummary | undefined;
  totalRevenue: number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardFinancePanel({ fin, sales, totalRevenue }: Props) {
  const totalExpenses = fin?.expenses.total ?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const netPositive = netProfit >= 0;
  const maxVal = Math.max(totalRevenue, totalExpenses, 1);

  const invoiceSummary = sales?.invoiceSummary ?? [];
  const totalInvoiced = invoiceSummary.reduce((s, r) => s + r.totalAmount, 0);
  const totalPaid = invoiceSummary.reduce((s, r) => s + r.paidAmount, 0);
  const totalDue = invoiceSummary.reduce((s, r) => s + r.dueAmount, 0);
  const collectionPct = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  const categories = fin?.expenses.byCategory ?? [];

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <DollarSign size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Financial Overview</h2>
            <p className="text-[11px] text-secondary">Revenue, expenses & collection summary</p>
          </div>
        </div>
        <Link href="/finance/summary" className="text-xs text-blue-600 hover:underline font-semibold">
          Full summary →
        </Link>
      </div>

      <div className="p-6">
        {/* Top KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Revenue</span>
            </div>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={14} className="text-red-500" />
              <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Expenses</span>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className={`border rounded-xl p-4 ${netPositive ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={14} className={netPositive ? 'text-blue-600' : 'text-orange-500'} />
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${netPositive ? 'text-blue-700' : 'text-orange-600'}`}>
                Net {netPositive ? 'Profit' : 'Loss'}
              </span>
            </div>
            <p className={`text-xl font-bold ${netPositive ? 'text-blue-700' : 'text-orange-600'}`}>
              {formatCurrency(Math.abs(netProfit))}
            </p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={14} className="text-violet-600" />
              <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">Payables</span>
            </div>
            <p className="text-xl font-bold text-violet-700">{formatCurrency(fin?.payables.total ?? 0)}</p>
            <p className="text-[10px] text-violet-500 mt-0.5">{fin?.payables.supplierCount ?? 0} suppliers</p>
          </div>
        </div>

        {/* Revenue vs Expenses bars + Paid/Pending + Invoice + Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Expenses */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Revenue vs Expenses</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-secondary font-medium">Revenue</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span>
                </div>
                <Bar value={totalRevenue} max={maxVal} color="bg-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-secondary font-medium">Expenses</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalExpenses)}</span>
                </div>
                <Bar value={totalExpenses} max={maxVal} color="bg-red-400" />
              </div>
            </div>
            {/* Paid vs Pending */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle size={12} className="text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Paid</span>
                </div>
                <p className="text-base font-bold text-emerald-700">{formatCurrency(fin?.expenses.paid.total ?? 0)}</p>
                <p className="text-[10px] text-emerald-600">{fin?.expenses.paid.count ?? 0} expenses</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={12} className="text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Pending</span>
                </div>
                <p className="text-base font-bold text-amber-700">{formatCurrency(fin?.expenses.pending.total ?? 0)}</p>
                <p className="text-[10px] text-amber-600">{fin?.expenses.pending.count ?? 0} expenses</p>
              </div>
            </div>
          </div>

          {/* Invoice Collection */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-4">Invoice Collection</p>
            {totalInvoiced === 0 ? (
              <p className="text-xs text-muted">No invoice data.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">Collection Rate</span>
                  <span className={`text-sm font-bold ${collectionPct >= 80 ? 'text-emerald-600' : collectionPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                    {collectionPct}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${collectionPct >= 80 ? 'bg-emerald-500' : collectionPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${collectionPct}%` }}
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">Total Invoiced</span>
                    <span className="font-semibold text-foreground">{formatCurrency(totalInvoiced)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">Collected</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">Outstanding</span>
                    <span className="font-bold text-red-600">{formatCurrency(totalDue)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-base font-bold text-foreground">{formatCurrency(fin?.receivables.total ?? 0)}</p>
                    <p className="text-[10px] text-secondary uppercase tracking-wide">Receivables</p>
                    <p className="text-[10px] text-muted">{fin?.receivables.customerCount ?? 0} customers</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-base font-bold text-foreground">{formatCurrency(fin?.payables.total ?? 0)}</p>
                    <p className="text-[10px] text-secondary uppercase tracking-wide">Payables</p>
                    <p className="text-[10px] text-muted">{fin?.payables.supplierCount ?? 0} suppliers</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Expense Categories */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-4">Expenses by Category</p>
            {categories.length === 0 ? (
              <p className="text-xs text-muted">No category data.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {categories.slice(0, 8).map((c) => (
                  <div key={c._id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-foreground truncate max-w-[60%]">{c.categoryName}</span>
                      <span className="text-secondary shrink-0">{formatCurrency(c.total)}</span>
                    </div>
                    <Bar value={c.total} max={totalExpenses} color="bg-blue-400" />
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
