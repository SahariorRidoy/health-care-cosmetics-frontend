'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetFinanceReportQuery, useGetFinanceSummaryReportQuery } from '@/features/reports/services/reportsApi';
import type { ExpenseRow } from '@/features/reports/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export default function FinanceReportPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = { page, status: status || undefined, from: from || undefined, to: to || undefined };
  const { data, isLoading, isError, refetch } = useGetFinanceReportQuery(params);
  const { data: summaryData } = useGetFinanceSummaryReportQuery({ from: from || undefined, to: to || undefined });

  const summary = summaryData?.data;
  const totalExpenses = summary?.expenseByStatus.reduce((s, r) => s + r.total, 0) ?? 0;
  const paid = summary?.expenseByStatus.find((r) => r._id === 'PAID')?.total ?? 0;
  const pending = summary?.expenseByStatus.find((r) => r._id === 'PENDING')?.total ?? 0;

  const csvParams = new URLSearchParams({ format: 'csv', ...(status && { status }), ...(from && { from }), ...(to && { to }) });
  const csvUrl = `${API_URL}/reports/finance?${csvParams}`;

  const columns: Column<ExpenseRow>[] = [
    { key: 'expenseNumber', header: 'Ref #', priority: 'P2', render: (r) => <span className="font-mono text-[13px]">{r.expenseNumber}</span> },
    { key: 'description', header: 'Description', priority: 'P1', render: (r) => <span className="font-medium">{r.description}</span> },
    { key: 'category', header: 'Category', priority: 'P2', render: (r) => r.category?.name ?? '—' },
    { key: 'amount', header: 'Amount', priority: 'P1', render: (r) => formatCurrency(r.amount) },
    { key: 'expenseDate', header: 'Date', priority: 'P2', render: (r) => formatDate(r.expenseDate) },
    { key: 'paidBy', header: 'Paid By', priority: 'P3' },
    { key: 'status', header: 'Status', priority: 'P1', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Finance Report"
        description="Expenses by category and period"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Finance' }]}
        actions={
          <a href={csvUrl} download className="h-9 px-4 rounded-md border border-border bg-white text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Expenses', value: formatCurrency(totalExpenses) },
            { label: 'Paid', value: formatCurrency(paid) },
            { label: 'Pending', value: formatCurrency(pending) },
            { label: 'Supplier Payables', value: formatCurrency(summary.payables.total) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border border-border p-4">
              <p className="text-xs text-secondary uppercase tracking-wide">{label}</p>
              <p className="text-lg font-bold text-foreground mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {summary?.expenseByCategory && summary.expenseByCategory.length > 0 && (
        <div className="bg-white rounded-lg border border-border p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">By Category</h2>
          <div className="space-y-2">
            {summary.expenseByCategory.map((c) => {
              const pct = totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0;
              return (
                <div key={c._id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{c.categoryName}</span>
                    <span className="text-secondary">{formatCurrency(c.total)} <span className="text-muted">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald rounded-full" style={{ width: `${pct}%` }}
                      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-sm text-secondary whitespace-nowrap shrink-0">From</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald min-w-0" />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-sm text-secondary whitespace-nowrap shrink-0">To</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald min-w-0" />
        </div>
        {(status || from || to) && (
          <button onClick={() => { setStatus(''); setFrom(''); setTo(''); setPage(1); }}
            className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 transition-colors">Clear</button>
        )}
      </div>

      {isError ? <ErrorState onRetry={refetch} />
        : data?.data?.expenses?.length === 0 && !isLoading ? <EmptyState title="No expenses" description="No expenses match the selected filters." />
        : <DataTable columns={columns} data={data?.data?.expenses ?? []} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />}
    </>
  );
}
