'use client';

import { useState, useMemo } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetStockBalancesQuery,
  useGetStockMovementsQuery,
} from '@/features/inventory/services/inventoryApi';
import type { StockBalance, StockMovement, Item, Warehouse } from '@/features/inventory/types';

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'Purchase Receipt',
  PRODUCTION_ISSUE: 'Production Issue',
  PRODUCTION_OUTPUT: 'Production Output',
  SALES_DISPATCH: 'Sales Dispatch',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
  RETURN_SUPPLIER: 'Return to Supplier',
  RETURN_CUSTOMER: 'Customer Return',
};

const MATERIAL_TYPES = new Set(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED']);
const PRODUCTION_TYPES = new Set(['FINISHED_GOOD']);

export default function StockPage() {
  const [balancePage, setBalancePage] = useState(1);
  const [tab, setTab] = useState<'balance' | 'movements'>('movements');

  // balance filters
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balanceTypeFilter, setBalanceTypeFilter] = useState<'all' | 'materials' | 'production'>('all');
  const [balanceStatusFilter, setBalanceStatusFilter] = useState<'all' | 'low' | 'normal'>('all');

  // movement filters
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTab, setMovementTab] = useState<'all' | 'materials' | 'production'>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');

  function handleMovementTabChange(t: 'all' | 'materials' | 'production') {
    setMovementTab(t);
    setMovementPageAll(1);
    setMovementPageMaterials(1);
    setMovementPageProduction(1);
    setMovementTypeFilter('');
  }

  // When on production tab, only fetch PRODUCTION_OUTPUT & PRODUCTION_ISSUE
  // When on materials tab, fetch everything except those
  // The backend `type` param accepts a single value, so for multi-type we fetch all and filter client-side
  // BUT we use separate page states so pagination is correct per tab
  const [movementPageAll, setMovementPageAll] = useState(1);
  const [movementPageMaterials, setMovementPageMaterials] = useState(1);
  const [movementPageProduction, setMovementPageProduction] = useState(1);

  const setActivePage = (p: number) => {
    if (movementTab === 'materials') setMovementPageMaterials(p);
    else if (movementTab === 'production') setMovementPageProduction(p);
    else setMovementPageAll(p);
  };

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } =
    useGetStockBalancesQuery({ page: balancePage, search: balanceSearch || undefined });

  const { data: movementDataAll, isLoading: movementLoadingAll, isError: movementErrorAll } =
    useGetStockMovementsQuery({ page: movementPageAll, limit: 20, type: movementTypeFilter || undefined }, { skip: movementTab !== 'all' });

  const { data: movementDataMaterials, isLoading: movementLoadingMaterials, isError: movementErrorMaterials } =
    useGetStockMovementsQuery({ page: movementPageMaterials, limit: 20, type: 'PURCHASE_RECEIPT' }, { skip: movementTab !== 'materials' });

  const { data: movementDataProduction, isLoading: movementLoadingProduction, isError: movementErrorProduction } =
    useGetStockMovementsQuery({ page: movementPageProduction, limit: 20, type: 'PRODUCTION_OUTPUT' }, { skip: movementTab !== 'production' });

  const movementData = movementTab === 'materials' ? movementDataMaterials : movementTab === 'production' ? movementDataProduction : movementDataAll;
  const movementLoading = movementTab === 'materials' ? movementLoadingMaterials : movementTab === 'production' ? movementLoadingProduction : movementLoadingAll;
  const movementError = movementTab === 'materials' ? movementErrorMaterials : movementTab === 'production' ? movementErrorProduction : movementErrorAll;

  const filteredBalances = useMemo(() => {
    return (balanceData?.data?.balances ?? []).filter((b) => {
      const item = typeof b.item === 'string' ? null : b.item as Item;
      if (!item) return false;

      if (balanceTypeFilter === 'materials' && !MATERIAL_TYPES.has(item.type)) return false;
      if (balanceTypeFilter === 'production' && !PRODUCTION_TYPES.has(item.type)) return false;

      const isLow = item.reorderLevel != null && b.quantity <= item.reorderLevel;
      if (balanceStatusFilter === 'low' && !isLow) return false;
      if (balanceStatusFilter === 'normal' && isLow) return false;

      return true;
    });
  }, [balanceData, balanceTypeFilter, balanceStatusFilter]);

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
      key: 'type', header: 'Category', priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        if (!item) return '—';
        const isMaterial = MATERIAL_TYPES.has(item.type);
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${isMaterial ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {isMaterial ? 'Material' : 'Production'}
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
          <span className={`inline-flex items-center gap-1 font-medium ${isLow ? 'text-red-600' : 'text-foreground'}`}>
            {isLow && <AlertTriangle size={12} className="shrink-0" />}
            {row.quantity}
            {uom && <span className="text-xs text-muted font-normal">{uom}</span>}
            {isLow && <span className="text-[10px] font-normal text-red-400">/ low</span>}
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
      render: (row) => {
        const colors: Record<string, string> = {
          PURCHASE_RECEIPT:  'bg-blue-50 text-blue-700',
          PRODUCTION_ISSUE:  'bg-orange-50 text-orange-700',
          PRODUCTION_OUTPUT: 'bg-emerald-50 text-emerald-700',
          SALES_DISPATCH:    'bg-purple-50 text-purple-700',
          ADJUSTMENT:        'bg-slate-100 text-slate-600',
          TRANSFER:          'bg-cyan-50 text-cyan-700',
          RETURN_SUPPLIER:   'bg-amber-50 text-amber-700',
          RETURN_CUSTOMER:   'bg-pink-50 text-pink-700',
        };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[row.type] ?? 'bg-slate-100 text-slate-600'}`}>
            {MOVEMENT_LABELS[row.type] ?? row.type}
          </span>
        );
      },
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

  return (
    <>
      <PageHeader
        title="Stock Balances & Movements History"
        // description="Stock balances and movement history"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'Stock' }]}
      />

      {/* Main tabs */}
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {(['movements', 'balance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
              tab === t ? 'border-emerald text-emerald-600' : 'border-transparent text-secondary hover:text-foreground'
            }`}
          >
            {t === 'balance' ? 'Stock Balance' : 'Movement History'}
          </button>
        ))}
      </div>

      {/* ── BALANCE TAB ── */}
      {tab === 'balance' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search item name, SKU or warehouse…"
                value={balanceSearch}
                onChange={(e) => { setBalanceSearch(e.target.value); setBalancePage(1); }}
                className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
            <select
              value={balanceTypeFilter}
              onChange={(e) => { setBalanceTypeFilter(e.target.value as typeof balanceTypeFilter); setBalancePage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              <option value="materials">Materials</option>
              <option value="production">Production Items</option>
            </select>
            <select
              value={balanceStatusFilter}
              onChange={(e) => { setBalanceStatusFilter(e.target.value as typeof balanceStatusFilter); setBalancePage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
              aria-label="Filter by stock status"
            >
              <option value="all">All Statuses</option>
              <option value="low">Low Stock</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div className="flex items-center gap-4 mb-3 text-xs text-secondary">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Materials (Raw / Packaging / Semi-Finished)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Production Items (Finished Goods)</span>
          </div>

          {balanceError ? (
            <ErrorState onRetry={refetchBalance} />
          ) : (
            <DataTable
              columns={balanceColumns}
              data={filteredBalances}
              keyField="_id"
              isLoading={balanceLoading}
              pagination={balanceData?.pagination}
              onPageChange={setBalancePage}
              emptyMessage="No stock balances found."
            />
          )}
        </>
      )}

      {/* ── MOVEMENTS TAB ── */}
      {tab === 'movements' && (
        <>
          {/* Sub-tabs */}
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
    </>
  );
}
