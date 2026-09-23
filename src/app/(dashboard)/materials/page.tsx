'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetItemsQuery, useDeleteItemMutation } from '@/features/inventory/services/inventoryApi';
import { ItemFormDialog } from '@/features/inventory/components/ItemFormDialog';
import type { Item, Supplier } from '@/features/inventory/types';

const ITEM_TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: 'Raw Material',
  PACKAGING: 'Packaging',
  SEMI_FINISHED: 'Semi-Finished',
};

export default function ItemsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: string) {
    if (key === sortBy) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const { data, isLoading, isError, refetch } = useGetItemsQuery({
    page,
    search: search || undefined,
    type: typeFilter || undefined,
    sortBy,
    sortDir,
  });

  const items = (data?.data.items ?? []).filter((it) => {
    if (lowStockFilter) return (it.reorderLevel ?? 0) > 0 && it.currentStock <= it.reorderLevel!;
    return true;
  });

  const [deleteItem, { isLoading: deleting }] = useDeleteItemMutation();

  function openCreate() { setEditItem(null); setDialogOpen(true); }
  function openEdit(item: Item) { setEditItem(item); setDialogOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteItem(deleteId).unwrap();
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<Item>[] = [
    {
      key: 'sl', header: 'SL', priority: 'P1', className: 'w-10 text-center',
      render: (_row, index) => (
        <span className="text-secondary">{(index ?? 0) + 1}</span>
      ),
    },
    {
      key: 'name', header: 'Name', priority: 'P1', className: 'max-w-[180px]', sortable: true,
      render: (row) => {
        const isLow = (row.reorderLevel ?? 0) > 0 && row.currentStock <= row.reorderLevel!;
        return (
          <span className={`font-bold leading-snug whitespace-normal break-words ${isLow ? 'text-red-700' : 'text-foreground'}`}>
            {row.name}
          </span>
        );
      },
    },
    {
      key: 'createdAt', header: 'Date', priority: 'P3', sortable: true,
      render: (row) => <span className="text-secondary">{formatDate(row.createdAt, 'dd/MM/yyyy, hh:mm a')}</span>,
    },
    {
      key: 'type', header: 'Type', priority: 'P2',
      render: (row) => <span className="text-secondary">{ITEM_TYPE_LABELS[row.type] ?? row.type}</span>,
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P2',
      render: (row) => {
        const s = row.supplier as Supplier | undefined;
        return s ? <span className="font-bold text-foreground">{s.name}</span> : <span className="text-muted">—</span>;
      },
    },
    {
      key: 'currentStock', header: 'Stock', priority: 'P2', sortable: true,
      render: (row) => {
        const isLow = (row.reorderLevel ?? 0) > 0 && row.currentStock <= row.reorderLevel!;
        return (
          <span className={`inline-flex items-center gap-1.5 font-bold ${
            isLow ? 'text-red-600' : 'text-foreground'
          }`}>
            {isLow && <AlertTriangle size={13} className="shrink-0" />}
            {row.currentStock}
          </span>
        );
      },
    },
    {
      key: 'costPrice', header: 'Cost Price', priority: 'P3', sortable: true,
      render: (row) => formatCurrency(row.costPrice),
    },
    {
      key: 'isActive', header: 'Status', priority: 'P2',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => router.push(`/materials/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View"><Eye size={15} /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Edit" title="Edit"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  const lowStockItems = items.filter(
    (it) => (it.reorderLevel ?? 0) > 0 && it.currentStock <= it.reorderLevel!,
  );

  return (
    <>
      <PageHeader
        title="Materials"
        description="Manage raw materials and packaging stock"
        breadcrumbs={[{ label: 'Materials' }]}
        actions={
          <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} aria-hidden="true" /> New Material Purchase
          </button>
        }
      />

      {lowStockItems.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            <span className="font-semibold">{lowStockItems.length} material{lowStockItems.length > 1 ? 's' : ''}</span> below low stock qty:{' '}
            {lowStockItems.slice(0, 3).map((it) => it.name).join(', ')}
            {lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ''}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="RAW_MATERIAL">Raw Material</option>
          <option value="PACKAGING">Packaging</option>
          <option value="SEMI_FINISHED">Semi-Finished</option>
        </select>
        <button
          type="button"
          onClick={() => setLowStockFilter((v) => !v)}
          className={`h-9 px-3 rounded-md border text-sm font-medium flex items-center gap-1.5 transition-colors ${
            lowStockFilter
              ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
              : 'border-border bg-white text-secondary hover:bg-slate-50'
          }`}
          aria-pressed={lowStockFilter}
        >
          <AlertTriangle size={13} />
          Low Stock
        </button>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          title="No materials found"
          description="Record your first purchase to get started."
          action={
            <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Purchase
            </button>
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
          sortKey={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          rowClassName={(row) =>
            (row.reorderLevel ?? 0) > 0 && row.currentStock <= row.reorderLevel!
              ? 'bg-red-50 hover:bg-red-100'
              : ''
          }
        />
      )}

      <ItemFormDialog open={dialogOpen} item={editItem} onClose={() => setDialogOpen(false)} />
      <ConfirmDialog open={!!deleteId} title="Delete Item" description="This will soft-delete the item." confirmLabel="Delete" variant="danger" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </>
  );
}
