'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetGoodsReceiptsQuery, useDeleteGoodsReceiptMutation } from '@/features/procurement/services/procurementApi';
import type { GoodsReceipt, Supplier, PurchaseOrder } from '@/features/procurement/types';

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useGetGoodsReceiptsQuery({ page });
  const [deleteGR, { isLoading: deleteLoading }] = useDeleteGoodsReceiptMutation();

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteGR(deleteId).unwrap();
    } catch {
      // error handled by RTK
    } finally {
      setDeleteId(null);
    }
  }

  const filtered = search
    ? (data?.data?.goodsReceipts ?? []).filter((gr) =>
        gr.grNumber.toLowerCase().includes(search.toLowerCase()) ||
        (typeof gr.supplier !== 'string' && (gr.supplier as Supplier).name.toLowerCase().includes(search.toLowerCase()))
      )
    : (data?.data?.goodsReceipts ?? []);

  const columns: Column<GoodsReceipt>[] = [
    {
      key: 'grNumber', header: 'GR Number', priority: 'P1',
      render: (row) => <span className="font-medium">{row.grNumber}</span>,
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P1',
      render: (row) => (typeof row.supplier === 'string' ? '—' : (row.supplier as Supplier).name),
    },
    {
      key: 'purchaseOrder', header: 'PO Number', priority: 'P2',
      render: (row) => typeof row.purchaseOrder === 'string' ? '—' : (row.purchaseOrder as PurchaseOrder).poNumber,
    },
    {
      key: 'receivedDate', header: 'Received Date', priority: 'P2',
      render: (row) => formatDate(row.receivedDate),
    },
    {
      key: 'totalAmount', header: 'Total', priority: 'P2',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'paymentStatus', header: 'Payment Status', priority: 'P2',
      render: (row) => {
        const po = typeof row.purchaseOrder === 'string' ? null : row.purchaseOrder as PurchaseOrder;
        const status = po?.paymentStatus;
        if (!status) return '—';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
            status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>{status}</span>
        );
      },
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[90px] text-right',
      render: (row) => {
        const hasActivePO = typeof row.purchaseOrder !== 'string' && (row.purchaseOrder as PurchaseOrder).isActive;
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => router.push(`/procurement/receipts/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View">
              <Eye size={15} />
            </button>
            {!hasActivePO && (
              <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Goods Receipts"
        description="All received goods from purchase orders"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Receipts' }]}
      />

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search GR number or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full sm:max-w-xs rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
        />
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : filtered.length === 0 && !isLoading ? (
        <EmptyState title="No goods receipts" description="Receipts will appear here once purchases are made." />
      ) : (
        <DataTable columns={columns} data={filtered} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Goods Receipt"
        description="This will delete the receipt. Note: receipts linked to an active purchase order cannot be deleted — delete the PO instead."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
