'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate, formatNumber } from '@/lib/formatters';
import {
  useGetProductionReportQuery,
  useGetProductionSummaryQuery,
} from '@/features/reports/services/reportsApi';
import type { ProductionOrderRow } from '@/features/reports/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

const STATUSES = ['', 'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];

export default function ProductionReportPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = { page, status: status || undefined, from: from || undefined, to: to || undefined };
  const { data, isLoading, isError, refetch } = useGetProductionReportQuery(params);
  const { data: summaryData } = useGetProductionSummaryQuery({ from: from || undefined, to: to || undefined });

  const summaryRows = summaryData?.data?.summary ?? [];
  const totalOrders = summaryRows.reduce((s, r) => s + r.count, 0);
  const completed = summaryRows.find((r) => r._id === 'COMPLETED')?.count ?? 0;
  const inProgressCount = summaryRows.find((r) => r._id === 'IN_PROGRESS')?.count ?? 0;
  const totalOutput = summaryRows.reduce((s, r) => s + r.totalOutput, 0);
  const totalWastage = summaryRows.reduce((s, r) => s + r.totalWastage, 0);

  const csvParams = new URLSearchParams({ format: 'csv', ...(status && { status }), ...(from && { from }), ...(to && { to }) });
  const csvUrl = `${API_URL}/reports/production?${csvParams}`;

  const columns: Column<ProductionOrderRow>[] = [
    {
      key: 'woNumber', header: 'WO #', priority: 'P2',
      render: (row) => <span className="font-mono text-[13px]">{row.woNumber}</span>,
    },
    {
      key: 'product', header: 'Product', priority: 'P1',
      render: (row) => <span className="font-medium">{row.product?.name}</span>,
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'plannedQty', header: 'Planned', priority: 'P2',
      render: (row) => formatNumber(row.plannedQty, 0),
    },
    {
      key: 'actualOutputQty', header: 'Output', priority: 'P1',
      render: (row) => formatNumber(row.actualOutputQty, 0),
    },
    {
      key: 'wastageQty', header: 'Wastage', priority: 'P2',
      render: (row) => formatNumber(row.wastageQty, 0),
    },
    {
      key: 'startDate', header: 'Start Date', priority: 'P3',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'completedDate', header: 'Completed', priority: 'P3',
      render: (row) => formatDate(row.completedDate),
    },
  ];

  return (
    <>
      <PageHeader
        title="Production Report"
        description="Production orders, output, and wastage"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Production' }]}
        actions={
          <a
            href={csvUrl}
            download
            className="h-9 px-4 rounded-md border border-border bg-white text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />

      {/* Summary cards */}
      {summaryRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Orders', value: totalOrders },
            { label: 'Completed', value: completed },
            { label: 'In Progress', value: inProgressCount },
            { label: 'Total Output', value: totalOutput },
            { label: 'Total Wastage', value: totalWastage },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border border-border p-4">
              <p className="text-xs text-secondary uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{formatNumber(value, 0)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
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
          <button
            onClick={() => { setStatus(''); setFrom(''); setTo(''); setPage(1); }}
            className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.orders?.length === 0 && !isLoading ? (
        <EmptyState title="No production orders" description="No orders match the selected filters." />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.orders ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
