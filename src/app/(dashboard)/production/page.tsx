'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Eye, SlidersHorizontal, X, ChevronDown, Package, TrendingDown, DollarSign, Layers } from 'lucide-react';
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
  const items = lowStockOnly ? allItems.filter((p) => p.currentStock <= p.reorderLevel) : allItems;
  const hasActiveFilters = search || statusFilter !== 'active' || lowStockOnly;

  // Stats
  const totalProducts = data?.pagination?.total ?? allItems.length;
  const activeCount = allItems.filter((p) => p.isActive).length;
  const lowStockCount = allItems.filter((p) => p.currentStock <= p.reorderLevel).length;
  const totalStockValue = allItems.reduce((s, p) => s + (p.currentStock * (p.costPrice ?? 0)), 0);

  const columns: Column<Product>[] = [
    {
      key: 'name', header: 'Product', priority: 'P1',
      render: (row) => {
        const isLow = row.currentStock <= row.reorderLevel;
        return (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isLow ? 'bg-red-100' : 'bg-emerald-50'}`}>
              <Package size={14} className={isLow ? 'text-red-500' : 'text-emerald-600'} />
            </div>
            <div className="min-w-0">
              <p className={`font-semibold text-sm truncate ${isLow ? 'text-red-600' : 'text-foreground'}`}>{row.name}</p>
              <p className="text-xs text-muted font-mono">{row.sku}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'productionSources', header: 'Source', priority: 'P2',
      render: (row) => {
        const sources = row.productionSources ?? [];
        if (sources.length === 0) return <span className="text-muted text-xs">—</span>;
        const warehouseCount = sources.filter((s) => s.type === 'WAREHOUSE').length;
        const factoryCount = sources.filter((s) => s.type === 'FACTORY').length;
        return (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-xs bg-slate-50 border border-border text-secondary hover:bg-slate-100 transition-colors">
              <span>{[warehouseCount > 0 && `WH${warehouseCount > 1 ? ` ×${warehouseCount}` : ''}`, factoryCount > 0 && `Factory${factoryCount > 1 ? ` ×${factoryCount}` : ''}`].filter(Boolean).join(' · ')}</span>
              <ChevronDown size={11} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-1.5 space-y-1 border-l-2 border-emerald/30 pl-2">
              {sources.map((source) => (
                <div key={`${source.type}-${source.identifier}`} className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${source.type === 'FACTORY' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                    {source.type === 'FACTORY' ? 'Factory' : 'WH'}
                  </span>
                  <span className="font-mono text-foreground">{source.identifier}</span>
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
        const pct = row.reorderLevel > 0 ? Math.min((row.currentStock / (row.reorderLevel * 3)) * 100, 100) : 100;
        return (
          <div className="min-w-[80px]">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold ${isLow ? 'text-red-600' : 'text-foreground'}`}>
                {row.currentStock}{uom ? ` ${uom}` : ''}
              </span>
              {isLow && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                  <TrendingDown size={9} /> Low
                </span>
              )}
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isLow ? 'bg-red-400' : 'bg-emerald'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'costPrice', header: 'Cost', priority: 'P3',
      render: (row) => row.costPrice > 0
        ? <span className="text-sm font-medium text-blue-600">{formatCurrency(row.costPrice)}</span>
        : <span className="text-muted text-xs">—</span>,
    },
    {
      key: 'salePrice', header: 'Sale Price', priority: 'P2',
      render: (row) => row.salePrice
        ? <span className="text-sm font-semibold text-emerald-600">{formatCurrency(row.salePrice)}</span>
        : <span className="text-muted text-xs">—</span>,
    },
    {
      key: 'isActive', header: 'Status', priority: 'P2',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[116px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => router.push(`/production/${row._id}`)}
            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
            title="View"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => openEdit(row)}
            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteId(row._id)}
            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Production"
        description="Manufacture products from raw materials and track batch history"
        breadcrumbs={[{ label: 'Production' }]}
        actions={
          <button onClick={openCreate} className="h-9 px-4 rounded-lg bg-emerald hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
            <Plus size={15} /> New Production
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Products', value: totalProducts, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active', value: activeCount, icon: Layers, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Low Stock', value: lowStockCount, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Stock Value', value: formatCurrency(totalStockValue), icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-border px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-base font-bold text-foreground leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`h-9 px-3 rounded-lg border text-sm flex items-center gap-2 transition-colors font-medium ${showFilters ? 'border-emerald bg-emerald/5 text-emerald' : 'border-border text-secondary hover:bg-slate-50'}`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-emerald" />}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="h-9 px-3 rounded-lg border border-border text-sm text-secondary hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 p-4 rounded-xl border border-border bg-white flex flex-wrap gap-4 items-end shadow-sm">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Status</span>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 h-8 capitalize font-medium transition-colors ${statusFilter === s ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-50'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Stock Level</span>
            <button
              onClick={() => setLowStockOnly((v) => !v)}
              className={`h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${lowStockOnly ? 'border-red-300 bg-red-50 text-red-600' : 'border-border text-secondary hover:bg-slate-50'}`}
            >
              <TrendingDown size={13} />
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
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first production batch to get started.'}
          action={
            !hasActiveFilters ? (
              <button onClick={openCreate} className="h-9 px-4 rounded-lg bg-emerald hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors">
                <Plus size={15} /> New Production
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
        description="This will soft-delete the product and remove it from active production."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
