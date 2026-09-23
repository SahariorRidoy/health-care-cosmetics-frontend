'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Truck, PackageCheck, XCircle, Pencil, RotateCcw, Factory } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { FactoryBatchFormDialog } from '@/features/factory-production/components/FactoryBatchFormDialog';
import { AddReceiptDialog } from '@/features/factory-production/components/AddReceiptDialog';
import { ReturnMaterialDialog } from '@/features/factory-production/components/ReturnMaterialDialog';
import {
  useGetFactoryBatchQuery,
  useDispatchFactoryBatchMutation,
  useCancelFactoryBatchMutation,
  useUpdateFactoryBatchStatusMutation,
} from '@/features/factory-production/services/factoryProductionApi';
import type { FactoryBatch, FactoryDispatchMaterial, FactoryReceipt, FactoryMaterialReturn, FactoryReceiptProduct, FactoryReceiptMaterialUsed } from '@/features/factory-production/types';

const STATUS_STEPS = ['DRAFT', 'DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED'] as const;

// ── Factory stock panel ───────────────────────────────────────────────────────

function FactoryStockPanel({ batch }: { batch: FactoryBatch }) {
  const rows = batch.dispatch.materials.map((m: FactoryDispatchMaterial) => {
    const item = m.item as { _id: string; name: string; sku: string } | string;
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
        <h2 className="text-sm font-semibold text-foreground">Factory Stock</h2>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FactoryBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmInProduction, setConfirmInProduction] = useState(false);

  const { data, isLoading, isError, refetch } = useGetFactoryBatchQuery(id);
  const [dispatchBatch, { isLoading: dispatching }] = useDispatchFactoryBatchMutation();
  const [cancelBatch, { isLoading: cancelling }] = useCancelFactoryBatchMutation();
  const [updateStatus, { isLoading: updatingStatus }] = useUpdateFactoryBatchStatusMutation();

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.factoryBatch) return <ErrorState onRetry={refetch} />;

  const batch = data.data.factoryBatch;
  const factoryName = typeof batch.factory === 'object' ? batch.factory.name : batch.factory;
  const warehouseName = typeof batch.warehouse === 'object' ? batch.warehouse.name : batch.warehouse;

  const canEdit = batch.status === 'DRAFT';
  const canDispatch = batch.status === 'DRAFT';
  const canMarkInProduction = batch.status === 'DISPATCHED';
  const canAddReceipt = ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED'].includes(batch.status);
  const canReturn = ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED'].includes(batch.status);
  const canCancel = ['DRAFT', 'DISPATCHED'].includes(batch.status) && batch.receipts.length === 0;

  async function handleDispatch() {
    try {
      await dispatchBatch(batch._id).unwrap();
      toast.success('Materials dispatched — stock deducted');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to dispatch');
    } finally {
      setConfirmDispatch(false);
    }
  }

  async function handleMarkInProduction() {
    try {
      await updateStatus({ id: batch._id, status: 'IN_PRODUCTION' }).unwrap();
      toast.success('Batch marked as In Production');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to update status');
    } finally {
      setConfirmInProduction(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelBatch(batch._id).unwrap();
      toast.success('Factory batch cancelled');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to cancel');
    } finally {
      setConfirmCancel(false);
    }
  }

  const currentStepIdx = STATUS_STEPS.indexOf(batch.status as typeof STATUS_STEPS[number]);

  return (
    <>
      <PageHeader
        title={batch.batchName}
        description={`${batch.fbNumber} · ${factoryName} · ${warehouseName}`}
        breadcrumbs={[{ label: 'Factory Production', href: '/factory-production' }, { label: batch.fbNumber }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} /> Back
            </button>
            {canEdit && (
              <button onClick={() => setEditOpen(true)} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Pencil size={14} /> Edit
              </button>
            )}
            {canDispatch && (
              <button onClick={() => setConfirmDispatch(true)} className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <Truck size={15} /> Dispatch Materials
              </button>
            )}
            {canMarkInProduction && (
              <button onClick={() => setConfirmInProduction(true)} className="h-9 px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <Factory size={15} /> Mark In Production
              </button>
            )}
            {canAddReceipt && (
              <button onClick={() => setReceiptOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <PackageCheck size={15} /> Add Receipt
              </button>
            )}
            {canReturn && (
              <button onClick={() => setReturnOpen(true)} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <RotateCcw size={14} /> Return Material
              </button>
            )}
            {canCancel && (
              <button onClick={() => setConfirmCancel(true)} className="h-9 px-3 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-sm flex items-center gap-2 transition-colors">
                <XCircle size={14} /> Cancel
              </button>
            )}
          </div>
        }
      />

      {/* 2. Status timeline */}
      <div className="bg-white rounded-lg border border-border p-4 mb-4">
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
                    : done || active ? 'border-emerald bg-emerald text-white'
                    : 'border-border bg-white text-muted'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center leading-tight max-w-[70px] ${active ? 'font-semibold text-foreground' : 'text-muted'}`}>
                    {step.replace(/_/g, ' ')}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-emerald' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
          {batch.status === 'CANCELLED' && (
            <div className="ml-3 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold shrink-0">CANCELLED</div>
          )}
        </div>
      </div>

      {/* 3. Dispatch Info */}
      <div className="bg-white rounded-lg border border-border mb-4">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Dispatch Info</h2>
          {batch.dispatch.dispatchedDate && (
            <span className="text-xs text-secondary">Dispatched: {formatDate(batch.dispatch.dispatchedDate)}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Material', 'Planned Qty', 'Dispatched Qty', 'UOM', 'Unit Cost', 'Line Cost'].map((h) => (
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

      {/* 4. Factory Stock Panel */}
      {batch.status !== 'DRAFT' && (
        <div className="mb-4">
          <FactoryStockPanel batch={batch} />
        </div>
      )}

      {/* 5. Receipts */}
      <div className="bg-white rounded-lg border border-border mb-4">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Production Receipts ({batch.receipts.length})</h2>
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
                        const linkedItem = p.linkedItem as { _id: string; name: string; sku: string } | string | undefined;
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

      {/* 6. Material Returns */}
      {batch.materialReturns.length > 0 && (
        <div className="bg-white rounded-lg border border-border mb-4">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Material Returns ({batch.materialReturns.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {batch.materialReturns.map((ret: FactoryMaterialReturn) => (
              <div key={ret._id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-secondary">{formatDate(ret.returnDate)}</span>
                  {ret.notes && <span className="text-xs text-secondary italic">{ret.notes}</span>}
                </div>
                <div className="flex flex-wrap gap-3">
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

      {/* Dialogs */}
      <FactoryBatchFormDialog open={editOpen} onClose={() => setEditOpen(false)} batch={batch} />
      <AddReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} batch={batch} />
      <ReturnMaterialDialog open={returnOpen} onClose={() => setReturnOpen(false)} batch={batch} />

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
        description="This will update the batch status to In Production. The factory has started working on the materials."
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
    </>
  );
}
