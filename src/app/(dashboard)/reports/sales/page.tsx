'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetSalesReportQuery, useGetSalesSummaryQuery } from '@/features/reports/services/reportsApi';
import type { SalesOrderRow } from '@/features/reports/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
const STATUSES = ['', 'DRAFT', 'CONFIRMED', 'DISPATCHED', 'CLOSED', 'CANCELLED'];

export default function SalesReportPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = { page, status: status || undefined, from: from || undefined, to: to || undefined };
  const { data, isLoading, isError, refetch } = useGetSalesReportQuery(params);
  const { data: summaryData } = useGetSalesSummaryQuery({ from: from || undefined, to: to || undefined });

  const summary = summaryData?.data;
  const totalRevenue = summary?.orderSummary.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalOrders = summary?.orderSummary.reduce((s, r) => s + r.count, 0) ?? 0;
  const totalDue = summary?.invoiceSummary.reduce((s, r) => s + r.dueAmount, 0) ?? 0;

  const csvParams = new URLSearchParams({ format: 'csv', ...(status && { status }), ...(from && { from }), ...(to && { to }) });
  const csvUrl = `${API_URL}/reports/sales?${csvParams}`;

  const columns: Column<SalesOrderRow>[] = [
    { key: 'orderNumber', header: 'Order #', priority: 'P2', render: (r) => <span className="font-mono text-[13px]">{r.orderNumber}</span> },
    { key: 'customer', header: 'Customer', priority: 'P1', render: (r) => <span className="font-medium">{r.customer?.name}</span> },
    { key: 'status', header: 'Status', priority: 'P1', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'totalAmount', header: 'Total', priority: 'P1', render: (r) => formatCurrency(r.totalAmount) },
    { key: 'discountAmount', header: 'Discount', priority: 'P3', render: (r) => formatCurrency(r.discountAmount) },
    { key: 'taxAmount', header: 'Tax', priority: 'P3', render: (r) => formatCurrency(r.taxAmount) },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Sales Report"
        description="Sales orders, invoices, and payment status"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Sales' }]}
        actions={
          <a href={csvUrl} download className="h-9 px-4 rounded-md border border-border bg-white text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Orders', value: totalOrders.toString() },
            { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
            { label: 'Outstanding Dues', value: formatCurrency(totalDue) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border border-border p-4">
              <p className="text-xs text-secondary uppercase tracking-wide">{label}</p>
              <p className="text-lg font-bold text-foreground mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {summary?.topCustomers && summary.topCustomers.length > 0 && (
        <div className="bg-white rounded-lg border border-border p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Top Customers</h2>
          <div className="space-y-2">
            {summary.topCustomers.slice(0, 5).map((c) => (
              <div key={c._id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{c.customerName}</span>
                <span className="text-secondary font-medium">{formatCurrency(c.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
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
        : data?.data?.orders?.length === 0 && !isLoading ? <EmptyState title="No sales orders" description="No orders match the selected filters." />
        : <DataTable columns={columns} data={data?.data?.orders ?? []} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />}
    </>
  );
}
