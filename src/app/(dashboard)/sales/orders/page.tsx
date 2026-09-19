'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Eye } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetSalesOrdersQuery } from '@/features/sales/services/salesApi';
import type { SalesOrder, Customer } from '@/features/sales/types';

const STATUS_OPTIONS = ['DRAFT', 'CONFIRMED', 'DISPATCHED', 'CLOSED', 'CANCELLED'];

export default function SalesOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch } = useGetSalesOrdersQuery({
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const columns: Column<SalesOrder>[] = [
    {
      key: 'orderNumber', header: 'Order #', priority: 'P1',
      render: (row) => <span className="font-medium">{row.orderNumber}</span>,
    },
    {
      key: 'customer', header: 'Customer', priority: 'P1',
      render: (row) => {
        const c = typeof row.customer === 'string' ? null : row.customer as Customer;
        return c?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    {
      key: 'deliveryDate', header: 'Delivery', priority: 'P3',
      render: (row) => row.deliveryDate ? formatDate(row.deliveryDate) : '—',
    },
    { key: 'totalAmount', header: 'Total', priority: 'P2', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[60px] text-right',
      render: (row) => (
        <button
          onClick={() => router.push(`/sales/orders/${row._id}`)}
          className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
          aria-label="View order" title="View"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales Orders"
        description="Manage customer orders and dispatch"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Orders' }]}
        actions={
          <button
            onClick={() => router.push('/sales/orders/new')}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Order
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search order number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.salesOrders?.length === 0 && !isLoading ? (
        <EmptyState
          title="No sales orders"
          description="Create your first sales order."
          action={
            <button onClick={() => router.push('/sales/orders/new')} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Order
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.salesOrders ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
