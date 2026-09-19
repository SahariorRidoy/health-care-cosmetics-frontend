'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetInvoicesQuery } from '@/features/sales/services/salesApi';
import type { Invoice, Customer } from '@/features/sales/types';

const STATUS_OPTIONS = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'];

export default function InvoicesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch } = useGetInvoicesQuery({
    page,
    status: statusFilter || undefined,
  });

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber', header: 'Invoice #', priority: 'P1',
      render: (row) => <span className="font-medium">{row.invoiceNumber}</span>,
    },
    {
      key: 'customer', header: 'Customer', priority: 'P1',
      render: (row) => {
        const c = typeof row.customer === 'string' ? null : row.customer as Customer;
        return c?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    { key: 'dueDate', header: 'Due Date', priority: 'P3', render: (row) => row.dueDate ? formatDate(row.dueDate) : '—' },
    { key: 'totalAmount', header: 'Total', priority: 'P2', render: (row) => formatCurrency(row.totalAmount) },
    {
      key: 'dueAmount', header: 'Due', priority: 'P1',
      render: (row) => (
        <span className={row.dueAmount > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
          {formatCurrency(row.dueAmount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[60px] text-right',
      render: (row) => (
        <button
          onClick={() => router.push(`/sales/invoices/${row._id}`)}
          className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
          aria-label="View invoice" title="View"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="View and manage customer invoices"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Invoices' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.invoices?.length === 0 && !isLoading ? (
        <EmptyState title="No invoices found" description="Invoices are created from confirmed sales orders." />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.invoices ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
