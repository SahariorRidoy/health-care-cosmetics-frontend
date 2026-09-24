'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { TextareaField } from '@/components/forms/FormField';
import { useGetItemsQuery, useGetUOMsQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { useRestockFactoryBatchMutation } from '../services/factoryProductionApi';
import { formatCurrency } from '@/lib/formatters';
import type { FactoryBatch, FactoryDispatchMaterial, FactoryReceipt, FactoryReceiptProduct, FactoryReceiptMaterialUsed, FactoryMaterialReturn } from '../types';

interface MaterialLine {
  itemId: string;
  baseUomId: string;
  baseUomSymbol: string;
  costPrice: number;
  uomId: string;
  qty: string;
  stock: number;
}

const EMPTY_LINE: MaterialLine = { itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '', stock: 0 };

// ── Item dropdown ─────────────────────────────────────────────────────────────

function ItemSelect({ value, items, stockMap, factoryStockMap, onChange }: {
  value: string;
  items: import('@/features/inventory/types').Item[];
  stockMap: Map<string, number>;
  factoryStockMap: Map<string, number>;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleOpen() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  // Keep rect in sync while open (handles scroll)
  useEffect(() => {
    if (!open) return;
    function update() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    }
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  const selected = items.find((i) => i._id === value);
  const warehouseStock = value ? (stockMap.get(value) ?? 0) : null;
  const factoryQty = value ? factoryStockMap.get(value) : undefined;
  const uomSym = selected ? (typeof selected.baseUom === 'object' ? selected.baseUom.symbol : '') : '';
  const isExisting = value ? factoryStockMap.has(value) : false;

  const dropdown = open && rect ? createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 480), zIndex: 9999 }}
      className="rounded-md border border-border bg-white shadow-xl"
    >
      <div className="max-h-72 overflow-y-auto">
        <div className="px-3 py-1.5 grid grid-cols-[1fr_70px_70px_70px_55px] gap-2 border-b border-border bg-slate-50 sticky top-0">
          <span className="text-[10px] font-semibold text-secondary uppercase">Material</span>
          <span className="text-[10px] font-semibold text-secondary uppercase text-right">Warehouse</span>
          <span className="text-[10px] font-semibold text-secondary uppercase text-right">Factory</span>
          <span className="text-[10px] font-semibold text-secondary uppercase text-right">Cost</span>
          <span className="text-[10px] font-semibold text-secondary uppercase text-right">UOM</span>
        </div>
        <div className="px-3 py-2 text-sm text-muted hover:bg-slate-50 cursor-pointer" onMouseDown={() => { onChange(''); setOpen(false); }}>
          Select material…
        </div>
        {items.map((item) => {
          const wStock = stockMap.get(item._id) ?? 0;
          const fQty = factoryStockMap.get(item._id);
          const inFactory = factoryStockMap.has(item._id);
          const sym = typeof item.baseUom === 'object' ? item.baseUom.symbol : '';
          return (
            <div
              key={item._id}
              onMouseDown={() => { onChange(item._id); setOpen(false); }}
              className={`px-3 py-2 cursor-pointer hover:bg-slate-50 grid grid-cols-[1fr_70px_70px_70px_55px] items-center gap-2 ${
                item._id === value ? 'bg-emerald-50' : inFactory ? 'bg-blue-50/50' : ''
              }`}
            >
              <span className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                {item.name}
                {inFactory && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">In Factory</span>
                )}
              </span>
              <span className={`text-xs font-bold text-right ${wStock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{wStock}</span>
              <span className={`text-xs font-bold text-right ${
                fQty === undefined ? 'text-muted' : (fQty ?? 0) <= 0 ? 'text-red-500' : 'text-blue-600'
              }`}>
                {fQty !== undefined ? fQty : '—'}
              </span>
              <span className="text-xs font-bold text-amber-600 text-right">{formatCurrency(item.costPrice)}</span>
              <span className="text-xs font-bold text-secondary text-right">{sym}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative flex flex-col gap-0.5">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`h-9 w-full rounded-md border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald flex items-center justify-between gap-1 ${
          isExisting ? 'border-blue-400' : 'border-border'
        }`}
      >
        <span className="truncate flex items-center gap-1.5">
          {selected ? selected.name : <span className="text-muted">Select material…</span>}
          {isExisting && <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">In Factory</span>}
        </span>
        <ChevronDown size={14} className="shrink-0 text-secondary" />
      </button>
      {selected && (
        <div className="flex items-center gap-3 px-0.5">
          <p className={`text-[10px] leading-tight font-medium ${(warehouseStock ?? 0) <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            Warehouse: {warehouseStock} {uomSym}
          </p>
          {isExisting && (
            <p className={`text-[10px] leading-tight font-medium ${(factoryQty ?? 0) <= 0 ? 'text-red-500' : 'text-blue-600'}`}>
              Factory: {factoryQty} {uomSym}
            </p>
          )}
        </div>
      )}
      {dropdown}
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  batch: FactoryBatch;
}

export function RestockMaterialDialog({ open, onClose, batch }: Props) {
  const { data: rawData } = useGetItemsQuery({ type: 'RAW_MATERIAL', isActive: 'true' });
  const { data: pkgData } = useGetItemsQuery({ type: 'PACKAGING', isActive: 'true' });
  const { data: uomData } = useGetUOMsQuery();
  const { data: allBalancesData } = useGetStockBalancesQuery({}, { skip: !open });

  const [restock, { isLoading }] = useRestockFactoryBatchMutation();

  const allItems = useMemo(() => [...(rawData?.data?.items ?? []), ...(pkgData?.data?.items ?? [])], [rawData, pkgData]);
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of allBalancesData?.data?.balances ?? []) {
      const itemId = typeof b.item === 'string' ? b.item : b.item._id;
      map.set(itemId, (map.get(itemId) ?? 0) + b.quantity);
    }
    return map;
  }, [allBalancesData]);

  // Derive factory remaining stock per item from the batch
  const factoryStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of batch.dispatch.materials as FactoryDispatchMaterial[]) {
      const itemId = typeof m.item === 'string' ? m.item : (m.item as { _id: string })._id;
      const used = batch.receipts.reduce((s, r: FactoryReceipt) =>
        s + r.products.reduce((ps, p: FactoryReceiptProduct) =>
          ps + p.materialsUsed
            .filter((mu: FactoryReceiptMaterialUsed) => {
              const muId = typeof mu.item === 'string' ? mu.item : (mu.item as { _id: string })._id;
              return muId === itemId;
            })
            .reduce((ms, mu: FactoryReceiptMaterialUsed) => ms + mu.usedQty, 0), 0), 0);
      const returned = batch.materialReturns.reduce((s, r: FactoryMaterialReturn) =>
        s + r.materials
          .filter((mat) => {
            const matId = typeof mat.item === 'string' ? mat.item : (mat.item as { _id: string })._id;
            return matId === itemId;
          })
          .reduce((ms, mat) => ms + mat.returnedQty, 0), 0);
      map.set(itemId, Math.max(0, m.dispatchedQty - used - returned));
    }
    return map;
  }, [batch]);

  const [lines, setLines] = useState<MaterialLine[]>([{ ...EMPTY_LINE }]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) { setLines([{ ...EMPTY_LINE }]); setNotes(''); }
  }, [open]);

  const pickItem = useCallback((idx: number, itemId: string) => {
    const item = allItems.find((i) => i._id === itemId);
    if (!item) { setLines((p) => p.map((l, i) => i === idx ? { ...EMPTY_LINE } : l)); return; }
    const baseUomObj = typeof item.baseUom === 'object' ? item.baseUom : uoms.find((u) => u._id === item.baseUom);
    const baseUomId = baseUomObj?._id ?? (typeof item.baseUom === 'string' ? item.baseUom : '');
    setLines((p) => p.map((l, i) => i === idx ? {
      ...l, itemId, baseUomId,
      baseUomSymbol: baseUomObj?.symbol ?? '',
      costPrice: item.costPrice,
      stock: stockMap.get(itemId) ?? 0,
      uomId: baseUomId,
    } : l));
  }, [allItems, uoms, stockMap]);

  async function handleSubmit() {
    const filled = lines.filter((l) => l.itemId && parseFloat(l.qty) > 0);
    if (!filled.length) { toast.error('Add at least one material with quantity'); return; }
    if (filled.some((l) => !l.uomId)) { toast.error('Select UOM for all materials'); return; }

    try {
      await restock({
        id: batch._id,
        body: {
          restockDate: new Date().toISOString(),
          materials: filled.map((l) => ({ item: l.itemId, qty: parseFloat(l.qty), uom: l.uomId })),
          notes: notes.trim() || undefined,
        },
      }).unwrap();
      toast.success('Materials restocked to factory — stock deducted');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to restock');
    }
  }

  if (!open) return null;

  const totalCost = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * l.costPrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-label="Restock Materials"
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Send More Materials to Factory</h2>
            <p className="text-xs text-secondary mt-0.5">{batch.fbNumber} · {batch.batchName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <p className="text-xs text-secondary bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            Existing materials will have their dispatched quantity increased. New materials will be added to this batch.
            Stock will be deducted immediately.
          </p>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Materials to Send</p>
              <button
                type="button"
                onClick={() => setLines((p) => [...p, { ...EMPTY_LINE }])}
                className="h-8 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} /> Add Material
              </button>
            </div>

            <div className="space-y-1">
              <div className="hidden sm:grid grid-cols-[1fr_120px_90px_110px_36px] gap-2 px-1">
                <span className="text-[11px] font-medium text-secondary">Material</span>
                <span className="text-[11px] font-medium text-secondary">UOM</span>
                <span className="text-[11px] font-medium text-secondary">Qty</span>
                <span className="text-[11px] font-medium text-secondary text-right">Est. Cost</span>
                <span />
              </div>
              {lines.map((l, idx) => {
                const cost = (parseFloat(l.qty) || 0) * l.costPrice;
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_110px_36px] gap-2 items-start bg-white rounded-lg p-2">
                    <ItemSelect value={l.itemId} items={allItems} stockMap={stockMap} factoryStockMap={factoryStockMap} onChange={(id) => pickItem(idx, id)} />
                    <select
                      value={l.uomId}
                      onChange={(e) => setLines((p) => p.map((ml, i) => i === idx ? { ...ml, uomId: e.target.value } : ml))}
                      disabled={!l.itemId}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald disabled:bg-slate-100 disabled:text-muted"
                    >
                      <option value="">UOM…</option>
                      {uoms.map((u) => (
                        <option key={u._id} value={u._id}>{u.symbol}{u._id === l.baseUomId ? ' (base)' : ''}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={0} step="any" placeholder="Qty"
                      value={l.qty}
                      onChange={(e) => setLines((p) => p.map((ml, i) => i === idx ? { ...ml, qty: e.target.value } : ml))}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                    />
                    <div className="h-9 flex items-center justify-end px-2 rounded-md border border-border bg-white text-sm font-medium text-foreground">
                      {cost > 0 ? formatCurrency(cost) : <span className="text-muted">—</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                      className="h-9 w-9 flex items-center justify-center rounded-md text-secondary hover:bg-red-50 hover:text-red-500 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <TextareaField label="Notes" placeholder="Reason for restock…" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {totalCost > 0 && (
            <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 flex justify-between text-sm">
              <span className="text-secondary">Total Restock Cost</span>
              <span className="font-bold text-emerald">{formatCurrency(totalCost)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isLoading} className="h-10 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Send Materials to Factory
          </button>
        </div>
      </div>
    </div>
  );
}
