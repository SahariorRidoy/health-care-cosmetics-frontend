'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Eye, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import { useGetDealersQuery } from '@/features/sales/services/salesApi';
import { DealerFormDialog } from '@/features/sales/components/DealerFormDialog';
import type { Dealer } from '@/features/sales/types';

export default function DealersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editDealer, setEditDealer] = useState<Dealer | null>(null);

  const { data, isLoading, isError, refetch } = useGetDealersQuery({
    page,
    search: search || undefined,
  });

  const columns: Column<Dealer>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'phone', header: 'Phone', priority: 'P3', render: (row) => row.phone ?? '—' },
    {
      key: 'commissionRate', header: 'Commission', priority: 'P2',
      render: (row) => (
        <span className="text-violet-600 font-medium">
          {row.commissionRate > 0 ? `${row.commissionRate}%` : '—'}
        </span>
      ),
    },
    {
      key: 'balance', header: 'Outstanding', priority: 'P2',
      render: (row) => (
        <span className={row.balance > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      key: 'isActive', header: 'Status', priority: 'P2',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setEditDealer(row)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit dealer" title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => router.push(`/sales/dealers/${row._id}`)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View dealer" title="View"
          >
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Dealers"
        description="Manage dealer accounts and commissions"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Dealers' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Dealer
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search dealers…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.dealers?.length === 0 && !isLoading ? (
        <EmptyState
          title="No dealers yet"
          description="Add your first dealer to get started."
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New Dealer
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.dealers ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <DealerFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <DealerFormDialog open={!!editDealer} dealer={editDealer} onClose={() => setEditDealer(null)} />
    </>
  );
}
