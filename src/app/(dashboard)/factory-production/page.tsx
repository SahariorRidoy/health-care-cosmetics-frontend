'use client';

import { useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, Truck, PackagePlus,
  Factory, Package, ReceiptText, Calendar, AlertTriangle, Inbox,
  Filter, ChevronDown, X, PackageCheck, XCircle, RotateCcw, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { FactoryBatchFormDialog } from '@/features/factory-production/components/FactoryBatchFormDialog';
import { AddReceiptDialog } from '@/features/factory-production/components/AddReceiptDialog';
import { RestockMaterialDialog } from '@/features/factory-production/components/RestockMaterialDialog';
import { ReturnMaterialDialog } from '@/features/factory-production/components/ReturnMaterialDialog';
import {
  useGetFactoryBatchesQuery,
  useGetFactoryBatchQuery,
  useDeleteFactoryBatchMutation,
  useDispatchFactoryBatchMutation,
  useCancelFactoryBatchMutation,
  useUpdateFactoryBatchStatusMutation,
} from '@/features/factory-production/services/factoryProductionApi';
import type {
  FactoryBatch, FactoryDispatchMaterial, FactoryReceipt,
  FactoryMaterialReturn, FactoryRestockEntry, FactoryReceiptProduct,
  FactoryReceiptMaterialUsed,
} from '@/features/factory-production/types';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['DRAFT', 'DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'] as const;

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string; track: string }> = {
  DRAFT:              { label: 'Draft',           dot: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 ring-amber-200',       track: 'bg-amber-400' },
  DISPATCHED:         { label: 'Dispatched',      dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 ring-blue-200',          track: 'bg-blue-500' },
  IN_PRODUCTION:      { label: 'In Production',   dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 ring-violet-200',    track: 'bg-violet-500' },
  PARTIALLY_RECEIVED: { label: 'Partial Receipt', dot: 'bg-orange-400',  pill: 'bg-orange-50 text-orange-700 ring-orange-200',    track: 'bg-orange-400' },
  COMPLETED:          { label: 'Completed',       dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', track: 'bg-emerald-500' },
  CANCELLED:          { label: 'Cancelled',       dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-500 ring-slate-200',      track: 'bg-slate-400' },
};

const STATUS_STEPS = ['DRAFT', 'DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED'] as const;

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Left panel: batch list item ───────────────────────────────────────────────

function BatchListItem({ batch, selected, onClick }: { batch: FactoryBatch; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[batch.status] ?? STATUS_CONFIG.DRAFT;
  const batchName = batch.batchName.charAt(0).toUpperCase() + batch.batchName.slice(1);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-b border-slate-100 transition-all relative ${
        selected
          ? 'bg-slate-50 border-l-2 border-l-slate-900 pl-3 pr-4 py-3'
          : 'bg-white hover:bg-slate-50/70 pl-4 pr-4 py-3 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[13px] truncate leading-tight ${
          selected ? 'font-bold text-slate-900' : 'font-medium text-foreground'
        }`}>
          {batchName}
        </p>
        <span className={`shrink-0 text-[10px] font-medium ${
          selected ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {cfg.label}
        </span>
      </div>
      <p className={`text-[11px] font-mono mt-0.5 ${
        selected ? 'text-slate-500' : 'text-muted'
      }`}>
        {batch.fbNumber}
      </p>
    </button>
  );
}

// ── Left panel filter bar ─────────────────────────────────────────────────────

function LeftToolbar({ search, onSearch, statusFilter, onStatusFilter, total, onClear }: {
  search: string; onSearch: (v: string) => void;
  statusFilter: string; onStatusFilter: (v: string) => void;
  total?: number; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-2 border-b border-slate-200 bg-white space-y-2">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search batches…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`h-7 w-full px-2.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
              statusFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter size={10} />
            <span className="truncate">{statusFilter ? STATUS_CONFIG[statusFilter]?.label : 'All statuses'}</span>
            {!statusFilter && total !== undefined && <span className="ml-auto text-slate-400 font-normal">{total}</span>}
            <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg z-30 py-1">
              <button onClick={() => { onStatusFilter(''); setOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition-colors ${!statusFilter ? 'bg-slate-50 text-foreground' : 'text-secondary hover:bg-slate-50'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />All
              </button>
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => { onStatusFilter(s); setOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${statusFilter === s ? 'bg-slate-50 font-semibold text-foreground' : 'font-medium text-secondary hover:bg-slate-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s].dot}`} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
        {(search || statusFilter) && (
          <button onClick={onClear} className="h-7 w-7 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0">
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Right panel: factory stock ────────────────────────────────────────────────

function FactoryStockPanel({ batch }: { batch: FactoryBatch }) {
  const rows = batch.dispatch.materials.map((m: FactoryDispatchMaterial) => {
    const item = m.item as { _id: string; name: string } | string;
    const uom = m.uom as { _id: string; symbol: string } | string;
    const itemId = typeof item === 'string' ? item : item._id;
    const itemName = typeof item === 'string' ? item : item.name;
    const uomSymbol = typeof uom === 'string' ? '' : uom.symbol;

    const used = batch.receipts.reduce((s, r: FactoryReceipt) =>
      s + r.products.reduce((ps, p: FactoryReceiptProduct) =>
        ps + p.materialsUsed
          .filter((mu: FactoryReceiptMaterialUsed) => {
            const muItem = mu.item as { _id: string } | string;
            return (typeof muItem === 'string' ? muItem : muItem._id) === itemId;
          })
          .reduce((ms, mu: FactoryReceiptMaterialUsed) => ms + mu.usedQty, 0), 0), 0);

    const returned = batch.materialReturns.reduce((s, r: FactoryMaterialReturn) =>
      s + r.materials
        .filter((mat) => {
          const matItem = mat.item as { _id: string } | string;
          return (typeof matItem === 'string' ? matItem : matItem._id) === itemId;
        })
        .reduce((ms, mat) => ms + mat.returnedQty, 0), 0);

    const remaining = Math.max(0, m.dispatchedQty - used - returned);
    return { itemName, uomSymbol, dispatched: m.dispatchedQty, used, returned, remaining };
  });

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Factory Stock</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {['Material', 'Dispatched', 'Used', 'Returned', 'Remaining'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-secondary uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium text-foreground">{r.itemName}</td>
                <td className="px-4 py-2 text-secondary">{r.dispatched} {r.uomSymbol}</td>
                <td className="px-4 py-2 text-secondary">{r.used} {r.uomSymbol}</td>
                <td className="px-4 py-2 text-secondary">{r.returned} {r.uomSymbol}</td>
                <td className="px-4 py-2">
                  <span className={`font-semibold ${r.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {r.remaining} {r.uomSymbol}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Right panel: batch detail ─────────────────────────────────────────────────

function BatchDetail({ batchId, onEdit, onDeleted }: {
  batchId: string;
  onEdit: (b: FactoryBatch) => void;
  onDeleted: () => void;
}) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmInProduction, setConfirmInProduction] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, isError, refetch } = useGetFactoryBatchQuery(batchId);
  const [dispatchBatch, { isLoading: dispatching }] = useDispatchFactoryBatchMutation();
  const [cancelBatch, { isLoading: cancelling }] = useCancelFactoryBatchMutation();
  const [updateStatus, { isLoading: updatingStatus }] = useUpdateFactoryBatchStatusMutation();
  const [deleteBatch, { isLoading: deleting }] = useDeleteFactoryBatchMutation();

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );
  if (isError || !data?.data?.factoryBatch) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <AlertTriangle size={24} className="text-red-400" />
      <p className="text-sm text-muted">Failed to load batch</p>
      <button onClick={refetch} className="h-8 px-4 rounded-lg border border-border text-xs text-secondary hover:bg-slate-50">Retry</button>
    </div>
  );

  const batch = data.data.factoryBatch;
  const factoryName = typeof batch.factory === 'object' ? batch.factory.name : batch.factory;
  const warehouseName = typeof batch.warehouse === 'object' ? batch.warehouse.name : batch.warehouse;
  const canEdit = batch.status === 'DRAFT';
  const canDispatch = batch.status === 'DRAFT';
  const canMarkInProduction = batch.status === 'DISPATCHED';
  const canAddReceipt = ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED'].includes(batch.status);
  const canReturn = ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED'].includes(batch.status);
  const canRestock = ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED'].includes(batch.status);
  const canCancel = ['DRAFT', 'DISPATCHED'].includes(batch.status) && batch.receipts.length === 0;
  const currentStepIdx = STATUS_STEPS.indexOf(batch.status as typeof STATUS_STEPS[number]);

  async function handleDispatch() {
    try {
      await dispatchBatch(batch._id).unwrap();
      toast.success('Materials dispatched — stock deducted');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to dispatch');
    } finally { setConfirmDispatch(false); }
  }

  async function handleMarkInProduction() {
    try {
      await updateStatus({ id: batch._id, status: 'IN_PRODUCTION' }).unwrap();
      toast.success('Batch marked as In Production');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to update status');
    } finally { setConfirmInProduction(false); }
  }

  async function handleCancel() {
    try {
      await cancelBatch(batch._id).unwrap();
      toast.success('Factory batch cancelled');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to cancel');
    } finally { setConfirmCancel(false); }
  }

  async function handleDelete() {
    try {
      await deleteBatch(batch._id).unwrap();
      toast.success('Factory batch deleted — remaining materials restocked');
      onDeleted();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to delete');
    } finally { setConfirmDelete(false); }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Detail header */}
      <div className="shrink-0 px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate mb-1">
              {batch.batchName.charAt(0).toUpperCase() + batch.batchName.slice(1)}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[11px] font-mono text-muted">{batch.fbNumber}</span>
              {factoryName && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Factory size={10} className="shrink-0" />{factoryName}
                </span>
              )}
              {warehouseName && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Package size={10} className="shrink-0" />{warehouseName}
                </span>
              )}
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ReceiptText size={10} className="shrink-0" />{batch.receipts.length} receipt{batch.receipts.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar size={10} className="shrink-0" />{formatDate(batch.createdAt)}
              </span>
            </div>
          </div>
          <StatusPill status={batch.status} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canDispatch && (
            <button onClick={() => setConfirmDispatch(true)} className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Truck size={13} /> Dispatch
            </button>
          )}
          {canMarkInProduction && (
            <button onClick={() => setConfirmInProduction(true)} className="h-8 px-3 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Factory size={13} /> In Production
            </button>
          )}
          {canAddReceipt && (
            <button onClick={() => setReceiptOpen(true)} className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <PackageCheck size={13} /> Add Receipt
            </button>
          )}
          {canRestock && (
            <button onClick={() => setRestockOpen(true)} className="h-8 px-3 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <PackagePlus size={13} /> Send More
            </button>
          )}
          {canReturn && (
            <button onClick={() => setReturnOpen(true)} className="h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <RotateCcw size={13} /> Return
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(batch)} className="h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Pencil size={13} /> Edit
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {canCancel && (
              <button onClick={() => setConfirmCancel(true)} className="h-8 px-3 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <XCircle size={13} /> Cancel
              </button>
            )}
            <button onClick={() => setConfirmDelete(true)} className="h-8 px-3 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable detail body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Status timeline */}
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="flex items-center">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentStepIdx;
              const active = i === currentStepIdx;
              const cancelled = batch.status === 'CANCELLED';
              return (
                <div key={step} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      cancelled && active ? 'border-red-400 bg-red-100 text-red-600'
                      : done || active ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border bg-white text-muted'
                    }`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1 text-center leading-tight max-w-[64px] ${active ? 'font-semibold text-foreground' : 'text-muted'}`}>
                      {step.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-emerald-500' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
            {batch.status === 'CANCELLED' && (
              <div className="ml-3 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold shrink-0">CANCELLED</div>
            )}
          </div>
        </div>

        {/* Dispatch Info */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Dispatch Info</h3>
            {batch.dispatch.dispatchedDate && (
              <span className="text-xs text-secondary flex items-center gap-1"><Calendar size={11} />{formatDate(batch.dispatch.dispatchedDate)}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  {['Material', 'Planned', 'Dispatched', 'UOM', 'Unit Cost', 'Line Cost'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.dispatch.materials.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted text-sm">No materials.</td></tr>
                ) : (
                  <>
                    {batch.dispatch.materials.map((m: FactoryDispatchMaterial, i) => {
                      const item = m.item as { _id: string; name: string } | string;
                      const uom = m.uom as { _id: string; symbol: string } | string;
                      const itemName = typeof item === 'string' ? item : item.name;
                      const uomSymbol = typeof uom === 'string' ? '' : uom.symbol;
                      const lineCost = m.dispatchedQty * m.unitCost;
                      return (
                        <tr key={i} className="border-b border-border hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-foreground">{itemName}</td>
                          <td className="px-4 py-2 text-secondary">{m.qty} {uomSymbol}</td>
                          <td className="px-4 py-2 text-foreground">{m.dispatchedQty} {uomSymbol}</td>
                          <td className="px-4 py-2 text-secondary">{uomSymbol}</td>
                          <td className="px-4 py-2 text-secondary">{m.unitCost > 0 ? formatCurrency(m.unitCost) : '—'}</td>
                          <td className="px-4 py-2 font-medium">{lineCost > 0 ? formatCurrency(lineCost) : '—'}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 border-t-2 border-border">
                      <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-foreground">Total Dispatch Cost</td>
                      <td className="px-4 py-2 text-base font-bold text-blue-600">
                        {formatCurrency(batch.dispatch.materials.reduce((s, m: FactoryDispatchMaterial) => s + m.dispatchedQty * m.unitCost, 0))}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {batch.dispatch.notes && (
            <p className="px-4 py-3 text-sm text-secondary border-t border-border">{batch.dispatch.notes}</p>
          )}
        </div>

        {/* Factory Stock */}
        {batch.status !== 'DRAFT' && <FactoryStockPanel batch={batch} />}

        {/* Receipts */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Production Receipts</h3>
            <span className="text-xs text-muted">{batch.receipts.length} receipt{batch.receipts.length !== 1 ? 's' : ''}</span>
          </div>
          {batch.receipts.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted text-sm">No receipts yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {batch.receipts.map((r: FactoryReceipt) => (
                <div key={r._id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono text-xs font-semibold text-foreground">{r.receiptNumber}</span>
                      <span className="text-xs text-secondary ml-3">{formatDate(r.receiptDate)}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-secondary">
                      {r.deliveryCost > 0 && <span>Delivery: {formatCurrency(r.deliveryCost)}</span>}
                      {r.productionCost > 0 && <span>Production: {formatCurrency(r.productionCost)}</span>}
                      {r.otherCost > 0 && <span>Other: {formatCurrency(r.otherCost)}</span>}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-[13px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-border">
                          {['Product', 'Qty', 'Material Cost', 'Shared Cost', 'Unit Cost', 'Sale Price'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.products.map((p: FactoryReceiptProduct, pi) => {
                          const linkedItem = p.linkedItem as { _id: string; name: string } | string | undefined;
                          const uom = p.uom as { _id: string; symbol: string } | string;
                          const uomSymbol = typeof uom === 'string' ? '' : uom.symbol;
                          const linkedName = linkedItem && typeof linkedItem === 'object' ? linkedItem.name : null;
                          return (
                            <tr key={pi} className="border-b border-border last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <p className="font-medium text-foreground">{p.productName}</p>
                                {linkedName && <p className="text-[11px] text-emerald-600">→ {linkedName}</p>}
                              </td>
                              <td className="px-3 py-2 text-secondary">{p.receivedQty} {uomSymbol}</td>
                              <td className="px-3 py-2">{formatCurrency(p.materialCost)}</td>
                              <td className="px-3 py-2">{formatCurrency(p.allocatedSharedCost)}</td>
                              <td className="px-3 py-2 font-semibold text-foreground">{formatCurrency(p.totalUnitCost)}</td>
                              <td className="px-3 py-2">{p.salePrice ? formatCurrency(p.salePrice) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Material Returns */}
        {batch.materialReturns.length > 0 && (
          <div className="bg-white rounded-lg border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Material Returns</h3>
              <span className="text-xs text-muted">{batch.materialReturns.length}</span>
            </div>
            <div className="divide-y divide-border">
              {batch.materialReturns.map((ret: FactoryMaterialReturn) => (
                <div key={ret._id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-secondary">{formatDate(ret.returnDate)}</span>
                    {ret.notes && <span className="text-xs text-secondary italic">{ret.notes}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ret.materials.map((mat, mi) => {
                      const matItem = mat.item as { _id: string; name: string } | string;
                      const matUom = mat.uom as { _id: string; symbol: string } | string;
                      const matName = typeof matItem === 'string' ? matItem : matItem.name;
                      const matUomSym = typeof matUom === 'string' ? '' : matUom.symbol;
                      return (
                        <span key={mi} className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                          {matName}: {mat.returnedQty} {matUomSym}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restock History */}
        {batch.restockHistory?.length > 0 && (
          <div className="bg-white rounded-lg border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Restock History</h3>
              <span className="text-xs text-muted">{batch.restockHistory.length}</span>
            </div>
            <div className="divide-y divide-border">
              {batch.restockHistory.map((entry: FactoryRestockEntry) => {
                const by = typeof entry.createdBy === 'object' ? entry.createdBy.name : '';
                return (
                  <div key={entry._id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-blue-600">{formatDate(entry.restockDate)}</span>
                        {by && <span className="text-xs text-secondary">by {by}</span>}
                      </div>
                      {entry.notes && <span className="text-xs text-secondary italic">{entry.notes}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.materials.map((mat, mi) => {
                        const matItem = mat.item as { _id: string; name: string } | string;
                        const matUom = mat.uom as { _id: string; symbol: string } | string;
                        const matName = typeof matItem === 'string' ? matItem : matItem.name;
                        const matUomSym = typeof matUom === 'string' ? '' : matUom.symbol;
                        return (
                          <span key={mi} className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                            {matName}: +{mat.qty} {matUomSym}
                            {mat.unitCost > 0 && <span className="ml-1 text-blue-500">@ {formatCurrency(mat.unitCost)}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {batch.notes && (
          <div className="bg-white rounded-lg border border-border px-4 py-3">
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-foreground">{batch.notes}</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} batch={batch} />
      <ReturnMaterialDialog open={returnOpen} onClose={() => setReturnOpen(false)} batch={batch} />
      <RestockMaterialDialog open={restockOpen} onClose={() => setRestockOpen(false)} batch={batch} />

      <ConfirmDialog
        open={confirmDispatch}
        title="Dispatch Materials"
        description="This will deduct all material quantities from your stock and mark the batch as Dispatched. This cannot be undone."
        confirmLabel="Dispatch"
        variant="default"
        loading={dispatching}
        onConfirm={handleDispatch}
        onCancel={() => setConfirmDispatch(false)}
      />
      <ConfirmDialog
        open={confirmInProduction}
        title="Mark as In Production"
        description="This will update the batch status to In Production."
        confirmLabel="Confirm"
        variant="default"
        loading={updatingStatus}
        onConfirm={handleMarkInProduction}
        onCancel={() => setConfirmInProduction(false)}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel Factory Batch"
        description={batch.status === 'DISPATCHED' ? 'Materials have already been dispatched. Cancelling will restore the stock.' : 'Are you sure you want to cancel this factory batch?'}
        confirmLabel="Cancel Batch"
        variant="danger"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Factory Batch"
        description="This will permanently delete this batch. Any remaining materials still at the factory will be restocked back to your warehouse."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FactoryProductionPage() {
  const [open, setOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<FactoryBatch | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch } = useGetFactoryBatchesQuery({
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const batches = data?.data?.factoryBatches ?? [];
  const pagination = data?.pagination;

  // Auto-select first batch when list loads
  const firstId = batches[0]?._id;
  const effectiveSelected = selectedId ?? firstId ?? null;

  function openCreate() { setEditBatch(null); setOpen(true); }

  return (
    <>
      <PageHeader
        title="Factory Production"
        description="Manage material dispatches and production receipts from external factories"
        breadcrumbs={[{ label: 'Factory Production' }]}
        actions={
          <button
            onClick={openCreate}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={15} /> New Batch
          </button>
        }
      />

      {/* ── Split layout ── */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden bg-slate-50" style={{ height: 'calc(100vh - 160px)' }}>

        {/* Left: batch list */}
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 bg-white">
          <LeftToolbar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            statusFilter={statusFilter}
            onStatusFilter={(v) => { setStatusFilter(v); setPage(1); }}
            total={pagination?.total}
            onClear={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
          />

          <div className="flex-1 overflow-y-auto">
            {isError ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
                <AlertTriangle size={20} className="text-red-400" />
                <p className="text-xs text-muted">Failed to load</p>
                <button onClick={refetch} className="text-xs text-blue-600 hover:underline">Retry</button>
              </div>
            ) : isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-3 py-3 border-b border-slate-100 animate-pulse">
                    <div className="flex justify-between mb-1.5">
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                      <div className="h-4 w-16 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-2.5 w-20 bg-slate-100 rounded mb-1" />
                    <div className="h-2.5 w-24 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Inbox size={22} className="text-slate-300 mb-2" />
                <p className="text-xs text-muted">
                  {search || statusFilter ? 'No batches match filters' : 'No factory batches yet'}
                </p>
                {!search && !statusFilter && (
                  <button onClick={openCreate} className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Plus size={11} /> Create one
                  </button>
                )}
              </div>
            ) : (
              batches.map((batch) => (
                <BatchListItem
                  key={batch._id}
                  batch={batch}
                  selected={effectiveSelected === batch._id}
                  onClick={() => setSelectedId(batch._id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-white">
              <span className="text-[10px] text-muted">{pagination.page}/{pagination.pages}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="h-6 w-6 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <ChevronDown size={11} className="rotate-90" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  className="h-6 w-6 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {effectiveSelected ? (
            <BatchDetail
              key={effectiveSelected}
              batchId={effectiveSelected}
              onEdit={(b) => { setEditBatch(b); setOpen(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <Factory size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-foreground">Select a batch</p>
              <p className="text-xs text-muted max-w-xs">Choose a factory batch from the left panel to view its details, dispatch materials, and manage receipts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <FactoryBatchFormDialog open={open} onClose={() => setOpen(false)} batch={editBatch} />
    </>
  );
}
