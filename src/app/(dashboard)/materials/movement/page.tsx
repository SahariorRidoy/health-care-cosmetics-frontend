'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { useGetStockMovementsQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import type { StockMovement, StockBalance, Item } from '@/features/inventory/types';

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'Purchase Receipt',
  PRODUCTION_ISSUE: 'Production Issue',
  PRODUCTION_OUTPUT: 'Production Output',
  SALES_DISPATCH: 'Sales Dispatch',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
  RETURN_SUPPLIER: 'Return to Supplier',
  RETURN_CUSTOMER: 'Customer Return',
  ITEM_DELETED: 'Item Deleted',
};

const MATERIAL_TYPES = new Set(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED']);
const PRODUCTION_TYPES = new Set(['FINISHED_GOOD']);

const MOVEMENT_COLORS: Record<string, string> = {
  PURCHASE_RECEIPT:  'bg-blue-50 text-blue-700',
  PRODUCTION_ISSUE:  'bg-orange-50 text-orange-700',
  PRODUCTION_OUTPUT: 'bg-emerald-50 text-emerald-700',
  SALES_DISPATCH:    'bg-purple-50 text-purple-700',
  ADJUSTMENT:        'bg-slate-100 text-slate-600',
  TRANSFER:          'bg-cyan-50 text-cyan-700',
  RETURN_SUPPLIER:   'bg-amber-50 text-amber-700',
  RETURN_CUSTOMER:   'bg-pink-50 text-pink-700',
  ITEM_DELETED:      'bg-red-50 text-red-700',
};

export default function MovementPage() {
  const [tab, setTab] = useState<'movements' | 'archive'>('movements');

  // movement filters
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTab, setMovementTab] = useState<'all' | 'materials' | 'production'>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementPageAll, setMovementPageAll] = useState(1);
  const [movementPageMaterials, setMovementPageMaterials] = useState(1);
  const [movementPageProduction, setMovementPageProduction] = useState(1);

  function handleMovementTabChange(t: 'all' | 'materials' | 'production') {
    setMovementTab(t);
    setMovementPageAll(1);
    setMovementPageMaterials(1);
    setMovementPageProduction(1);
    setMovementTypeFilter('');
  }

  const setActivePage = (p: number) => {
    if (movementTab === 'materials') setMovementPageMaterials(p);
    else if (movementTab === 'production') setMovementPageProduction(p);
    else setMovementPageAll(p);
  };

  const { data: movementDataAll, isLoading: movementLoadingAll, isError: movementErrorAll } =
    useGetStockMovementsQuery({ page: movementPageAll, limit: 20, type: movementTypeFilter || undefined }, { skip: movementTab !== 'all' || tab !== 'movements' });

  const { data: movementDataMaterials, isLoading: movementLoadingMaterials, isError: movementErrorMaterials } =
    useGetStockMovementsQuery({ page: movementPageMaterials, limit: 20, type: 'PURCHASE_RECEIPT' }, { skip: movementTab !== 'materials' || tab !== 'movements' });

  const { data: movementDataProduction, isLoading: movementLoadingProduction, isError: movementErrorProduction } =
    useGetStockMovementsQuery({ page: movementPageProduction, limit: 20, type: 'PRODUCTION_OUTPUT' }, { skip: movementTab !== 'production' || tab !== 'movements' });

  const movementData = movementTab === 'materials' ? movementDataMaterials : movementTab === 'production' ? movementDataProduction : movementDataAll;
  const movementLoading = movementTab === 'materials' ? movementLoadingMaterials : movementTab === 'production' ? movementLoadingProduction : movementLoadingAll;
  const movementError = movementTab === 'materials' ? movementErrorMaterials : movementTab === 'production' ? movementErrorProduction : movementErrorAll;

  // archive
  const [archivePage, setArchivePage] = useState(1);
  const [archiveSearch, setArchiveSearch] = useState('');
  const { data: archiveMovements, isLoading: archiveMovementsLoading, isError: archiveError } =
    useGetStockMovementsQuery({ page: archivePage, limit: 20, archived: true }, { skip: tab !== 'archive' });
  const { data: archiveBalances, isLoading: archiveBalancesLoading } =
    useGetStockBalancesQuery({ page: archivePage, archived: true }, { skip: tab !== 'archive' });

  const filteredMovements = useMemo(() => {
    return (movementData?.data?.movements ?? []).filter((m) => {
      const item = typeof m.item === 'string' ? null : m.item as Item;
      if (movementTypeFilter && m.type !== movementTypeFilter) return false;
      if (movementSearch) {
        const q = movementSearch.toLowerCase();
        return (
          (item?.name.toLowerCase().includes(q) ?? false) ||
          (item?.sku.toLowerCase().includes(q) ?? false) ||
          (m.reference?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [movementData, movementSearch, movementTypeFilter]);

  const movementColumns: Column<StockMovement>[] = [
    {
      key: 'createdAt', header: 'Date', priority: 'P1',
      render: (row) => formatDate(row.createdAt, 'dd MMM yyyy hh:mm a'),
    },
    {
      key: 'item', header: 'Item', priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isMaterial = item ? MATERIAL_TYPES.has(item.type) : false;
        const isProduction = item ? PRODUCTION_TYPES.has(item.type) : false;
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${isMaterial ? 'bg-blue-400' : isProduction ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="font-bold">{item?.name ?? '—'}</span>
          </div>
        );
      },
    },
    {
      key: 'type', header: 'Movement', priority: 'P2',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${MOVEMENT_COLORS[row.type] ?? 'bg-slate-100 text-slate-600'}`}>
          {MOVEMENT_LABELS[row.type] ?? row.type}
        </span>
      ),
    },
    {
      key: 'quantity', header: 'Qty', priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const uom = item && typeof item.baseUom === 'object' ? (item.baseUom as { symbol: string }).symbol : '';
        return (
          <span className={row.quantity > 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
            {row.quantity > 0 ? '+' : ''}{row.quantity}
            {uom && <span className="ml-1 text-xs text-muted font-normal">{uom}</span>}
          </span>
        );
      },
    },
    {
      key: 'balanceAfter', header: 'Balance After', priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const uom = item && typeof item.baseUom === 'object' ? (item.baseUom as { symbol: string }).symbol : '';
        return (
          <span className="font-medium">
            {row.balanceAfter}
            {uom && <span className="ml-1 text-xs text-muted font-normal">{uom}</span>}
          </span>
        );
      },
    },
    { key: 'reference', header: 'Reference', priority: 'P3', render: (row) => row.reference ?? '—' },
    { key: 'notes', header: 'Notes', priority: 'P3', render: (row) => row.notes ?? '—' },
  ];

  const balanceColumns: Column<StockBalance>[] = [
    {
      key: 'item', header: 'Item', priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isMaterial = item ? MATERIAL_TYPES.has(item.type) : false;
        const isProduction = item ? PRODUCTION_TYPES.has(item.type) : false;
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${isMaterial ? 'bg-blue-400' : isProduction ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="font-bold">{item?.name ?? '—'}</span>
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
      key: 'quantity', header: 'Last Qty', priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const uom = item && typeof item.baseUom === 'object' ? (item.baseUom as { symbol: string }).symbol : '';
        return (
          <span className="font-medium text-red-600">
            {row.quantity}
            {uom && <span className="ml-1 text-xs text-muted font-normal">{uom}</span>}
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
        title="Movement History"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'Movement History' }]}
      />

      {/* Main tabs */}
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {(['movements', 'archive'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
              tab === t ? 'border-emerald text-emerald-600' : 'border-transparent text-secondary hover:text-foreground'
            }`}
          >
            {t === 'movements' ? 'Movement History' : 'Archive'}
          </button>
        ))}
      </div>

      {/* ── MOVEMENTS TAB ── */}
      {tab === 'movements' && (
        <>
          <div className="flex gap-1 mb-4 border-b border-border">
            {([
              { key: 'all', label: 'All' },
              { key: 'materials', label: '🔵 Materials' },
              { key: 'production', label: '🟢 Production Items' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleMovementTabChange(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
                  movementTab === key ? 'border-emerald text-emerald-600' : 'border-transparent text-secondary hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search item name, SKU or reference…"
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
            <select
              value={movementTypeFilter}
              onChange={(e) => { setMovementTypeFilter(e.target.value); setActivePage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
              aria-label="Filter by movement type"
            >
              <option value="">All Movement Types</option>
              {Object.entries(MOVEMENT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 mb-3 text-xs text-secondary">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Materials</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Production Items</span>
          </div>

          {movementError ? (
            <ErrorState />
          ) : (
            <DataTable
              columns={movementColumns}
              data={filteredMovements}
              keyField="_id"
              isLoading={movementLoading}
              pagination={movementData?.pagination}
              onPageChange={setActivePage}
              emptyMessage="No stock movements found."
            />
          )}
        </>
      )}

      {/* ── ARCHIVE TAB ── */}
      {tab === 'archive' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search deleted item name or SKU…"
                value={archiveSearch}
                onChange={(e) => { setArchiveSearch(e.target.value); setArchivePage(1); }}
                className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="px-4 py-3 border-b border-border mb-2">
              <h2 className="text-sm font-semibold text-foreground">Deleted Items — Last Stock Balance</h2>
            </div>
            {archiveError ? <ErrorState /> : (
              <DataTable
                columns={balanceColumns}
                data={(archiveBalances?.data?.balances ?? []).filter((b) => {
                  const item = typeof b.item === 'string' ? null : b.item as Item;
                  if (!item) return false;
                  if (!archiveSearch) return true;
                  const q = archiveSearch.toLowerCase();
                  return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
                })}
                keyField="_id"
                isLoading={archiveBalancesLoading}
                pagination={archiveBalances?.pagination}
                onPageChange={setArchivePage}
                emptyMessage="No archived items found."
              />
            )}
          </div>

          <div>
            <div className="px-4 py-3 border-b border-border mb-2">
              <h2 className="text-sm font-semibold text-foreground">Deleted Items — Movement History</h2>
            </div>
            {archiveError ? <ErrorState /> : (
              <DataTable
                columns={movementColumns}
                data={(archiveMovements?.data?.movements ?? []).filter((m) => {
                  if (!archiveSearch) return true;
                  const item = typeof m.item === 'string' ? null : m.item as Item;
                  const q = archiveSearch.toLowerCase();
                  return (
                    (item?.name.toLowerCase().includes(q) ?? false) ||
                    (item?.sku.toLowerCase().includes(q) ?? false)
                  );
                })}
                keyField="_id"
                isLoading={archiveMovementsLoading}
                pagination={archiveMovements?.pagination}
                onPageChange={setArchivePage}
                emptyMessage="No archived movements found."
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
