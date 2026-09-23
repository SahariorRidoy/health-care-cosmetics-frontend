'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { X, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useGetItemsQuery, useGetUOMsQuery, useGetWarehousesQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { useCreateFactoryBatchMutation, useUpdateFactoryBatchMutation } from '../services/factoryProductionApi';
import { formatCurrency } from '@/lib/formatters';
import type { FactoryBatch } from '../types';

interface MaterialLine {
  itemId: string;
  baseUomId: string;
  baseUomSymbol: string;
  costPrice: number;
  uomId: string;
  qty: string;
  stock: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  batch?: FactoryBatch | null;
}

// ── Material dropdown ─────────────────────────────────────────────────────────
interface MaterialSelectProps {
  value: string;
  items: import('@/features/inventory/types').Item[];
  stockMap: Map<string, number>;
  onChange: (id: string) => void;
}

function MaterialSelect({ value, items, stockMap, onChange }: MaterialSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = items.find((i) => i._id === value);
  const selectedStock = value ? (stockMap.get(value) ?? 0) : null;
  const selectedUom = selected ? (typeof selected.baseUom === 'object' ? selected.baseUom.symbol : '') : '';

  return (
    <div ref={ref} className="relative flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald flex items-center justify-between gap-1"
      >
        <span className="truncate">{selected ? selected.name : <span className="text-muted">Select material…</span>}</span>
        <ChevronDown size={14} className="shrink-0 text-secondary" />
      </button>
      {selectedStock !== null && (
        <p className={`text-[10px] leading-tight font-medium ${selectedStock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
          Stock: {selectedStock} {selectedUom}
        </p>
      )}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-max min-w-full rounded-md border border-border bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            <div className="px-3 py-2 text-sm text-muted hover:bg-slate-50 cursor-pointer" onMouseDown={() => { onChange(''); setOpen(false); }}>
              Select material…
            </div>
            {items.map((item) => {
              const stock = stockMap.get(item._id) ?? 0;
              const uomSymbol = typeof item.baseUom === 'object' ? item.baseUom.symbol : '';
              return (
                <div
                  key={item._id}
                  onMouseDown={() => { onChange(item._id); setOpen(false); }}
                  className={`px-3 py-2 cursor-pointer hover:bg-slate-50 grid grid-cols-[1fr_80px_80px_60px] items-center gap-3 ${item._id === value ? 'bg-emerald-50' : ''}`}
                >
                  <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                  <span className={`text-xs font-bold text-right ${stock <= 0 ? 'text-red-500' : 'text-blue-600'}`}>{stock}</span>
                  <span className="text-xs font-bold text-amber-600 text-right">{formatCurrency(item.costPrice)}</span>
                  <span className="text-xs font-bold text-secondary text-right">{uomSymbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_MATERIAL: MaterialLine = { itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '', stock: 0 };

export function FactoryBatchFormDialog({ open, onClose, batch }: Props) {
  const isEdit = !!batch;

  const { data: rawData } = useGetItemsQuery({ type: 'RAW_MATERIAL', isActive: 'true' });
  const { data: pkgData } = useGetItemsQuery({ type: 'PACKAGING', isActive: 'true' });
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: allBalancesData } = useGetStockBalancesQuery({}, { skip: !open });

  const [createBatch, { isLoading: creating }] = useCreateFactoryBatchMutation();
  const [updateBatch, { isLoading: updating }] = useUpdateFactoryBatchMutation();
  const isLoading = creating || updating;

  const allItems = useMemo(() => [...(rawData?.data?.items ?? []), ...(pkgData?.data?.items ?? [])], [rawData, pkgData]);
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of allBalancesData?.data?.balances ?? []) {
      const itemId = typeof b.item === 'string' ? b.item : b.item._id;
      map.set(itemId, (map.get(itemId) ?? 0) + b.quantity);
    }
    return map;
  }, [allBalancesData]);

  const [batchName, setBatchName] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [materials, setMaterials] = useState<MaterialLine[]>([EMPTY_MATERIAL]);
  const filledRef = useRef(false);

  useEffect(() => {
    if (!open) { filledRef.current = false; return; }
    if (isEdit && batch) {
      setBatchName(batch.batchName);
      setWarehouse(typeof batch.warehouse === 'string' ? batch.warehouse : batch.warehouse._id);
      setExpectedDeliveryDate(batch.expectedDeliveryDate ? batch.expectedDeliveryDate.slice(0, 10) : '');
      setNotes(batch.notes ?? '');
      setDispatchNotes(batch.dispatch.notes ?? '');
      filledRef.current = false;
    } else {
      setBatchName(''); setExpectedDeliveryDate(''); setNotes(''); setDispatchNotes('');
      const defaultWh = warehouses.find((w) => w.isDefault);
      setWarehouse(defaultWh?._id ?? '');
      setMaterials([EMPTY_MATERIAL]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batch?._id]);

  // Pre-fill materials when editing
  useEffect(() => {
    if (!isEdit || !open || filledRef.current || !batch) return;
    if (!allItems.length || !uoms.length) return;
    filledRef.current = true;

    const lines: MaterialLine[] = batch.dispatch.materials.map((m) => {
      const itemId = typeof m.item === 'string' ? m.item : (m.item as { _id: string })._id;
      const uomId = typeof m.uom === 'string' ? m.uom : m.uom._id;
      const foundItem = allItems.find((i) => i._id === itemId);
      const baseUomObj = foundItem
        ? (typeof foundItem.baseUom === 'object' ? foundItem.baseUom : uoms.find((u) => u._id === foundItem.baseUom))
        : null;
      return {
        itemId,
        baseUomId: baseUomObj?._id ?? uomId,
        baseUomSymbol: baseUomObj?.symbol ?? '',
        costPrice: foundItem?.costPrice ?? 0,
        uomId,
        qty: String(m.qty),
        stock: stockMap.get(itemId) ?? 0,
      };
    }).filter((l) => l.itemId);

    setMaterials(lines.length > 0 ? lines : [EMPTY_MATERIAL]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, open, allItems.length, uoms.length]);

  const pickItem = useCallback((idx: number, itemId: string) => {
    const item = allItems.find((i) => i._id === itemId);
    if (!item) {
      setMaterials((p) => p.map((m, i) => i === idx ? { ...EMPTY_MATERIAL } : m));
      return;
    }
    const baseUomObj = typeof item.baseUom === 'object' ? item.baseUom : uoms.find((u) => u._id === item.baseUom);
    const baseUomId = baseUomObj?._id ?? (typeof item.baseUom === 'string' ? item.baseUom : '');
    setMaterials((p) => p.map((m, i) => i === idx ? {
      ...m, itemId, baseUomId,
      baseUomSymbol: baseUomObj?.symbol ?? '',
      costPrice: item.costPrice,
      stock: stockMap.get(itemId) ?? 0,
      uomId: baseUomId,
    } : m));
  }, [allItems, uoms, stockMap]);

  const totalMaterialCost = materials.reduce((s, m) => {
    const qty = parseFloat(m.qty) || 0;
    return s + qty * m.costPrice;
  }, 0);

  function reset() {
    setBatchName(''); setWarehouse(''); setExpectedDeliveryDate('');
    setNotes(''); setDispatchNotes('');
    setMaterials([EMPTY_MATERIAL]);
    filledRef.current = false;
  }

  async function handleSave() {
    if (!batchName.trim()) { toast.error('Batch name is required'); return; }
    if (!warehouse) { toast.error('Select a warehouse'); return; }

    const filledMaterials = materials.filter((m) => m.itemId && parseFloat(m.qty) > 0);
    if (!filledMaterials.length) { toast.error('Add at least one material'); return; }
    if (filledMaterials.some((m) => !m.uomId)) { toast.error('Select UOM for all materials'); return; }

    const payload = {
      batchName: batchName.trim(),
      warehouse,
      dispatch: {
        materials: filledMaterials.map((m) => ({ item: m.itemId, qty: parseFloat(m.qty), uom: m.uomId })),
        notes: dispatchNotes.trim() || undefined,
      },
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEdit) {
        await updateBatch({ id: batch._id, body: payload }).unwrap();
        toast.success('Factory batch updated');
      } else {
        await createBatch(payload).unwrap();
        toast.success('Factory batch created');
      }
      reset();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to save factory batch');
    }
  }

  function handleClose() { reset(); onClose(); }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true"
        aria-label={isEdit ? 'Edit Factory Batch' : 'New Factory Batch'}
        className="relative w-full sm:max-w-3xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Factory Batch' : 'New Factory Batch'}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {/* Batch Details */}
          <div>
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Batch Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Batch Name" required placeholder="e.g. June 2025 Cream Batch" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
              <SelectField label="Warehouse" required value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>
              <FormField label="Expected Delivery Date" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
            </div>
            <div className="mt-4">
              <TextareaField label="Notes" placeholder="Any notes about this batch…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Materials to Dispatch */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Materials to Dispatch</p>
              <button
                type="button"
                onClick={() => setMaterials((p) => [...p, { ...EMPTY_MATERIAL }])}
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

              {materials.map((m, idx) => {
                const qty = parseFloat(m.qty) || 0;
                const cost = qty * m.costPrice;
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_110px_36px] gap-2 items-start bg-white rounded-lg p-2">
                    <MaterialSelect value={m.itemId} items={allItems} stockMap={stockMap} onChange={(id) => pickItem(idx, id)} />

                    <select
                      value={m.uomId}
                      onChange={(e) => setMaterials((p) => p.map((ml, i) => i === idx ? { ...ml, uomId: e.target.value } : ml))}
                      disabled={!m.itemId}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald disabled:bg-slate-100 disabled:text-muted"
                    >
                      <option value="">UOM…</option>
                      {uoms.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.symbol}{u._id === m.baseUomId ? ' (base)' : ''}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number" min={0} step="any" placeholder="Qty"
                      value={m.qty}
                      onChange={(e) => setMaterials((p) => p.map((ml, i) => i === idx ? { ...ml, qty: e.target.value } : ml))}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                    />

                    <div className="h-9 flex items-center justify-end px-2 rounded-md border border-border bg-white text-sm font-medium text-foreground">
                      {cost > 0 ? formatCurrency(cost) : <span className="text-muted">—</span>}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMaterials((p) => p.filter((_, i) => i !== idx))}
                      className="h-9 w-9 flex items-center justify-center rounded-md text-secondary hover:bg-red-50 hover:text-red-500 transition-colors"
                      aria-label="Remove material"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3">
              <TextareaField label="Dispatch Notes" placeholder="Any notes for this dispatch…" value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} />
            </div>
          </div>

          {/* Cost Summary */}
          <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-2">Estimated Dispatch Cost</p>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Total Material Value</span>
              <span className="font-bold text-emerald">{formatCurrency(totalMaterialCost)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={handleClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}
