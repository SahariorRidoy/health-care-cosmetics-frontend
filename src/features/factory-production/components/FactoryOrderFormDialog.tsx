'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { X, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useGetItemsQuery, useGetUOMsQuery, useGetWarehousesQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { useGetUOMConversionsQuery } from '@/features/settings/services/settingsApi';
import { useCreateFactoryBatchMutation as useCreateFactoryOrderMutation, useUpdateFactoryBatchMutation as useUpdateFactoryOrderMutation } from '../services/factoryProductionApi';
import { formatCurrency } from '@/lib/formatters';
import type { FactoryOrder } from '../types';
import type { UOMConversion } from '@/features/settings/types';

interface MaterialLine {
  itemId: string;
  baseUomId: string;
  baseUomSymbol: string;
  costPrice: number;
  uomId: string;
  qty: string;
  stock: number;
}

interface ExpectedProductLine { name: string; expectedQty: string; uomId: string }

interface Props {
  open: boolean;
  onClose: () => void;
  order?: FactoryOrder | null;
}

// ── Custom material dropdown with stock + price display ──────────────────────
interface MaterialSelectProps {
  value: string;
  items: import('@/features/inventory/types').Item[];
  stockMap: Map<string, number>;
  onChange: (id: string) => void;
}

function MaterialSelect({ value, items, stockMap, onChange }: MaterialSelectProps) {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RAW_MATERIAL' | 'PACKAGING'>('ALL');
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
  const visibleItems = typeFilter === 'ALL' ? items : items.filter((i) => i.type === typeFilter);

  return (
    <div ref={ref} className="relative flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald flex items-center justify-between gap-1"
        aria-label="Select material"
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
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
            {(['ALL', 'RAW_MATERIAL', 'PACKAGING'] as const).map((t) => {
              const label = t === 'ALL' ? 'All' : t === 'RAW_MATERIAL' ? 'Raw Material' : 'Packaging';
              const count = t === 'ALL' ? items.length : items.filter((i) => i.type === t).length;
              return (
                <button key={t} type="button" onMouseDown={(e) => { e.preventDefault(); setTypeFilter(t); }}
                  className={`h-6 px-2 rounded-full text-[10px] font-medium transition-colors flex items-center gap-1 ${
                    typeFilter === t ? 'bg-emerald text-white' : 'bg-slate-100 text-secondary hover:bg-slate-200'
                  }`}>
                  {label}
                  <span className={`text-[10px] rounded-full px-1 ${typeFilter === t ? 'bg-white/20' : 'bg-slate-200 text-muted'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="px-3 py-2 text-sm text-muted hover:bg-slate-50 cursor-pointer" onMouseDown={() => { onChange(''); setOpen(false); }}>
              Select material…
            </div>
            {visibleItems.map((item) => {
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

function resolveConversionFactor(usageUomId: string, baseUomId: string, conversions: UOMConversion[]): number {
  if (usageUomId === baseUomId) return 1;
  const direct = conversions.find((c) => c.fromUOM._id === usageUomId && c.toUOM._id === baseUomId);
  if (direct) return direct.factor;
  const reverse = conversions.find((c) => c.fromUOM._id === baseUomId && c.toUOM._id === usageUomId);
  if (reverse) return 1 / reverse.factor;
  return NaN;
}

const EMPTY_MATERIAL: MaterialLine = { itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '', stock: 0 };
const EMPTY_PRODUCT: ExpectedProductLine = { name: '', expectedQty: '', uomId: '' };

export function FactoryOrderFormDialog({ open, onClose, order }: Props) {
  const isEdit = !!order;

  const { data: rawData } = useGetItemsQuery({ type: 'RAW_MATERIAL', isActive: 'true' });
  const { data: pkgData } = useGetItemsQuery({ type: 'PACKAGING', isActive: 'true' });
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: convData } = useGetUOMConversionsQuery();
  const { data: allBalancesData } = useGetStockBalancesQuery({}, { skip: !open });

  const [createOrder, { isLoading: creating }] = useCreateFactoryOrderMutation();
  const [updateOrder, { isLoading: updating }] = useUpdateFactoryOrderMutation();
  const isLoading = creating || updating;

  const allItems = useMemo(() => [...(rawData?.data?.items ?? []), ...(pkgData?.data?.items ?? [])], [rawData, pkgData]);
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  const conversions = useMemo(() => convData?.data?.conversions ?? [], [convData]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of allBalancesData?.data?.balances ?? []) {
      const itemId = typeof b.item === 'string' ? b.item : b.item._id;
      map.set(itemId, (map.get(itemId) ?? 0) + b.quantity);
    }
    return map;
  }, [allBalancesData]);

  const [orderName, setOrderName] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<MaterialLine[]>([EMPTY_MATERIAL]);
  const [expectedProducts, setExpectedProducts] = useState<ExpectedProductLine[]>([EMPTY_PRODUCT]);

  const materialsFilledRef = useRef(false);

  // Reset on open/close
  useEffect(() => {
    if (!open) { materialsFilledRef.current = false; return; }
    if (isEdit && order) {
      setOrderName(order.orderName);
      setWarehouse(typeof order.warehouse === 'string' ? order.warehouse : order.warehouse._id);
      setServiceCharge(order.serviceCharge > 0 ? String(order.serviceCharge) : '');
      setExpectedDeliveryDate(order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : '');
      setNotes(order.notes ?? '');
      materialsFilledRef.current = false;
    } else {
      setOrderName(''); setServiceCharge(''); setExpectedDeliveryDate(''); setNotes('');
      const defaultWh = warehouses.find((w) => w.isDefault);
      setWarehouse(defaultWh?._id ?? '');
      setMaterials([EMPTY_MATERIAL]);
      setExpectedProducts([EMPTY_PRODUCT]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?._id]);

  // Pre-fill materials when editing — wait for items+uoms to load
  useEffect(() => {
    if (!isEdit || !open || materialsFilledRef.current || !order) return;
    if (!allItems.length || !uoms.length) return;
    materialsFilledRef.current = true;

    const lines: MaterialLine[] = order.materials.map((m) => {
      const itemId = typeof m.item === 'string' ? m.item : m.item._id;
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

    const prods: ExpectedProductLine[] = order.expectedProducts.map((p) => ({
      name: p.name,
      expectedQty: String(p.expectedQty),
      uomId: typeof p.uom === 'string' ? p.uom : p.uom._id,
    }));
    if (prods.length) setExpectedProducts(prods);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, open, allItems.length, uoms.length]);

  // ── Material helpers ────────────────────────────────────────────────────────
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

  function compatibleUoms(baseUomId: string) {
    if (!baseUomId) return uoms;
    const related = new Set<string>([baseUomId]);
    conversions.forEach((c) => {
      if (c.fromUOM._id === baseUomId) related.add(c.toUOM._id);
      if (c.toUOM._id === baseUomId) related.add(c.fromUOM._id);
    });
    return uoms.filter((u) => related.has(u._id));
  }

  function lineCost(m: MaterialLine): { cost: number; hasConversion: boolean } {
    const qty = parseFloat(m.qty) || 0;
    if (!qty || !m.itemId) return { cost: 0, hasConversion: true };
    if (m.uomId === m.baseUomId || !m.uomId) return { cost: qty * m.costPrice, hasConversion: true };
    const factor = resolveConversionFactor(m.uomId, m.baseUomId, conversions);
    if (isNaN(factor)) return { cost: 0, hasConversion: false };
    return { cost: qty * factor * m.costPrice, hasConversion: true };
  }

  const costLines = materials.map(lineCost);
  const totalMaterialCost = costLines.reduce((s, l) => s + l.cost, 0);
  const totalEstimated = totalMaterialCost + (parseFloat(serviceCharge) || 0);
  const hasMissingConversion = costLines.some((l, i) => materials[i].itemId && materials[i].uomId !== materials[i].baseUomId && !l.hasConversion);

  function reset() {
    setOrderName(''); setWarehouse(''); setServiceCharge('');
    setExpectedDeliveryDate(''); setNotes('');
    setMaterials([EMPTY_MATERIAL]);
    setExpectedProducts([EMPTY_PRODUCT]);
    materialsFilledRef.current = false;
  }

  async function handleSave() {
    if (!orderName.trim()) { toast.error('Order name is required'); return; }
    if (!warehouse) { toast.error('Select a warehouse'); return; }

    const filledMaterials = materials.filter((m) => m.itemId && parseFloat(m.qty) > 0);
    if (!filledMaterials.length) { toast.error('Add at least one material'); return; }
    if (filledMaterials.some((m) => !m.uomId)) { toast.error('Select UOM for all materials'); return; }
    if (hasMissingConversion) { toast.error('Some materials have no UOM conversion. Add them in Settings → UOM.'); return; }

    const filledProducts = expectedProducts.filter((p) => p.name.trim() && parseFloat(p.expectedQty) > 0);
    if (!filledProducts.length) { toast.error('Add at least one expected product'); return; }
    if (filledProducts.some((p) => !p.uomId)) { toast.error('Select UOM for all expected products'); return; }

    const payload = {
      orderName: orderName.trim(),
      warehouse,
      materials: filledMaterials.map((m) => ({ item: m.itemId, qty: parseFloat(m.qty), uom: m.uomId })),
      expectedProducts: filledProducts.map((p) => ({ name: p.name.trim(), expectedQty: parseFloat(p.expectedQty), uom: p.uomId })),
      serviceCharge: parseFloat(serviceCharge) || 0,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEdit) {
        await updateOrder({ id: order._id, body: payload as never }).unwrap();
        toast.success('Factory order updated');
      } else {
        await createOrder(payload as never).unwrap();
        toast.success('Factory order created');
      }
      reset();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to save factory order');
    }
  }

  function handleClose() { reset(); onClose(); }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true"
        aria-label={isEdit ? 'Edit Factory Order' : 'New Factory Order'}
        className="relative w-full sm:max-w-3xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Factory Order' : 'New Factory Order'}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {/* Order Details */}
          <div>
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Order Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Order Name" required placeholder="e.g. June Batch 2025" value={orderName} onChange={(e) => setOrderName(e.target.value)} />
              <SelectField label="Warehouse" required value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>
              <FormField label="Expected Delivery Date" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
              <FormField label="Service Charge (৳)" type="number" min={0} step="0.01" placeholder="0.00" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} />
            </div>
            <div className="mt-4">
              <TextareaField label="Notes" placeholder="Any instructions for the factory…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Materials to Send */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Materials to Send</p>
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
                <span className="text-[11px] font-medium text-secondary">Usage UOM</span>
                <span className="text-[11px] font-medium text-secondary">Qty</span>
                <span className="text-[11px] font-medium text-secondary text-right">Line Cost</span>
                <span />
              </div>

              {materials.map((m, idx) => {
                const { cost, hasConversion } = lineCost(m);
                const compat = compatibleUoms(m.baseUomId);
                const uomMismatch = m.itemId && m.uomId && m.uomId !== m.baseUomId && !hasConversion;
                return (
                  <div key={idx}>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_110px_36px] gap-2 items-start bg-white rounded-lg p-2">
                      <MaterialSelect
                        value={m.itemId}
                        items={allItems}
                        stockMap={stockMap}
                        onChange={(id) => pickItem(idx, id)}
                      />

                      <div className="flex flex-col gap-0.5">
                        <select
                          value={m.uomId}
                          onChange={(e) => setMaterials((p) => p.map((ml, i) => i === idx ? { ...ml, uomId: e.target.value } : ml))}
                          disabled={!m.itemId}
                          className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald disabled:bg-slate-100 disabled:text-muted"
                          aria-label="Usage UOM"
                        >
                          <option value="">UOM…</option>
                          {compat.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.symbol}{u._id === m.baseUomId ? ' (base)' : ''}
                            </option>
                          ))}
                        </select>
                        {uomMismatch && (
                          <p className="text-[10px] text-red-500 leading-tight">No conversion</p>
                        )}
                      </div>

                      <input
                        type="number" min={0} step="any" placeholder="Qty"
                        value={m.qty}
                        onChange={(e) => setMaterials((p) => p.map((ml, i) => i === idx ? { ...ml, qty: e.target.value } : ml))}
                        className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                        aria-label="Quantity"
                      />

                      <div className="h-9 flex items-center justify-end px-2 rounded-md border border-border bg-white text-sm font-medium text-foreground">
                        {uomMismatch
                          ? <span className="text-red-400 text-xs">No conv.</span>
                          : cost > 0 ? formatCurrency(cost) : <span className="text-muted">—</span>
                        }
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
                    <button
                      type="button"
                      onClick={() => setMaterials((p) => [
                        ...p.slice(0, idx + 1),
                        { ...EMPTY_MATERIAL },
                        ...p.slice(idx + 1),
                      ])}
                      className="flex items-center gap-1 text-[11px] text-emerald hover:text-emerald-700 font-medium py-0.5 px-1 transition-colors"
                    >
                      <Plus size={11} /> Add material
                    </button>
                  </div>
                );
              })}
            </div>

            {hasMissingConversion && (
              <p className="mt-2 text-xs text-red-500">
                ⚠ Some materials have no UOM conversion. Go to Settings → UOM → Conversions to add them.
              </p>
            )}
          </div>

          {/* Expected Products */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Expected Products from Factory</p>
              <button
                type="button"
                onClick={() => setExpectedProducts((p) => [...p, { ...EMPTY_PRODUCT }])}
                className="h-8 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} /> Add Product
              </button>
            </div>
            <div className="space-y-1">
              <div className="hidden sm:grid grid-cols-[1fr_130px_90px_36px] gap-2 px-1">
                <span className="text-[11px] font-medium text-secondary">Product Name</span>
                <span className="text-[11px] font-medium text-secondary">UOM</span>
                <span className="text-[11px] font-medium text-secondary">Expected Qty</span>
                <span />
              </div>
              {expectedProducts.map((p, idx) => (
                <div key={idx}>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_90px_36px] gap-2 items-center bg-white rounded-lg p-2">
                    <input
                      type="text" placeholder="e.g. Whitening Cream 100ml"
                      value={p.name}
                      onChange={(e) => setExpectedProducts((prev) => prev.map((ep, i) => i === idx ? { ...ep, name: e.target.value } : ep))}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                      aria-label="Product name"
                    />
                    <select
                      value={p.uomId}
                      onChange={(e) => setExpectedProducts((prev) => prev.map((ep, i) => i === idx ? { ...ep, uomId: e.target.value } : ep))}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                      aria-label="UOM"
                    >
                      <option value="">UOM…</option>
                      {uoms.map((u) => <option key={u._id} value={u._id}>{u.symbol}</option>)}
                    </select>
                    <input
                      type="number" min={0} step="any" placeholder="Qty"
                      value={p.expectedQty}
                      onChange={(e) => setExpectedProducts((prev) => prev.map((ep, i) => i === idx ? { ...ep, expectedQty: e.target.value } : ep))}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                      aria-label="Expected quantity"
                    />
                    <button
                      type="button"
                      onClick={() => setExpectedProducts((prev) => prev.filter((_, i) => i !== idx))}
                      className="h-9 w-9 flex items-center justify-center rounded-md text-secondary hover:bg-red-50 hover:text-red-500 transition-colors"
                      aria-label="Remove product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpectedProducts((prev) => [
                      ...prev.slice(0, idx + 1),
                      { ...EMPTY_PRODUCT },
                      ...prev.slice(idx + 1),
                    ])}
                    className="flex items-center gap-1 text-[11px] text-emerald hover:text-emerald-700 font-medium py-0.5 px-1 transition-colors"
                  >
                    <Plus size={11} /> Add product
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Summary */}
          <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-2">Estimated Cost Summary</p>
            <div className="space-y-1.5 max-w-sm ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Total Material Cost</span>
                <span className="font-medium">{formatCurrency(totalMaterialCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Service Charge</span>
                <span className="font-medium">{formatCurrency(parseFloat(serviceCharge) || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="font-semibold text-foreground">Total Estimated Cost</span>
                <span className="font-bold text-emerald">{formatCurrency(totalEstimated)}</span>
              </div>
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
            {isEdit ? 'Save Changes' : 'Create Factory Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
