'use client';

import { useState, useMemo } from 'react';
import { Search, AlertTriangle, FlaskConical, Box, Layers, Package, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import type { StockBalance, Item, Warehouse } from '@/features/inventory/types';

const MATERIAL_TYPES = new Set(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED']);
const PRODUCTION_TYPES = new Set(['FINISHED_GOOD']);

export default function StockPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'materials' | 'production'>('all');
  const [statusFilter, setStatusFilter] = useState(false);

  const { data, isLoading, isError, refetch } = useGetStockBalancesQuery({ page, search: search || undefined });

  const filtered = useMemo(() => {
    return (data?.data?.balances ?? []).filter((b) => {
      const item = typeof b.item === 'string' ? null : b.item as Item;
      if (!item) return false;
      if (typeFilter === 'materials' && !MATERIAL_TYPES.has(item.type)) return false;
      if (typeFilter === 'production' && !PRODUCTION_TYPES.has(item.type)) return false;
      const isLow = item.reorderLevel != null && b.quantity <= item.reorderLevel;
      if (statusFilter && !isLow) return false;
      return true;
    });
  }, [data, typeFilter, statusFilter]);

  const columns: Column<StockBalance>[] = [
    {
      key: 'sl', header: 'SL', priority: 'P1', className: 'w-10 text-center',
      render: (_row, index) => <span className="text-secondary text-sm">{(index ?? 0) + 1}</span>,
    },
    {
      key: 'item', header: 'Item', priority: 'P1', className: 'max-w-[120px] sm:max-w-none',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isLow = item?.reorderLevel != null && row.quantity <= item.reorderLevel;
        const iconConfig: Record<string, { icon: React.ElementType; className: string }> = {
          RAW_MATERIAL:  { icon: FlaskConical, className: 'text-blue-500 bg-blue-50' },
          PACKAGING:     { icon: Box,          className: 'text-violet-500 bg-violet-50' },
          SEMI_FINISHED: { icon: Layers,       className: 'text-amber-500 bg-amber-50' },
          FINISHED_GOOD: { icon: Package,      className: 'text-emerald-500 bg-emerald-50' },
        };
        const ic = item ? (iconConfig[item.type] ?? { icon: Package, className: 'text-slate-400 bg-slate-50' }) : null;
        const Icon = ic?.icon;
        return (
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {Icon && (
              <span className={`hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${ic!.className}`}>
                <Icon size={14} />
              </span>
            )}
            <button
              onClick={() => item && router.push(`/materials/${item._id}`)}
              className={`text-xs sm:text-base font-bold hover:underline cursor-pointer leading-tight break-words text-left ${isLow ? 'text-red-600' : 'text-foreground'}`}
            >
              {item?.name ?? '—'}
            </button>
          </div>
        );
      },
    },
    {
      key: 'sku', header: 'SKU', priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        return <span className="text-secondary">{item?.sku ?? '—'}</span>;
      },
    },
    {
      key: 'type', header: 'Category', priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        if (!item) return '—';
        const config: Record<string, { label: string; className: string }> = {
          RAW_MATERIAL:  { label: 'Raw Material',  className: 'bg-blue-50 text-blue-700' },
          PACKAGING:     { label: 'Packaging',     className: 'bg-violet-50 text-violet-700' },
          SEMI_FINISHED: { label: 'Semi-Finished', className: 'bg-amber-50 text-amber-700' },
          FINISHED_GOOD: { label: 'Production',    className: 'bg-emerald-50 text-emerald-700' },
        };
        const c = config[item.type];
        if (!c) return <span className="text-secondary">{item.type}</span>;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${c.className}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      key: 'warehouse', header: 'Warehouse', priority: 'P2',
      render: (row) => {
        const wh = typeof row.warehouse === 'string' ? null : row.warehouse as Warehouse;
        return wh?.name ?? '—';
      },
    },
    {
      key: 'quantity', header: 'Qty', priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isLow = item?.reorderLevel != null && row.quantity <= item.reorderLevel;
        const uom = item && typeof item.baseUom === 'object' ? (item.baseUom as { symbol: string }).symbol : '';
        return (
          <span className={`inline-flex items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base ${isLow ? 'text-red-600' : 'text-foreground'}`}>
            {isLow && <AlertTriangle size={13} className="shrink-0" />}
            {row.quantity}
            {uom && <span className="text-sm font-semibold text-muted">{uom}</span>}
            {isLow && <span className="text-[10px] font-normal text-red-400">low</span>}
          </span>
        );
      },
    },
    {
      key: 'status', header: 'Status', priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isLow = item?.reorderLevel != null && row.quantity <= item.reorderLevel;
        return <StatusBadge status={isLow ? 'WARNING' : 'ACTIVE'} />;
      },
    },
    {
      key: 'updatedAt', header: 'Last Updated', priority: 'P3',
      render: (row) => formatDate(row.updatedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock Balance"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'Stock Balance' }]}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative sm:w-1/2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search item name or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border-2 border-emerald bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald"
          />
        </div>
        {(['all', 'materials', 'production'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
              t === 'all'
                ? typeFilter === 'all' ? 'bg-slate-700 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                : t === 'materials'
                ? typeFilter === 'materials' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-200 text-blue-400 hover:bg-blue-100'
                : typeFilter === 'production' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-400 hover:bg-emerald-100'
            }`}
          >
            {t === 'all' ? 'All' : t === 'materials' ? 'Materials' : 'Production'}
          </button>
        ))}
        <button
          onClick={() => { setStatusFilter((v) => !v); setPage(1); }}
          className={`h-9 px-3 rounded-md border text-sm font-medium flex items-center gap-1.5 transition-colors ${
            statusFilter ? 'bg-red-600 border-red-600 text-white' : 'bg-red-50 border-red-200 text-red-400 hover:bg-red-100'
          }`}
        >
          <AlertTriangle size={13} />
          Low Stock
        </button>
        {(typeFilter !== 'all' || statusFilter || search) && (
          <button
            onClick={() => { setTypeFilter('all'); setStatusFilter(false); setSearch(''); setPage(1); }}
            className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          emptyMessage="No stock found."
        />
      )}
    </>
  );
}
