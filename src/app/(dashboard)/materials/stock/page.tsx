'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetStockBalancesQuery,
  useGetStockMovementsQuery,
  useDeleteItemMutation,
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

export default function StockPage() {
  const [balancePage, setBalancePage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [tab, setTab] = useState<'balance' | 'movements'>('movements');
  const [movementTab, setMovementTab] = useState<'all' | 'materials' | 'production'>('all');

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } =
    useGetStockBalancesQuery({ page: balancePage, lowStock: lowStockOnly || undefined });

  const { data: movementData, isLoading: movementLoading, isError: movementError } =
    useGetStockMovementsQuery({ page: movementPage, limit: 15, activeOnly: true });

  const [deleteItem] = useDeleteItemMutation();
  async function handleDelete(item: Item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    await deleteItem(item._id);
  }

  const balanceColumns: Column<StockBalance>[] = [
    {
      key: 'item',
      header: 'Item',
      priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        return <span className="font-medium">{item?.name ?? '—'}</span>;
      },
    },
    {
      key: 'sku',
      header: 'SKU',
      priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        return <span className="text-secondary">{item?.sku ?? '—'}</span>;
      },
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      priority: 'P2',
      render: (row) => {
        const wh = typeof row.warehouse === 'string' ? null : row.warehouse as Warehouse;
        return wh?.name ?? '—';
      },
    },
    {
      key: 'quantity',
      header: 'Qty',
      priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const low = item && item.reorderLevel != null ? row.quantity <= item.reorderLevel : false;
        return (
          <span className={low ? 'text-amber-600 font-medium' : ''}>
            {row.quantity}
            {low && <span className="ml-1 text-xs">(Low)</span>}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'P2',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const low = item && item.reorderLevel != null ? row.quantity <= item.reorderLevel : false;
        return <StatusBadge status={low ? 'WARNING' : 'ACTIVE'} />;
      },
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      priority: 'P3',
      render: (row) => formatDate(row.updatedAt),
    },
    {
      key: 'actions',
      header: '',
      priority: 'P1',
      className: 'w-[180px] text-right',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isMaterial = item ? item.type === 'RAW_MATERIAL' || item.type === 'PACKAGING' || item.type === 'SEMI_FINISHED' : false;
        return (
          <div className="flex items-center justify-end gap-2">
            {!isMaterial && item && (
              <button
                onClick={() => handleDelete(item)}
                className="h-8 px-3 rounded-md border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const MATERIAL_TYPES = new Set(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED']);
  const PRODUCTION_TYPES = new Set(['FINISHED_GOOD']);

  const allMovements = movementData?.data?.movements ?? [];
  const filteredMovements =
    movementTab === 'materials'
      ? allMovements.filter((m) => {
          const item = typeof m.item === 'string' ? null : (m.item as Item);
          return item ? MATERIAL_TYPES.has(item.type) : false;
        })
      : movementTab === 'production'
      ? allMovements.filter((m) => {
          const item = typeof m.item === 'string' ? null : (m.item as Item);
          return item ? PRODUCTION_TYPES.has(item.type) : false;
        })
      : allMovements;

  const movementColumns: Column<StockMovement>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      priority: 'P1',
      render: (row) => formatDate(row.createdAt, 'dd MMM yyyy HH:mm'),
    },
    {
      key: 'item',
      header: 'Item',
      priority: 'P1',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        const isMaterial = item ? MATERIAL_TYPES.has(item.type) : false;
        const isProduction = item ? PRODUCTION_TYPES.has(item.type) : false;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                isMaterial ? 'bg-blue-400' : isProduction ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            />
            <span className="font-medium">{item?.name ?? '—'}</span>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      priority: 'P2',
      render: (row) => <span className="text-secondary">{MOVEMENT_LABELS[row.type] ?? row.type}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      priority: 'P1',
      render: (row) => (
        <span className={row.quantity > 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
          {row.quantity > 0 ? '+' : ''}{row.quantity}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Balance After',
      priority: 'P2',
      render: (row) => row.balanceAfter,
    },
    {
      key: 'reference',
      header: 'Reference',
      priority: 'P3',
      render: (row) => row.reference ?? '—',
    },
    {
      key: 'notes',
      header: 'Notes',
      priority: 'P3',
      render: (row) => row.notes ?? '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Stock balances and movement history"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'Stock' }]}

      />

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {(['movements', 'balance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
              tab === t
                ? 'border-emerald text-emerald-600'
                : 'border-transparent text-secondary hover:text-foreground'
            }`}
          >
            {t === 'balance' ? 'Stock Balance' : 'Movement History'}
          </button>
        ))}
      </div>

      {tab === 'balance' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => { setLowStockOnly(e.target.checked); setBalancePage(1); }}
                className="rounded border-border"
              />
              Low stock only
            </label>
          </div>
          {balanceError ? (
            <ErrorState onRetry={refetchBalance} />
          ) : (
            <DataTable
              columns={balanceColumns}
              data={balanceData?.data?.balances ?? []}
              keyField="_id"
              isLoading={balanceLoading}
              pagination={balanceData?.pagination}
              onPageChange={setBalancePage}
              emptyMessage="No stock balances found."
            />
          )}
        </>
      )}

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
                onClick={() => setMovementTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
                  movementTab === key
                    ? 'border-emerald text-emerald-600'
                    : 'border-transparent text-secondary hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-3 text-xs text-secondary">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Materials (Raw / Packaging / Semi-Finished)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Production Items (Finished Goods)</span>
          </div>
          {movementError ? (
            <ErrorState />
          ) : (
            <DataTable
              columns={movementColumns}
              data={filteredMovements}
              keyField="_id"
              isLoading={movementLoading}
              pagination={movementTab === 'all' ? movementData?.pagination : undefined}
              onPageChange={movementTab === 'all' ? setMovementPage : undefined}
              emptyMessage="No stock movements found."
            />
          )}
        </>
      )}

    </>
  );
}
