'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, ArrowLeft, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetItemQuery } from '@/features/inventory/services/inventoryApi';
import { useGetGoodsReceiptsQuery } from '@/features/procurement/services/procurementApi';
import { ItemFormDialog } from '@/features/inventory/components/ItemFormDialog';
import type { UOM, Supplier } from '@/features/inventory/types';
import type { GoodsReceipt } from '@/features/procurement/types';

const ITEM_TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: 'Raw Material',
  PACKAGING: 'Packaging',
  SEMI_FINISHED: 'Semi-Finished',
  FINISHED_GOOD: 'Finished Good',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [grPage, setGrPage] = useState(1);

  const { data, isLoading, isError, refetch } = useGetItemQuery(id, { skip: !id });
  const { data: grData, isLoading: grLoading } = useGetGoodsReceiptsQuery({ item: id, page: grPage }, { skip: !id });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.item) return <ErrorState onRetry={refetch} />;

  const item = data.data.item;
  const uom = typeof item.baseUom === 'string' ? null : (item.baseUom as UOM);
  const supplier = typeof item.supplier === 'string' ? null : (item.supplier as Supplier | undefined);
  const isLowStock = (item.reorderLevel ?? 0) > 0 && item.currentStock <= item.reorderLevel!;

  const grColumns: Column<GoodsReceipt>[] = [
    {
      key: 'grNumber', header: 'Receipt #', priority: 'P1',
      render: (row) => (
        <button
          onClick={() => router.push(`/procurement/receipts/${row._id}`)}
          className="font-medium text-emerald hover:underline"
        >
          {row.grNumber}
        </button>
      ),
    },
    {
      key: 'purchaseOrder', header: 'PO #', priority: 'P1',
      render: (row) => {
        const po = row.purchaseOrder as { _id: string; poNumber: string } | string | undefined;
        if (!po || typeof po === 'string') return '—';
        return (
          <button onClick={() => router.push(`/procurement/orders/${po._id}`)} className="text-emerald hover:underline">
            {po.poNumber}
          </button>
        );
      },
    },
    { key: 'receivedDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.receivedDate) },
    { key: 'totalAmount', header: 'Amount', priority: 'P1', render: (row) => formatCurrency(row.totalAmount) },
    {
      key: 'due', header: 'Due', priority: 'P1',
      render: (row) => {
        const po = typeof row.purchaseOrder === 'object' && row.purchaseOrder ? row.purchaseOrder as import('@/features/procurement/types').PurchaseOrder : null;
        if (!po) return '—';
        const due = po.totalAmount - po.paidAmount;
        if (due <= 0) return <span className="text-emerald-600 font-medium">Paid</span>;
        return <span className="text-red-600 font-semibold">{formatCurrency(due)}</span>;
      },
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P2',
      render: (row) => {
        const s = row.supplier as { _id: string; name: string } | string | undefined;
        return typeof s === 'object' && s ? (
          <button onClick={() => router.push(`/procurement/suppliers/${s._id}`)} className="text-emerald hover:underline">
            {s.name}
          </button>
        ) : '—';
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={item.name}
        description={
          <span className="flex items-center gap-2">
            <span>SKU: {item.sku}</span>
            {isLowStock && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> Low Stock
              </span>
            )}
          </span>
        }
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: item.name }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button onClick={() => setEditOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <InfoRow label="Name" value={<span className="text-lg font-bold text-foreground">{item.name}</span>} />
        <InfoRow label="SKU" value={item.sku} />
        <InfoRow label="Type" value={ITEM_TYPE_LABELS[item.type] ?? item.type} />
        <InfoRow label="Base UOM" value={uom ? `${uom.name} (${uom.symbol})` : (item.baseUom as string)} />
        <InfoRow label="Supplier" value={
          supplier ? (
            <button onClick={() => router.push(`/procurement/suppliers/${supplier._id}`)} className="text-emerald hover:underline">
              {supplier.name}
            </button>
          ) : '—'
        } />
        <InfoRow label="Status" value={<StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />} />
        <InfoRow label="Current Stock" value={
          <span className={`inline-flex items-center gap-1.5 font-semibold ${
            isLowStock ? 'text-red-600' : 'text-foreground'
          }`}>
            {isLowStock && <AlertTriangle size={13} className="shrink-0" />}
            {item.currentStock} {uom?.symbol ?? ''}
          </span>
        } />
        <InfoRow label="Low Stock Qty" value={item.reorderLevel ? `${item.reorderLevel} ${uom?.symbol ?? ''}` : '—'} />
        <InfoRow label="Cost Price" value={formatCurrency(item.costPrice)} />
        <InfoRow label="Last Purchase Price" value={item.lastPurchasePrice > 0 ? formatCurrency(item.lastPurchasePrice) : '—'} />
        <InfoRow label="Description" value={item.description || '—'} />
        <InfoRow label="Created" value={formatDate(item.createdAt)} />
      </div>

      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Purchase History</h2>
        </div>
        <div className="p-4">
          <DataTable
            columns={grColumns}
            data={grData?.data?.goodsReceipts ?? []}
            keyField="_id"
            isLoading={grLoading}
            pagination={grData?.pagination}
            onPageChange={setGrPage}
            emptyMessage="No purchases recorded yet."
          />
        </div>
      </div>

      <ItemFormDialog open={editOpen} item={item} onClose={() => setEditOpen(false)} />
    </>
  );
}
