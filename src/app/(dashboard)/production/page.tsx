'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, Eye, X, ChevronDown, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import { ProductionFormDialog } from '@/features/production/components/ProductionFormDialog';
import { useGetProductsQuery, useDeleteProductMutation } from '@/features/products/services/productsApi';
import type { Product, ProductStats } from '@/features/products/types';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'inactive';

function isLowStock(p: Product): boolean {
  return p.reorderLevel > 0 && p.currentStock <= p.reorderLevel;
}

function uomOf(p: Product): string {
  return typeof p.baseUom === 'object' ? (p.baseUom as { symbol: string }).symbol : '';
}

/** Gross margin on the sale price, or null when there is no sale price to compare against. */
function marginPct(p: Product): number | null {
  if (!p.salePrice || p.salePrice <= 0) return null;
  return ((p.salePrice - (p.costPrice ?? 0)) / p.salePrice) * 100;
}

/* ───────────────────────── Header stats ───────────────────────── */

function ProductionStats({ stats, isLoading, isFetching }: { stats?: ProductStats; isLoading: boolean; isFetching: boolean }) {
  const profit = stats ? stats.saleValue - stats.stockValue : 0;
  const cards = stats
    ? [
        {
          label: 'Products', value: stats.totalItems.toLocaleString('en-BD'),
          hint: `${stats.activeItems} active`, tone: 'text-slate-900',
        },
        {
          label: 'Stock value', value: formatCurrency(stats.stockValue),
          hint: 'At cost to make', tone: 'text-blue-700',
        },
        {
          label: 'Sale value', value: formatCurrency(stats.saleValue),
          hint: `${profit >= 0 ? 'Potential profit' : 'Below cost by'} ${formatCurrency(Math.abs(profit))}`,
          tone: 'text-emerald-700',
        },
        {
          label: 'Needs restock', value: (stats.lowStock + stats.outOfStock).toLocaleString('en-BD'),
          hint: `${stats.lowStock} low · ${stats.outOfStock} out of stock`,
          tone: stats.lowStock + stats.outOfStock > 0 ? 'text-red-600' : 'text-emerald-700',
        },
      ]
    : null;

  return (
    <div
      aria-label="Production totals"
      aria-busy={isLoading || isFetching}
      className={`grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}
    >
      {!cards
        ? [0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl border border-slate-200 bg-white" />)
        : cards.map((c) => (
            <div key={c.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
              <p className={`truncate text-base font-bold tabular-nums ${c.tone}`} title={c.value}>{c.value}</p>
              <p className="truncate text-xs text-slate-500" title={c.hint}>{c.hint}</p>
            </div>
          ))}
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function ProductionPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useGetProductsQuery({
    page,
    search: search.trim() || undefined,
    isActive: statusFilter === 'all' ? 'all' : statusFilter === 'active' ? 'true' : 'false',
    lowStock: lowStockOnly || undefined,
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

  const items = data?.data.items ?? [];
  const pageSize = data?.pagination?.limit ?? PAGE_SIZE;
  const hasActiveFilters = !!(search || statusFilter !== 'active' || lowStockOnly);

  const columns: Column<Product>[] = [
    {
      key: 'sl', header: 'SL', priority: 'P1', className: 'w-12',
      render: (_row, index = 0) => <span className="text-secondary tabular-nums">{(page - 1) * pageSize + index + 1}</span>,
    },
    {
      key: 'name', header: 'Product', priority: 'P1',
      render: (row) => {
        const low = isLowStock(row) || row.currentStock <= 0;
        return (
          <div className="min-w-0">
            <Link
              href={`/production/${row._id}`}
              className={`block text-sm font-semibold hover:underline underline-offset-2 ${low ? 'text-red-600' : 'text-blue-600'}`}
            >
              {row.name}
            </Link>
            <p className="font-mono text-xs text-muted">{row.sku}</p>
          </div>
        );
      },
    },
    {
      key: 'productionSources', header: 'Source', priority: 'P3',
      render: (row) => {
        const sources = row.productionSources ?? [];
        if (sources.length === 0) return <span className="text-muted text-xs">—</span>;
        const warehouseCount = sources.filter((s) => s.type === 'WAREHOUSE').length;
        const factoryCount = sources.filter((s) => s.type === 'FACTORY').length;
        return (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-border bg-slate-50 px-2 py-1 text-xs text-secondary transition-colors hover:bg-slate-100">
              <span>{[warehouseCount > 0 && `WH${warehouseCount > 1 ? ` ×${warehouseCount}` : ''}`, factoryCount > 0 && `Factory${factoryCount > 1 ? ` ×${factoryCount}` : ''}`].filter(Boolean).join(' · ')}</span>
              <ChevronDown size={11} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-1.5 space-y-1 border-l-2 border-emerald/30 pl-2">
              {sources.map((source) => (
                <div key={`${source.type}-${source.identifier}`} className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${source.type === 'FACTORY' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
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
      key: 'currentStock', header: 'Stock', priority: 'P1',
      render: (row) => {
        const out = row.currentStock <= 0;
        const low = isLowStock(row);
        const uom = uomOf(row);
        const pct = row.reorderLevel > 0 ? Math.min((row.currentStock / (row.reorderLevel * 3)) * 100, 100) : 100;
        return (
          <div className="min-w-[90px]">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold tabular-nums ${out || low ? 'text-red-600' : 'text-foreground'}`}>
                {row.currentStock}{uom ? ` ${uom}` : ''}
              </span>
              {(out || low) && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                  <TrendingDown size={9} aria-hidden="true" /> {out ? 'Out' : 'Low'}
                </span>
              )}
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className={`h-full rounded-full ${out || low ? 'bg-red-400' : 'bg-emerald'}`} style={{ width: `${out ? 0 : pct}%` }} />
            </div>
            {row.reorderLevel > 0 && <p className="mt-0.5 text-[11px] text-muted">Reorder at {row.reorderLevel}</p>}
          </div>
        );
      },
    },
    {
      key: 'costPrice', header: 'Unit Cost', priority: 'P2',
      render: (row) => row.costPrice > 0
        ? <span className="whitespace-nowrap text-sm font-medium tabular-nums text-blue-700">{formatCurrency(row.costPrice)}</span>
        : <span className="text-xs text-muted">—</span>,
    },
    {
      key: 'salePrice', header: 'Sale Price', priority: 'P2',
      render: (row) => {
        const m = marginPct(row);
        if (!row.salePrice) return <span className="text-xs text-muted">—</span>;
        return (
          <div className="whitespace-nowrap">
            <span className="block text-sm font-semibold tabular-nums text-emerald-700">{formatCurrency(row.salePrice)}</span>
            {m !== null && row.costPrice > 0 && (
              <span className={`block text-[11px] font-medium ${m >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {m >= 0 ? '' : '−'}{Math.abs(m).toFixed(1)}% margin
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'stockValue', header: 'Stock Value', priority: 'P2',
      render: (row) => {
        const qty = Math.max(0, row.currentStock);
        const cost = qty * (row.costPrice ?? 0);
        const sale = qty * (row.salePrice ?? 0);
        return (
          <div className="whitespace-nowrap">
            <span className="block text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(cost)}</span>
            {sale > 0 && <span className="block text-[11px] text-muted">Sells for {formatCurrency(sale)}</span>}
          </div>
        );
      },
    },
    {
      key: 'isActive', header: 'Status', priority: 'P3',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[116px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => router.push(`/production/${row._id}`)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100" aria-label={`View ${row.name}`} title="View">
            <Eye size={14} aria-hidden="true" />
          </button>
          <button onClick={() => openEdit(row)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100" aria-label={`Edit ${row.name}`} title="Edit">
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button onClick={() => setDeleteId(row._id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-colors hover:bg-red-100" aria-label={`Delete ${row.name}`} title="Delete">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Production"
        breadcrumbs={[{ label: 'Production' }]}
        className="!mb-4"
        description={
          <button onClick={openCreate} className="mt-1.5 inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-emerald px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600">
            <Plus size={15} aria-hidden="true" /> New Production
          </button>
        }
        summary={<ProductionStats stats={data?.data.stats} isLoading={isLoading} isFetching={isFetching} />}
      />

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md md:flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search product name or SKU…"
            aria-label="Search products"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Status" className="inline-flex h-10 items-center rounded-md border border-border bg-slate-50 p-0.5">
            {(['active', 'inactive', 'all'] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={statusFilter === s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`h-full rounded px-3 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setLowStockOnly((v) => !v); setPage(1); }}
            aria-pressed={lowStockOnly}
            className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
              lowStockOnly ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
            }`}
          >
            <TrendingDown size={13} aria-hidden="true" /> Low stock
            {!!data?.data.stats?.lowStock && !lowStockOnly && (
              <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-bold text-red-600">{data.data.stats.lowStock}</span>
            )}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <X size={13} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          title="No products found"
          description={hasActiveFilters ? 'No products match the selected filters.' : 'Create your first production batch to get started.'}
          action={
            !hasActiveFilters ? (
              <button onClick={openCreate} className="flex h-9 items-center gap-2 rounded-lg bg-emerald px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600">
                <Plus size={15} aria-hidden="true" /> New Production
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          headerClassName="font-bold text-slate-700"
          rowClassName={(row) => (row.currentStock <= 0 || isLowStock(row) ? 'bg-red-50/40' : '')}
        />
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
