'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Eye, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const isActiveParam = statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined;

  const { data, isLoading, isError, refetch } = useGetProductsQuery({
    page,
    search: search || undefined,
    isActive: isActiveParam,
  });

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

  function clearFilters() {
    setSearch('');
    setStatusFilter('active');
    setLowStockOnly(false);
    setPage(1);
  }

  const allItems = data?.data.items ?? [];
  const items = lowStockOnly
    ? allItems.filter((p) => p.currentStock <= p.reorderLevel)
    : allItems;

  const hasActiveFilters = search || statusFilter !== 'active' || lowStockOnly;

  const columns: Column<Product>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => {
        const isLow = row.currentStock <= row.reorderLevel;
        return (
          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-foreground'}`}>
            {row.name}
          </span>
        );
      },
    },
    { key: 'sku', header: 'SKU', priority: 'P1' },
    {
      key: 'productionSources', header: 'Production Source', priority: 'P2',
      render: (row) => {
        const sources = row.productionSources ?? [];
        if (sources.length === 0) return <span className="text-muted">—</span>;
        const warehouseCount = sources.filter((source) => source.type === 'WAREHOUSE').length;
        const factoryCount = sources.filter((source) => source.type === 'FACTORY').length;
        return (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded px-1.5 py-1 text-xs text-secondary hover:bg-slate-50" title="Expand to view production identifiers">
              <span>{[warehouseCount > 0 && `Warehouse${warehouseCount > 1 ? ` (${warehouseCount})` : ''}`, factoryCount > 0 && `Factory${factoryCount > 1 ? ` (${factoryCount})` : ''}`].filter(Boolean).join(' · ')}</span>
              <ChevronDown size={13} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-1 space-y-1 border-l-2 border-border pl-2">
              {sources.map((source) => (
                <div key={`${source.type}-${source.identifier}`} className="flex items-center gap-2 text-xs">
                  <span className="text-secondary">{source.type === 'FACTORY' ? 'Factory' : 'Warehouse'}</span>
                  <span className="font-mono text-foreground" title={source.identifier}>{source.identifier}</span>
                </div>
              ))}
            </div>
          </details>
        );
      },
    },
    {
      key: 'currentStock', header: 'Stock', priority: 'P2',
      render: (row) => {
        const isLow = row.currentStock <= row.reorderLevel;
        const uom = typeof row.baseUom === 'object' ? (row.baseUom as { symbol: string }).symbol : '';
        return (
          <span className={`font-medium ${isLow ? 'text-red-500' : 'text-foreground'}`}>
            {row.currentStock}{uom ? ` ${uom}` : ''}
            {isLow && <span className="ml-1.5 text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Low</span>}
          </span>
        );
      },
    },
    {
      key: 'costPrice', header: 'Cost Price', priority: 'P3',
      render: (row) => row.costPrice > 0 ? <span className="font-medium text-blue-600">{formatCurrency(row.costPrice)}</span> : <span className="text-muted">—</span>,
    },
    {
      key: 'salePrice', header: 'Sale Price', priority: 'P2',
      render: (row) => row.salePrice ? <span className="font-medium text-emerald-600">{formatCurrency(row.salePrice)}</span> : <span className="text-muted">—</span>,
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

      {/* Search + filter bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`h-9 px-3 rounded-md border text-sm flex items-center gap-2 transition-colors ${showFilters ? 'border-emerald bg-emerald/5 text-emerald' : 'border-border text-secondary hover:bg-slate-50'}`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald" />}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-white flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-secondary">Status</span>
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 h-8 capitalize transition-colors ${statusFilter === s ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-50'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-secondary">Stock Level</span>
            <button
              onClick={() => setLowStockOnly((v) => !v)}
              className={`h-8 px-3 rounded-md border text-sm font-medium transition-colors flex items-center gap-2 ${lowStockOnly ? 'border-red-300 bg-red-50 text-red-600' : 'border-border text-secondary hover:bg-slate-50'}`}
            >
              <span className={`w-2 h-2 rounded-full ${lowStockOnly ? 'bg-red-500' : 'bg-slate-300'}`} />
              Low stock only
            </button>
          </div>
        </div>
      )}

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          title="No products found"
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first production to get started.'}
          action={
            !hasActiveFilters ? (
              <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <Plus size={16} aria-hidden="true" /> New Production
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={items} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />
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
