'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetItemQuery } from '@/features/inventory/services/inventoryApi';
import { ItemFormDialog } from '@/features/inventory/components/ItemFormDialog';
import type { UOM } from '@/features/inventory/types';

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

  const { data, isLoading, isError, refetch } = useGetItemQuery(id);
  const item = data?.data;

  if (isLoading) return <LoadingSpinner />;
  if (isError || !item) return <ErrorState onRetry={refetch} />;

  const uom = typeof item.baseUom === 'string' ? null : (item.baseUom as UOM);
  const isLowStock = item.currentStock <= item.reorderLevel;

  return (
    <>
      <PageHeader
        title={item.name}
        description={`SKU: ${item.sku}`}
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: item.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
          </div>
        }
      />

      {/* Info grid */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InfoRow label="Name" value={item.name} />
        <InfoRow label="SKU" value={item.sku} />
        <InfoRow label="Type" value={ITEM_TYPE_LABELS[item.type] ?? item.type} />
        <InfoRow label="Category" value={item.category} />
        <InfoRow label="Base UOM" value={uom ? `${uom.name} (${uom.symbol})` : (item.baseUom as string)} />
        <InfoRow label="Status" value={<StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />} />
        <InfoRow
          label="Current Stock"
          value={
            <span className={isLowStock ? 'text-amber-600 font-medium' : ''}>
              {item.currentStock} {uom?.symbol ?? ''}
              {isLowStock && <span className="ml-2 text-xs text-amber-600">(Low stock)</span>}
            </span>
          }
        />
        <InfoRow label="Reorder Level" value={`${item.reorderLevel} ${uom?.symbol ?? ''}`} />
        <InfoRow label="Cost Price" value={formatCurrency(item.costPrice)} />
        <InfoRow label="Sale Price" value={item.salePrice != null ? formatCurrency(item.salePrice) : '—'} />
        <InfoRow label="Description" value={item.description || '—'} />
        <InfoRow label="Created" value={formatDate(item.createdAt)} />
      </div>

      <ItemFormDialog
        open={editOpen}
        item={item}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
