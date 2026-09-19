'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Eye } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { useGetProductionOrdersQuery } from '@/features/production/services/productionApi';
import type { ProductionOrder } from '@/features/production/types';

export default function ProductionOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch } = useGetProductionOrdersQuery({
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const columns: Column<ProductionOrder>[] = [
    {
      key: 'woNumber', header: 'WO Number', priority: 'P1',
      render: (row) => <span className="font-medium">{row.woNumber}</span>,
    },
    {
      key: 'product', header: 'Product', priority: 'P1',
      render: (row) => {
        const p = typeof row.product === 'string' ? null : row.product as { name: string };
        return p?.name ?? '—';
      },
    },
    {
      key: 'plannedQty', header: 'Planned Qty', priority: 'P2',
      render: (row) => row.plannedQty.toString(),
    },
    {
      key: 'actualOutputQty', header: 'Output Qty', priority: 'P3',
      render: (row) => row.actualOutputQty > 0 ? row.actualOutputQty.toString() : '—',
    },
    {
      key: 'startDate', header: 'Start Date', priority: 'P2',
      render: (row) => row.startDate ? formatDate(row.startDate) : '—',
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[60px] text-right',
      render: (row) => (
        <button
          onClick={() => router.push(`/production/orders/${row._id}`)}
          className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
          aria-label="View order"
          title="View"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Production Orders"
        description="Manage work orders and production runs"
        breadcrumbs={[{ label: 'Production' }, { label: 'Orders' }]}
        actions={
          <button
            onClick={() => router.push('/production/orders/new')}
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
            placeholder="Search WO number…"
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
          <option value="DRAFT">Draft</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.productionOrders?.length === 0 && !isLoading ? (
        <EmptyState
          title="No production orders"
          description="Create your first production order."
          action={
            <button
              onClick={() => router.push('/production/orders/new')}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New Order
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.productionOrders ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
