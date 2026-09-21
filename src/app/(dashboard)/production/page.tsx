'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import { ProductionFormDialog } from '@/features/production/components/ProductionFormDialog';
import { useGetProductsQuery, useDeleteProductMutation } from '@/features/products/services/productsApi';
import type { Product } from '@/features/products/types';

export default function ProductionPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useGetProductsQuery({ page, search: search || undefined });
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation();

  function openCreate() { setEditProduct(null); setOpen(true); }
  function openEdit(p: Product) { setEditProduct(p); setOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteProduct(deleteId).unwrap();
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<Product>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    { key: 'sku', header: 'SKU', priority: 'P1' },
    {
      key: 'currentStock', header: 'Stock', priority: 'P2',
      render: (row) => {
        const low = row.currentStock <= row.reorderLevel;
        const uom = typeof row.baseUom === 'object' ? (row.baseUom as { symbol: string }).symbol : '';
        return <span className={low ? 'text-amber-600 font-medium' : ''}>{row.currentStock}{uom ? ` ${uom}` : ''}</span>;
      },
    },
    {
      key: 'costPrice', header: 'Cost Price', priority: 'P3',
      render: (row) => row.costPrice > 0 ? formatCurrency(row.costPrice) : <span className="text-muted">—</span>,
    },
    {
      key: 'salePrice', header: 'Sale Price', priority: 'P2',
      render: (row) => row.salePrice ? formatCurrency(row.salePrice) : <span className="text-muted">—</span>,
    },
    {
      key: 'isActive', header: 'Status', priority: 'P2',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => router.push(`/production/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View"><Eye size={15} /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Edit" title="Edit"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Production"
        description="Create new products from raw materials"
        breadcrumbs={[{ label: 'Production' }]}
        actions={
          <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} aria-hidden="true" /> New Production
          </button>
        }
      />

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
        />
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data.items.length === 0 && !isLoading ? (
        <EmptyState
          title="No products found"
          description="Create your first production to get started."
          action={
            <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Production
            </button>
          }
        />
      ) : (
        <DataTable columns={columns} data={data?.data.items ?? []} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />
      )}

      <ProductionFormDialog open={open} onClose={() => setOpen(false)} product={editProduct} />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Product"
        description="This will soft-delete the product."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
