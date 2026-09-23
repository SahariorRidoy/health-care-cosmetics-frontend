'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { X, Loader2, PackagePlus } from 'lucide-react';
import { FormField, SelectField } from '@/components/forms/FormField';
import { useGetItemsQuery, useGetUOMsQuery } from '@/features/inventory/services/inventoryApi';
import { useAddFactoryReceiptMutation as useReceiveProductsMutation } from '../services/factoryProductionApi';
import { formatCurrency } from '@/lib/formatters';
import type { FactoryOrder, FactoryExpectedProduct } from '../types';

interface ReceiveLine {
  productIndex: number;
  name: string;
  expectedQty: number;
  uomId: string;
  mode: 'new' | 'existing';
  // new product fields
  sku: string;
  salePrice: string;
  reorderLevel: string;
  baseUomId: string;
  // existing product fields
  linkedItemId: string;
  // common
  receivedQty: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  order: FactoryOrder;
}

export function ReceiveProductsDialog({ open, onClose, order }: Props) {
  const { data: finishedData } = useGetItemsQuery({ type: 'FINISHED_GOOD', isActive: 'true' }, { skip: !open });
  const { data: uomData } = useGetUOMsQuery();
  const [receiveProducts, { isLoading }] = useReceiveProductsMutation();

  const finishedItems = finishedData?.data?.items ?? [];
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);

  const [lines, setLines] = useState<ReceiveLine[]>([]);

  useEffect(() => {
    if (!open) return;
    const initial: ReceiveLine[] = order.expectedProducts.map((p: FactoryExpectedProduct, idx: number) => {
      const linkedObj = p.linkedItem && typeof p.linkedItem !== 'string' ? p.linkedItem : null;
      const alreadyLinkedId = p.linkedItem
        ? (typeof p.linkedItem === 'string' ? p.linkedItem : p.linkedItem._id)
        : '';
      const suggestedSku = linkedObj
        ? linkedObj.sku
        : p.name.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('');
      return {
        productIndex: idx,
        name: p.name,
        expectedQty: p.expectedQty,
        uomId: typeof p.uom === 'string' ? p.uom : p.uom._id,
        mode: alreadyLinkedId ? 'existing' : 'new',
        sku: suggestedSku,
        salePrice: '',
        reorderLevel: '0',
        baseUomId: typeof p.uom === 'string' ? p.uom : p.uom._id,
        linkedItemId: alreadyLinkedId,
        receivedQty: String(p.expectedQty - (p.receivedQty ?? 0)),
      };
    });
    setLines(initial);
  }, [open, order._id]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateLine(idx: number, patch: Partial<ReceiveLine>) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  const costPerUnit = useMemo(() => {
    const totalReceived = lines.reduce((s, l) => s + (parseFloat(l.receivedQty) || 0), 0);
    if (!totalReceived) return 0;
    return (order.totalMaterialCost + order.serviceCharge) / totalReceived;
  }, [lines, order.totalMaterialCost, order.serviceCharge]);

  async function handleSubmit() {
    const filledLines = lines.filter((l) => parseFloat(l.receivedQty) > 0);
    if (!filledLines.length) { toast.error('Enter received quantity for at least one product'); return; }

    for (const l of filledLines) {
      if (l.mode === 'new' && !l.sku.trim()) { toast.error(`Enter SKU for "${l.name}"`); return; }
      if (l.mode === 'new' && !l.baseUomId) { toast.error(`Select base UOM for "${l.name}"`); return; }
      if (l.mode === 'existing' && !l.linkedItemId) { toast.error(`Select existing product for "${l.name}"`); return; }
    }

    const products = filledLines.map((l) => ({
      expectedProductIndex: l.productIndex,
      actualQty: parseFloat(l.receivedQty),
      ...(l.mode === 'existing'
        ? { linkedItem: l.linkedItemId }
        : {
            newProduct: {
              name: l.name,
              sku: l.sku.trim(),
              salePrice: parseFloat(l.salePrice) || 0,
              reorderLevel: parseInt(l.reorderLevel) || 0,
              baseUom: l.baseUomId,
            },
          }),
    }));

    try {
      await receiveProducts({ id: order._id, body: { products } as never }).unwrap();
      toast.success('Products received and added to stock');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to receive products');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-label="Receive Products"
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Receive Products</h2>
            <p className="text-xs text-secondary mt-0.5">{order.foNumber} — {order.orderName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Cost info */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-secondary">Material Cost: <strong className="text-foreground">{formatCurrency(order.totalMaterialCost)}</strong></span>
              <span className="text-secondary">Service Charge: <strong className="text-foreground">{formatCurrency(order.serviceCharge)}</strong></span>
              {costPerUnit > 0 && (
                <span className="text-secondary">Est. Cost/Unit: <strong className="text-emerald-600">{formatCurrency(costPerUnit)}</strong></span>
              )}
            </div>
          </div>

          {lines.map((line, idx) => {
            const alreadyReceived = order.expectedProducts[idx]?.receivedQty ?? 0;
            const remaining = line.expectedQty - alreadyReceived;
            return (
              <div key={idx} className="rounded-xl border border-border bg-slate-50 p-4 space-y-3">
                {/* Product header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <PackagePlus size={15} className="text-emerald shrink-0" />
                      {line.name}
                    </p>
                    <p className="text-xs text-secondary mt-0.5">
                      Expected: {line.expectedQty} {uoms.find((u) => u._id === line.uomId)?.symbol ?? ''}
                      {alreadyReceived > 0 && <span className="ml-2 text-emerald-600">· Already received: {alreadyReceived}</span>}
                      {remaining > 0 && <span className="ml-2 text-amber-600">· Remaining: {remaining}</span>}
                    </p>
                  </div>
                  {/* Mode toggle */}
                  <div className="flex rounded-md border border-border overflow-hidden text-xs shrink-0">
                    {(['new', 'existing'] as const).map((m) => {
                      const isLinked = !!order.expectedProducts[idx]?.linkedItem;
                      const disabled = isLinked && m === 'new';
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => !disabled && updateLine(idx, { mode: m })}
                          disabled={disabled}
                          className={`px-3 h-7 capitalize transition-colors ${
                            line.mode === m ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-100'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {m === 'new' ? 'New Product' : 'Existing'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Received qty */}
                <FormField
                  label="Received Qty"
                  type="number" min={0} step="any"
                  placeholder={`Max remaining: ${remaining}`}
                  value={line.receivedQty}
                  onChange={(e) => updateLine(idx, { receivedQty: e.target.value })}
                />

                {line.mode === 'new' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="SKU" required placeholder="Auto-generated" value={line.sku} onChange={(e) => updateLine(idx, { sku: e.target.value })} />
                    <SelectField label="Base UOM" required value={line.baseUomId} onChange={(e) => updateLine(idx, { baseUomId: e.target.value })}>
                      <option value="">Select UOM…</option>
                      {uoms.map((u) => <option key={u._id} value={u._id}>{u.symbol} — {u.name}</option>)}
                    </SelectField>
                    <FormField label="Sale Price (৳)" type="number" min={0} step="0.01" placeholder="0.00" value={line.salePrice} onChange={(e) => updateLine(idx, { salePrice: e.target.value })} />
                    <FormField label="Reorder Level" type="number" min={0} step="1" placeholder="0" value={line.reorderLevel} onChange={(e) => updateLine(idx, { reorderLevel: e.target.value })} />
                  </div>
                ) : (
                  <SelectField label="Map to Existing Product" required value={line.linkedItemId} onChange={(e) => updateLine(idx, { linkedItemId: e.target.value })}>
                    <option value="">Select product…</option>
                    {finishedItems.map((item) => (
                      <option key={item._id} value={item._id}>{item.name} (SKU: {item.sku})</option>
                    ))}
                  </SelectField>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Confirm Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
