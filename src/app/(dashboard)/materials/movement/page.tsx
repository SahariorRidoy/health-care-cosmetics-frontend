'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetStockMovementsQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { DateRangeFilter, useDateRangeFilter } from '@/features/procurement/components/DateRangeFilter';
import type { StockMovement, StockMovementStats, StockBalance, Item } from '@/features/inventory/types';

const PAGE_SIZE = 20;

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'Purchase Receipt',
  PRODUCTION_ISSUE: 'Production Issue',
  PRODUCTION_OUTPUT: 'Production Output',
  SALES_DISPATCH: 'Sales Dispatch',
  GIFT_DISPATCH: 'Gift Dispatch',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
  RETURN_SUPPLIER: 'Return to Supplier',
  RETURN_CUSTOMER: 'Customer Return',
  FACTORY_DISPATCH: 'Factory Dispatch',
  FACTORY_RECEIPT: 'Factory Receipt',
  FACTORY_RETURN: 'Factory Return',
  ITEM_DELETED: 'Item Deleted',
};

const MOVEMENT_COLORS: Record<string, string> = {
  PURCHASE_RECEIPT:  'bg-blue-50 text-blue-700 ring-blue-600/20',
  PRODUCTION_ISSUE:  'bg-orange-50 text-orange-700 ring-orange-600/20',
  PRODUCTION_OUTPUT: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  SALES_DISPATCH:    'bg-purple-50 text-purple-700 ring-purple-600/20',
  GIFT_DISPATCH:     'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20',
  ADJUSTMENT:        'bg-slate-100 text-slate-700 ring-slate-500/20',
  TRANSFER:          'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  RETURN_SUPPLIER:   'bg-amber-50 text-amber-700 ring-amber-600/20',
  RETURN_CUSTOMER:   'bg-pink-50 text-pink-700 ring-pink-600/20',
  FACTORY_DISPATCH:  'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  FACTORY_RECEIPT:   'bg-teal-50 text-teal-700 ring-teal-600/20',
  FACTORY_RETURN:    'bg-sky-50 text-sky-700 ring-sky-600/20',
  ITEM_DELETED:      'bg-red-50 text-red-700 ring-red-600/20',
};

const MATERIAL_TYPES = new Set(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED']);

// Detail page for each document that can cause a stock movement
const REFERENCE_ROUTES: Record<string, string> = {
  GoodsReceipt: '/procurement/receipts',
  FactoryBatch: '/factory-production',
  ProductionOrder: '/production/orders',
  SalesOrder: '/sales/orders',
};

function referenceHref(row: StockMovement): string | null {
  const base = row.referenceModel ? REFERENCE_ROUTES[row.referenceModel] : undefined;
  return base && row.referenceId ? `${base}/${row.referenceId}` : null;
}

type Category = '' | 'materials' | 'production';
type Direction = '' | 'in' | 'out';

const inputCls = 'h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald';

function asItem(value: StockMovement['item'] | StockBalance['item']): Item | null {
  return typeof value === 'string' ? null : (value as Item);
}

function uomOf(item: Item | null): string {
  return item && typeof item.baseUom === 'object' ? (item.baseUom as { symbol: string }).symbol : '';
}

/* ───────────────────────── Header stats ───────────────────────── */

function MovementStats({ stats, rangeLabel, isLoading, isFetching }: {
  stats?: StockMovementStats; rangeLabel: string; isLoading: boolean; isFetching: boolean;
}) {
  const net = stats ? stats.inValue - stats.outValue : 0;
  const cards = stats
    ? [
        { label: 'Movements', value: stats.totalMovements.toLocaleString('en-BD'), hint: `${stats.itemsAffected} items · ${rangeLabel}`, tone: 'text-slate-900' },
        { label: 'Stock in', value: formatCurrency(stats.inValue), hint: `${stats.inCount.toLocaleString('en-BD')} entries`, tone: 'text-emerald-700' },
        { label: 'Stock out', value: formatCurrency(stats.outValue), hint: `${stats.outCount.toLocaleString('en-BD')} entries`, tone: 'text-red-600' },
        { label: 'Net change', value: `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatCurrency(Math.abs(net))}`, hint: 'In − out, at cost', tone: net >= 0 ? 'text-emerald-700' : 'text-red-600' },
      ]
    : null;

  return (
    <div
      aria-label="Movement totals"
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

/* ───────────────────────── Segmented control ───────────────────────── */

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-slate-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-full whitespace-nowrap rounded px-3 text-xs font-semibold transition-colors ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function MovementPage() {
  const [tab, setTab] = useState<'movements' | 'archive'>('movements');

  // movement filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('');
  const [direction, setDirection] = useState<Direction>('');
  const [typeFilter, setTypeFilter] = useState('');
  const dateRange = useDateRangeFilter(() => setPage(1));
  const hasFilters = !!(search || category || direction || typeFilter || dateRange.isActive);

  function clearFilters() {
    setSearch(''); setCategory(''); setDirection(''); setTypeFilter('');
    dateRange.filterProps.onPresetChange('all');
    setPage(1);
  }

  const { data, isLoading, isFetching, isError, refetch } = useGetStockMovementsQuery(
    {
      page,
      limit: PAGE_SIZE,
      search: search.trim() || undefined,
      category: category || undefined,
      direction: direction || undefined,
      type: typeFilter || undefined,
      from: dateRange.from,
      to: dateRange.to,
    },
    { skip: tab !== 'movements' },
  );

  // archive
  const [archivePage, setArchivePage] = useState(1);
  const [archiveSearch, setArchiveSearch] = useState('');
  const { data: archiveMovements, isLoading: archiveMovementsLoading, isError: archiveError } =
    useGetStockMovementsQuery({ page: archivePage, limit: PAGE_SIZE, archived: true, search: archiveSearch.trim() || undefined }, { skip: tab !== 'archive' });
  const { data: archiveBalances, isLoading: archiveBalancesLoading } =
    useGetStockBalancesQuery({ page: archivePage, archived: true, search: archiveSearch.trim() || undefined }, { skip: tab !== 'archive' });

  const movementColumns = (currentPage: number): Column<StockMovement>[] => [
    {
      key: 'sl', header: 'SL', priority: 'P1', className: 'w-12',
      render: (_row, index = 0) => <span className="text-secondary tabular-nums">{(currentPage - 1) * PAGE_SIZE + index + 1}</span>,
    },
    {
      key: 'createdAt', header: 'Date', priority: 'P1',
      render: (row) => (
        <div className="whitespace-nowrap">
          <span className="block font-medium text-foreground">{formatDate(row.createdAt, 'dd MMM yyyy')}</span>
          <span className="block text-xs text-muted">{formatDate(row.createdAt, 'hh:mm a')}</span>
        </div>
      ),
    },
    {
      key: 'item', header: 'Item', priority: 'P1',
      render: (row) => {
        const item = asItem(row.item);
        const isMaterial = item ? MATERIAL_TYPES.has(item.type) : false;
        return (
          <div className="min-w-0">
            <span className="block font-semibold text-foreground">{item?.name ?? '—'}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${isMaterial ? 'bg-blue-500' : 'bg-emerald-500'}`} aria-hidden="true" />
              {isMaterial ? 'Material' : 'Production'}{item?.sku ? ` · ${item.sku}` : ''}
            </span>
          </div>
        );
      },
    },
    {
      key: 'type', header: 'Movement', priority: 'P2',
      render: (row) => (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${MOVEMENT_COLORS[row.type] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20'}`}>
          {MOVEMENT_LABELS[row.type] ?? row.type}
        </span>
      ),
    },
    {
      key: 'quantity', header: 'Qty', priority: 'P1',
      render: (row) => {
        const uom = uomOf(asItem(row.item));
        const isIn = row.quantity > 0;
        const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
        return (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold tabular-nums ${isIn ? 'text-emerald-700' : 'text-red-600'}`}>
            <Icon size={14} aria-label={isIn ? 'Stock in' : 'Stock out'} />
            {isIn ? '+' : ''}{row.quantity}
            {uom && <span className="text-xs font-normal text-muted">{uom}</span>}
          </span>
        );
      },
    },
    {
      key: 'balanceAfter', header: 'Balance After', priority: 'P2',
      render: (row) => {
        const uom = uomOf(asItem(row.item));
        return (
          <span className="whitespace-nowrap font-medium tabular-nums">
            {row.balanceAfter}
            {uom && <span className="ml-1 text-xs font-normal text-muted">{uom}</span>}
          </span>
        );
      },
    },
    {
      key: 'value', header: 'Value', priority: 'P2',
      render: (row) => {
        const value = Math.abs(row.quantity) * (asItem(row.item)?.costPrice ?? 0);
        return <span className="whitespace-nowrap tabular-nums text-slate-700">{formatCurrency(value)}</span>;
      },
    },
    {
      key: 'reference', header: 'Reference', priority: 'P3',
      render: (row) => {
        if (!row.reference) return <span className="text-muted">—</span>;
        const href = referenceHref(row);
        return href ? (
          <Link href={href} className="whitespace-nowrap font-medium text-blue-600 hover:underline">
            {row.reference}
          </Link>
        ) : (
          <span className="whitespace-nowrap font-medium text-slate-700">{row.reference}</span>
        );
      },
    },
    {
      key: 'notes', header: 'Notes / By', priority: 'P3',
      render: (row) => {
        const by = typeof row.createdBy === 'object' ? row.createdBy?.name : undefined;
        return (
          <div className="max-w-[220px]">
            <span className="block truncate text-slate-700" title={row.notes}>{row.notes || '—'}</span>
            {by && <span className="block truncate text-xs text-muted">by {by}</span>}
          </div>
        );
      },
    },
  ];

  const balanceColumns: Column<StockBalance>[] = [
    {
      key: 'item', header: 'Item', priority: 'P1',
      render: (row) => {
        const item = asItem(row.item);
        return (
          <div className="min-w-0">
            <span className="block font-semibold text-foreground">{item?.name ?? '—'}</span>
            {item?.sku && <span className="block text-xs text-muted">{item.sku}</span>}
          </div>
        );
      },
    },
    {
      key: 'quantity', header: 'Last Qty', priority: 'P1',
      render: (row) => {
        const uom = uomOf(asItem(row.item));
        return (
          <span className="font-medium tabular-nums text-red-600">
            {row.quantity}
            {uom && <span className="ml-1 text-xs font-normal text-muted">{uom}</span>}
          </span>
        );
      },
    },
    {
      key: 'updatedAt', header: 'Deleted On', priority: 'P2',
      render: (row) => formatDate(row.updatedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock Movements"
        description="Every stock in and out, with value at cost"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'Stock Movements' }]}
        className="!mb-4"
        actions={
          <Segmented
            label="View"
            value={tab}
            onChange={setTab}
            options={[{ value: 'movements', label: 'Movements' }, { value: 'archive', label: 'Archive' }]}
          />
        }
        summary={tab === 'movements'
          ? <MovementStats stats={data?.data?.stats} rangeLabel={dateRange.label} isLoading={isLoading} isFetching={isFetching} />
          : undefined}
      />

      {/* ── MOVEMENTS ── */}
      {tab === 'movements' && (
        <>
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start">
            <div className="relative w-full lg:max-w-sm lg:flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search item, SKU or reference…"
                aria-label="Search movements"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className={`${inputCls} w-full pl-9`}
              />
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <DateRangeFilter {...dateRange.filterProps} />
              <Segmented
                label="Item category"
                value={category}
                onChange={(v) => { setCategory(v); setPage(1); }}
                options={[{ value: '', label: 'All items' }, { value: 'materials', label: 'Materials' }, { value: 'production', label: 'Production' }]}
              />
              <Segmented
                label="Direction"
                value={direction}
                onChange={(v) => { setDirection(v); setPage(1); }}
                options={[{ value: '', label: 'In & out' }, { value: 'in', label: 'Stock in' }, { value: 'out', label: 'Stock out' }]}
              />
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className={`${inputCls} w-full sm:w-48`}
                aria-label="Filter by movement type"
              >
                <option value="">All movement types</option>
                {Object.entries(MOVEMENT_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <X size={13} aria-hidden="true" /> Clear
                </button>
              )}
            </div>
          </div>

          {isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <DataTable
              columns={movementColumns(page)}
              data={data?.data?.movements ?? []}
              keyField="_id"
              isLoading={isLoading}
              pagination={data?.pagination}
              onPageChange={setPage}
              headerClassName="font-bold text-slate-700"
              emptyMessage={hasFilters ? 'No movements match the selected filters.' : 'No stock movements yet.'}
            />
          )}
        </>
      )}

      {/* ── ARCHIVE ── */}
      {tab === 'archive' && (
        <>
          <div className="mb-4">
            <div className="relative w-full lg:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search deleted item name or SKU…"
                aria-label="Search archive"
                value={archiveSearch}
                onChange={(e) => { setArchiveSearch(e.target.value); setArchivePage(1); }}
                className={`${inputCls} w-full pl-9`}
              />
            </div>
          </div>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Deleted items — last stock balance</h2>
            {archiveError ? <ErrorState /> : (
              <DataTable
                columns={balanceColumns}
                data={(archiveBalances?.data?.balances ?? []).filter((b) => !!asItem(b.item))}
                keyField="_id"
                isLoading={archiveBalancesLoading}
                pagination={archiveBalances?.pagination}
                onPageChange={setArchivePage}
                headerClassName="font-bold text-slate-700"
                emptyMessage="No archived items found."
              />
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Deleted items — movement history</h2>
            {archiveError ? <ErrorState /> : (
              <DataTable
                columns={movementColumns(archivePage)}
                data={archiveMovements?.data?.movements ?? []}
                keyField="_id"
                isLoading={archiveMovementsLoading}
                pagination={archiveMovements?.pagination}
                onPageChange={setArchivePage}
                headerClassName="font-bold text-slate-700"
                emptyMessage="No archived movements found."
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
