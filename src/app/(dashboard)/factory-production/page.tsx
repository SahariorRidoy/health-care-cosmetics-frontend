'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Eye, SlidersHorizontal, X, Truck, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { FactoryBatchFormDialog } from '@/features/factory-production/components/FactoryBatchFormDialog';
import { AddReceiptDialogLoader } from '@/features/factory-production/components/AddReceiptDialogLoader';
import {
  useGetFactoryBatchesQuery,
  useDeleteFactoryBatchMutation,
  useDispatchFactoryBatchMutation,
} from '@/features/factory-production/services/factoryProductionApi';
import type { FactoryBatch } from '@/features/factory-production/types';

const STATUS_OPTIONS = ['DRAFT', 'DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'] as const;

export default function FactoryProductionPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<FactoryBatch | null>(null);
  const [receiptBatchId, setReceiptBatchId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dispatchId, setDispatchId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, refetch } = useGetFactoryBatchesQuery({
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const [deleteBatch, { isLoading: deleting }] = useDeleteFactoryBatchMutation();
  const [dispatchBatch, { isLoading: dispatching }] = useDispatchFactoryBatchMutation();

  function openCreate() { setEditBatch(null); setOpen(true); }
  function openEdit(b: FactoryBatch) { setEditBatch(b); setOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteBatch(deleteId).unwrap();
      toast.success('Factory batch deleted');
    } catch {
      toast.error('Failed to delete factory batch');
    } finally {
      setDeleteId(null);
    }
  }

  async function handleDispatch() {
    if (!dispatchId) return;
    try {
      await dispatchBatch(dispatchId).unwrap();
      toast.success('Materials dispatched — stock deducted');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to dispatch materials');
    } finally {
      setDispatchId(null);
    }
  }

  function clearFilters() { setSearch(''); setStatusFilter(''); setPage(1); }

  const batches = data?.data?.factoryBatches ?? [];
  const hasActiveFilters = search || statusFilter;

  const columns: Column<FactoryBatch>[] = [
    {
      key: 'fbNumber', header: 'FB #', priority: 'P1',
      render: (row) => <span className="font-mono text-xs font-semibold text-foreground">{row.fbNumber}</span>,
    },
    {
      key: 'batchName', header: 'Batch Name', priority: 'P1',
      render: (row) => <span className="font-medium text-foreground">{row.batchName}</span>,
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'dispatch', header: 'Materials', priority: 'P3',
      render: (row) => {
        const count = row.dispatch.materials.length;
        return <span className="text-secondary">{count} item{count !== 1 ? 's' : ''}</span>;
      },
    },
    {
      key: 'receipts', header: 'Receipts', priority: 'P3',
      render: (row) => <span className="text-secondary">{row.receipts.length}</span>,
    },
    {
      key: 'dispatch.dispatchedDate', header: 'Dispatched', priority: 'P3',
      render: (row) => row.dispatch.dispatchedDate
        ? <span className="text-secondary">{formatDate(row.dispatch.dispatchedDate)}</span>
        : <span className="text-muted">—</span>,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[260px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2 py-1">
          <button
            onClick={() => router.push(`/factory-production/${row._id}`)}
            className="h-8 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            aria-label="View" title="View"
          >
            <Eye size={13} /> View
          </button>
          {['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED'].includes(row.status) && (
            <button
              onClick={() => setReceiptBatchId(row._id)}
              className="h-8 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              aria-label="Add receipt" title="Add Receipt"
            >
              <ClipboardList size={13} /> Add Receipt
            </button>
          )}
          {row.status === 'DRAFT' && (
            <>
              <button
                onClick={() => setDispatchId(row._id)}
                className="p-1.5 rounded-md text-secondary hover:bg-blue-50 hover:text-blue-600 min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="Dispatch" title="Dispatch materials"
              >
                <Truck size={15} />
              </button>
              <button
                onClick={() => openEdit(row)}
                className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="Edit" title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setDeleteId(row._id)}
                className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="Delete" title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Factory Production"
        description="Send materials to external factories and receive finished products"
        breadcrumbs={[{ label: 'Factory Production' }]}
        actions={
          <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} aria-hidden="true" /> Create New Material Dispatch to Factory
          </button>
        }
      />

      {/* Search + filter bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search batch name or FB number…"
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

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-white">
          <span className="text-xs font-medium text-secondary block mb-2">Status</span>
          <div className="flex flex-wrap rounded-md border border-border overflow-hidden text-sm w-fit">
            <button
              onClick={() => { setStatusFilter(''); setPage(1); }}
              className={`px-3 h-8 transition-colors ${!statusFilter ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-50'}`}
            >
              All
            </button>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 h-8 capitalize transition-colors ${statusFilter === s ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-50'}`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : batches.length === 0 && !isLoading ? (
        <EmptyState
          title="No factory batches found"
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first factory batch to get started.'}
          action={
            !hasActiveFilters ? (
              <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <Plus size={16} aria-hidden="true" /> New Material Dispatched to Factory
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={batches} keyField="_id" isLoading={isLoading} pagination={data?.pagination} onPageChange={setPage} />
      )}

      <FactoryBatchFormDialog open={open} onClose={() => setOpen(false)} batch={editBatch} />

      {receiptBatchId && (
        <AddReceiptDialogLoader batchId={receiptBatchId} onClose={() => setReceiptBatchId(null)} />
      )}

      <ConfirmDialog
        open={!!dispatchId}
        title="Dispatch Materials"
        description="This will deduct all material quantities from your stock and mark the batch as Dispatched. This cannot be undone."
        confirmLabel="Dispatch"
        variant="default"
        loading={dispatching}
        onConfirm={handleDispatch}
        onCancel={() => setDispatchId(null)}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Factory Batch"
        description="This will permanently delete the factory batch. Only DRAFT batches can be deleted."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
