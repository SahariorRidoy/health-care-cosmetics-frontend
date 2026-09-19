'use client';

import { useState } from 'react';
import { TrendingDown, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState, LoadingSpinner } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import { useGetFinanceSummaryQuery } from '@/features/finance/services/financeApi';

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default function FinanceSummaryPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, isError, refetch } = useGetFinanceSummaryQuery({
    from: from || undefined,
    to: to || undefined,
  });

  const summary = data?.data;

  return (
    <>
      <PageHeader
        title="Finance Summary"
        description="Overview of expenses, payables, and receivables"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Summary' }]}
      />

      {/* Date range filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-sm text-secondary whitespace-nowrap shrink-0">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-sm text-secondary whitespace-nowrap shrink-0">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald min-w-0"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => { setFrom(''); setTo(''); }}
            className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <LoadingSpinner />
      ) : summary ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Expenses"
              value={formatCurrency(summary.expenses.total)}
              sub={`${(summary.expenses.paid.count + summary.expenses.pending.count)} records`}
              icon={TrendingDown}
              color="bg-red-50 text-red-500"
            />
            <StatCard
              label="Paid Expenses"
              value={formatCurrency(summary.expenses.paid.total)}
              sub={`${summary.expenses.paid.count} paid`}
              icon={CheckCircle2}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Pending Expenses"
              value={formatCurrency(summary.expenses.pending.total)}
              sub={`${summary.expenses.pending.count} pending`}
              icon={AlertCircle}
              color="bg-amber-50 text-amber-500"
            />
            <StatCard
              label="Supplier Payables"
              value={formatCurrency(summary.payables.total)}
              sub={`${summary.payables.supplierCount} suppliers`}
              icon={TrendingDown}
              color="bg-orange-50 text-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Receivables card */}
            <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
              <h2 className="text-base font-semibold text-foreground mb-4">Customer Receivables</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.receivables.total)}</p>
                  <p className="text-xs text-muted mt-1">{summary.receivables.customerCount} customers with outstanding balance</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-500">
                  <TrendingUp size={20} aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Expenses by category */}
            <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
              <h2 className="text-base font-semibold text-foreground mb-4">Expenses by Category</h2>
              {summary.expenses.byCategory.length === 0 ? (
                <p className="text-sm text-muted">No expense data for this period.</p>
              ) : (
                <div className="space-y-3">
                  {summary.expenses.byCategory.map((cat) => {
                    const pct = summary.expenses.total > 0
                      ? Math.round((cat.total / summary.expenses.total) * 100)
                      : 0;
                    return (
                      <div key={cat._id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-foreground font-medium">{cat.categoryName}</span>
                          <span className="text-secondary">{formatCurrency(cat.total)} <span className="text-muted">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald rounded-full"
                            style={{ width: `${pct}%` }}
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
