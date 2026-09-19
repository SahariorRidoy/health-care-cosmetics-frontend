'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetStockBalancesQuery,
  useGetStockMovementsQuery,
  useGetItemsQuery,
} from '@/features/inventory/services/inventoryApi';
import { StockAdjustmentDialog } from '@/features/inventory/components/StockAdjustmentDialog';
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
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);
  const [tab, setTab] = useState<'balance' | 'movements'>('balance');

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } =
    useGetStockBalancesQuery({ page: balancePage, lowStock: lowStockOnly || undefined });

  const { data: movementData, isLoading: movementLoading, isError: movementError } =
    useGetStockMovementsQuery({ page: movementPage });

  const { data: itemsData } = useGetItemsQuery({ page: 1 });

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
        const low = item ? row.quantity <= item.reorderLevel : false;
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
        const low = item ? row.quantity <= item.reorderLevel : false;
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
      className: 'w-[120px] text-right',
      render: (row) => {
        const item = typeof row.item === 'string' ? null : row.item as Item;
        return (
          <button
            onClick={() => item && setAdjustItem(item)}
            disabled={!item}
            className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            Adjust
          </button>
        );
      },
    },
  ];

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
        return <span className="font-medium">{item?.name ?? '—'}</span>;
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
        breadcrumbs={[{ label: 'Inventory', href: '/inventory' }, { label: 'Stock' }]}
        actions={
          itemsData?.data?.[0] && (
            <button
              onClick={() => setAdjustItem(itemsData.data[0])}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
              New Adjustment
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {(['balance', 'movements'] as const).map((t) => (
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
          {movementError ? (
            <ErrorState />
          ) : (
            <DataTable
              columns={movementColumns}
              data={movementData?.data?.movements ?? []}
              keyField="_id"
              isLoading={movementLoading}
              pagination={movementData?.pagination}
              onPageChange={setMovementPage}
              emptyMessage="No stock movements found."
            />
          )}
        </>
      )}

      <StockAdjustmentDialog
        open={!!adjustItem}
        item={adjustItem}
        onClose={() => setAdjustItem(null)}
      />
    </>
  );
}
