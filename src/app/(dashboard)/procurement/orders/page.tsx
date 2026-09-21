'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetPurchaseOrdersQuery, useDeletePurchaseOrderMutation } from '@/features/procurement/services/procurementApi';
import type { PurchaseOrder, Supplier } from '@/features/procurement/types';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useGetPurchaseOrdersQuery({
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const [deletePO, { isLoading: deleteLoading }] = useDeletePurchaseOrderMutation();

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePO(deleteId).unwrap();
      setDeleteId(null);
    } catch {
      // error handled by RTK
    }
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'poNumber', header: 'PO Number', priority: 'P1',
      render: (row) => <span className="font-medium">{row.poNumber}</span>,
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P1',
      render: (row) => {
        const s = typeof row.supplier === 'string' ? null : row.supplier as Supplier;
        return s?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    {
      key: 'totalAmount', header: 'Total', priority: 'P2',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'paymentStatus', header: 'Payment', priority: 'P2',
      render: (row) => <StatusBadge status={row.paymentStatus ?? 'UNPAID'} />,
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[90px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => router.push(`/procurement/orders/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View">
            <Eye size={15} />
          </button>
          {(
            <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Manage purchase orders and goods receipts"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Orders' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" placeholder="Search PO number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="RECEIVED">Received</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.purchaseOrders?.length === 0 && !isLoading ? (
        <EmptyState title="No purchase orders" description="Purchase orders will appear here once created from materials." />
      ) : (
        <DataTable columns={columns} data={data?.data?.purchaseOrders ?? []} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Purchase Order"
        description="This will permanently delete the purchase order. Only DRAFT orders can be deleted."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
