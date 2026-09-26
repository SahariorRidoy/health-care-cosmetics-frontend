'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { X, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { useGetItemsQuery, useGetUOMsQuery, useGetWarehousesQuery, useGenerateSkuQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { useGetUOMConversionsQuery } from '@/features/settings/services/settingsApi';
import { useGetProductsQuery, useUpdateProductMutation } from '@/features/products/services/productsApi';
import { useCreateProductionBatchMutation } from '@/features/production/services/productionApi';
import type { Product } from '@/features/products/types';
import type { UOMConversion } from '@/features/settings/types';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';

interface MaterialLine {
  itemId: string;
  baseUomId: string;
  baseUomSymbol: string;
  costPrice: number;
  uomId: string;
  qty: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

// ── Custom material select with colored stock + price ────────────────────────
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
        <div className="absolute top-full left-0 z-50 mt-1 w-max min-w-full rounded-md border border-border bg-white shadow-lg max-h-56 overflow-y-auto">
          <div
            className="px-3 py-2 text-sm text-muted hover:bg-slate-50 cursor-pointer"
            onMouseDown={() => { onChange(''); setOpen(false); }}
          >
            Select material…
          </div>
          {items.map((item) => {
            const stock = stockMap.get(item._id) ?? 0;
            const uomSymbol = typeof item.baseUom === 'object' ? item.baseUom.symbol : '';
            return (
              <div
                key={item._id}
                onMouseDown={() => { onChange(item._id); setOpen(false); }}
                className={`px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center gap-4 ${
                  item._id === value ? 'bg-emerald-50' : ''
                }`}
              >
                <span className="text-sm text-foreground whitespace-nowrap">{item.name}</span>
                <span className="ml-auto shrink-0 flex items-center gap-2 text-[11px]">
                  <span className={stock <= 0 ? 'text-red-500 font-medium' : 'text-blue-600 font-medium'}>
                    {stock} {uomSymbol}
                  </span>
                  <span className="text-amber-600 font-medium">{formatCurrency(item.costPrice)}/{uomSymbol}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function resolveConversionFactor(
  usageUomId: string,
  baseUomId: string,
  conversions: UOMConversion[],
): number {
  if (usageUomId === baseUomId) return 1;
  const direct = conversions.find(
    (c) => c.fromUOM._id === usageUomId && c.toUOM._id === baseUomId,
  );
  if (direct) return direct.factor;
  const reverse = conversions.find(
    (c) => c.fromUOM._id === baseUomId && c.toUOM._id === usageUomId,
  );
  if (reverse) return 1 / reverse.factor;
  return NaN;
}

export function ProductionFormDialog({ open, onClose, product }: Props) {
  const isEdit = !!product;
  const [productionMode, setProductionMode] = useState<'new' | 'existing'>('new');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { data: rawData } = useGetItemsQuery({ type: 'RAW_MATERIAL', isActive: 'true' });
  const { data: pkgData } = useGetItemsQuery({ type: 'PACKAGING', isActive: 'true' });
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: convData } = useGetUOMConversionsQuery();
  const { data: productsData, isLoading: productsLoading } = useGetProductsQuery(
    { page: 1, search: productSearch || undefined, isActive: 'true' },
    { skip: isEdit || !open || productionMode !== 'existing' },
  );
  const [createProductionBatch, { isLoading: creating }] = useCreateProductionBatchMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const isLoading = creating || updating;

  const { data: balancesData } = useGetStockBalancesQuery(
    { item: product?._id },
    { skip: !isEdit || !open },
  );

  // fetch all stock balances to show remaining stock in material dropdown
  const { data: allBalancesData } = useGetStockBalancesQuery(
    {},
    { skip: !open },
  );

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of allBalancesData?.data?.balances ?? []) {
      const itemId = typeof b.item === 'string' ? b.item : b.item._id;
      map.set(itemId, (map.get(itemId) ?? 0) + b.quantity);
    }
    return map;
  }, [allBalancesData]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [skuName, setSkuName] = useState('');
  const { data: skuData } = useGenerateSkuQuery(skuName, { skip: isEdit || skuName.trim().length < 2 });
  const [outputUom, setOutputUom] = useState('');
  const [outputQty, setOutputQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<MaterialLine[]>([{ itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);

  const materialsFilledRef = useRef(false);

  const allItems = useMemo(() => [...(rawData?.data?.items ?? []), ...(pkgData?.data?.items ?? [])], [rawData, pkgData]);
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);
  const conversions = useMemo(() => convData?.data?.conversions ?? [], [convData]);
  const warehouses = useMemo(() => warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [], [warehouseData]);

  useEffect(() => {
    if (!isEdit && productionMode === 'new' && skuData?.data?.sku) setSku(skuData.data.sku);
  }, [skuData, isEdit, productionMode]);

  // reset form fields when dialog opens/closes or product changes
  useEffect(() => {
    if (!open) { materialsFilledRef.current = false; return; }
    setProductionMode('new');
    setProductSearch('');
    setSelectedProductId('');
    setSelectedProduct(null);
    setName(product?.name ?? '');
    setSku(product?.sku ?? '');
    setOutputUom(product ? (typeof product.baseUom === 'string' ? product.baseUom : (product.baseUom?._id ?? '')) : '');
    setSalePrice(product?.salePrice ? String(product.salePrice) : '');
    setOutputQty(product?.currentStock != null ? String(product.currentStock) : '');
    setReorderLevel(product?.reorderLevel != null ? String(product.reorderLevel) : '');
    materialsFilledRef.current = false;
    if (!isEdit) {
      const defaultWh = warehouseData?.data?.warehouses?.find((w) => w.isActive && w.isDefault);
      setWarehouse(defaultWh?._id ?? '');
      setMaterials([{ itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?._id]);

  useEffect(() => {
    if (!open || isEdit || warehouse) return;
    const defaultWh = warehouses.find((item) => item.isDefault);
    if (defaultWh) setWarehouse(defaultWh._id);
  }, [open, isEdit, warehouse, warehouses]);

  // pre-fill warehouse from first stock balance
  useEffect(() => {
    if (!isEdit || !open) return;
    const balances = balancesData?.data?.balances ?? [];
    if (balances.length > 0) {
      const wh = balances[0].warehouse;
      setWarehouse(typeof wh === 'string' ? wh : wh._id ?? '');
    }
  }, [balancesData, isEdit, open]);

  // pre-fill materials from product.materials — only once per open, wait for allItems+uoms to load
  useEffect(() => {
    if (!isEdit || !open || materialsFilledRef.current) return;
    if (!allItems.length || !uoms.length) return;
    const productMaterials = product?.materials ?? [];
    if (productMaterials.length === 0) return;

    materialsFilledRef.current = true;

    const lines: MaterialLine[] = productMaterials.map((mat) => {
      const itemId = typeof mat.item === 'string' ? mat.item : mat.item._id;
      const uomId = typeof mat.uom === 'string' ? mat.uom : mat.uom._id;
      const foundItem = allItems.find((i) => i._id === itemId);
      const baseUomObj = foundItem
        ? (typeof foundItem.baseUom === 'object' ? foundItem.baseUom : uoms.find((u) => u._id === foundItem.baseUom))
        : null;
      const baseUomId = baseUomObj?._id ?? uomId;
      return {
        itemId,
        baseUomId,
        baseUomSymbol: baseUomObj?.symbol ?? '',
        costPrice: foundItem?.costPrice ?? 0,
        uomId,
        qty: String(mat.qty),
      };
    }).filter((l) => l.itemId);

    setMaterials(lines.length > 0 ? lines : [{ itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.materials, allItems.length, uoms.length, isEdit, open]);

  const addMaterial = useCallback(() => {
    setMaterials((p) => [...p, { itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);
  }, []);

  const removeMaterial = useCallback((idx: number) => {
    setMaterials((p) => p.filter((_, i) => i !== idx));
  }, []);

  const pickItem = useCallback(
    (idx: number, itemId: string) => {
      const item = allItems.find((i) => i._id === itemId);
      if (!item) return;
      const baseUomObj = typeof item.baseUom === 'object' ? item.baseUom : uoms.find((u) => u._id === item.baseUom);
      const baseUomId = baseUomObj?._id ?? (typeof item.baseUom === 'string' ? item.baseUom : '');
      setMaterials((p) =>
        p.map((m, i) =>
          i === idx
            ? { ...m, itemId, baseUomId, baseUomSymbol: baseUomObj?.symbol ?? '', costPrice: item.costPrice, uomId: baseUomId }
            : m,
        ),
      );
    },
    [allItems, uoms],
  );

  const setUom = useCallback((idx: number, uomId: string) => {
    setMaterials((p) => p.map((m, i) => (i === idx ? { ...m, uomId } : m)));
  }, []);

  const setQty = useCallback((idx: number, qty: string) => {
    setMaterials((p) => p.map((m, i) => (i === idx ? { ...m, qty } : m)));
  }, []);

  function lineCostInBaseUom(m: MaterialLine): { cost: number; baseQty: number; hasConversion: boolean } {
    const qty = parseFloat(m.qty) || 0;
    if (!qty || !m.itemId) return { cost: 0, baseQty: 0, hasConversion: true };
    if (m.uomId === m.baseUomId || !m.uomId) {
      return { cost: qty * m.costPrice, baseQty: qty, hasConversion: true };
    }
    const factor = resolveConversionFactor(m.uomId, m.baseUomId, conversions);
    if (isNaN(factor)) return { cost: 0, baseQty: 0, hasConversion: false };
    const baseQty = qty * factor;
    return { cost: baseQty * m.costPrice, baseQty, hasConversion: true };
  }

  const costLines = materials.map(lineCostInBaseUom);
  const totalCost = costLines.reduce((s, l) => s + l.cost, 0);
  const outQty = parseFloat(outputQty) || 0;
  const costPerUnit = outQty > 0 ? totalCost / outQty : 0;
  const outputUomSymbol = uoms.find((u) => u._id === outputUom)?.symbol ?? '';
  const hasMissingConversion = costLines.some((l, i) => materials[i].itemId && materials[i].uomId !== materials[i].baseUomId && !l.hasConversion);

  function compatibleUoms(baseUomId: string) {
    if (!baseUomId) return uoms;
    const related = new Set<string>([baseUomId]);
    conversions.forEach((c) => {
      if (c.fromUOM._id === baseUomId) related.add(c.toUOM._id);
      if (c.toUOM._id === baseUomId) related.add(c.fromUOM._id);
    });
    return uoms.filter((u) => related.has(u._id));
  }

  function reset() {
    setProductionMode('new'); setProductSearch(''); setSelectedProductId(''); setSelectedProduct(null);
    setName(''); setSku(''); setSkuName(''); setOutputUom('');
    setOutputQty(''); setSalePrice(''); setReorderLevel(''); setWarehouse('');
    setNotes('');
    setMaterials([{ itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);
  }

  function selectExistingProduct(productId: string) {
    const selected = productsData?.data.items.find((item) => item._id === productId) ?? null;
    setSelectedProductId(productId);
    setSelectedProduct(selected);
    if (!selected) return;
    setName(selected.name);
    setSku(selected.sku);
    setOutputUom(typeof selected.baseUom === 'string' ? selected.baseUom : selected.baseUom._id);
    setSalePrice(selected.salePrice ? String(selected.salePrice) : '');
    setReorderLevel(String(selected.reorderLevel ?? 0));
  }

  async function handleSave() {
    if ((!isEdit && productionMode === 'existing' && (!selectedProductId || !selectedProduct)) ||
      (!isEdit && productionMode === 'new' && (!name.trim() || !sku.trim() || !outputUom)) ||
      (isEdit && (!name.trim() || !sku.trim() || !outputUom))) {
      toast.error('Fill in all required product fields');
      return;
    }
    if (outQty <= 0) { toast.error('Output qty is required'); return; }
    if ((isEdit || productionMode === 'new') && !(parseFloat(salePrice) > 0)) { toast.error('Sale price is required'); return; }
    if (!warehouse) { toast.error('Select a warehouse'); return; }
    if (materials.every((m) => !m.itemId)) { toast.error('Add at least one input material'); return; }
    if (materials.some((m) => m.itemId && !(parseFloat(m.qty) > 0))) {
      toast.error('Each material needs a quantity');
      return;
    }
    if (hasMissingConversion) {
      toast.error('Some materials have no UOM conversion defined. Add conversions in Settings → UOM.');
      return;
    }
    const filledMaterials = materials
      .filter((m) => m.itemId && parseFloat(m.qty) > 0)
      .map((m) => ({ item: m.itemId, qty: parseFloat(m.qty), uom: m.uomId || m.baseUomId, warehouse }));

    try {
      const costPrice = costPerUnit > 0 ? costPerUnit : undefined;
      if (isEdit) {
        await updateProduct({
          id: product._id,
          body: {
            name: name.trim(),
            sku: sku.trim(),
            baseUom: outputUom,
            costPrice: costPrice ?? product.costPrice,
            salePrice: parseFloat(salePrice) || undefined,
            reorderLevel: parseInt(reorderLevel) >= 0 ? parseInt(reorderLevel) : undefined,
            quantity: outQty,
            warehouse,
            materials: filledMaterials,
          },
        }).unwrap();
        toast.success('Product updated');
      } else {
        const result = await createProductionBatch({
          ...(productionMode === 'existing'
            ? { productId: selectedProductId }
            : {
                newProduct: {
                  name: name.trim(),
                  sku: sku.trim(),
                  baseUom: outputUom,
                  reorderLevel: parseInt(reorderLevel) >= 0 ? parseInt(reorderLevel) : 0,
                  salePrice: parseFloat(salePrice),
                },
              }),
          warehouse,
          quantityProduced: outQty,
          materials: filledMaterials.map(({ item, qty, uom }) => ({ item, qty, uom })),
          notes: notes.trim() || undefined,
        }).unwrap();
        toast.success(`Production batch ${result.data.batch.batchNumber} recorded`);
      }
      reset();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to save product');
    }
  }

  function handleClose() { reset(); onClose(); }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit Product' : 'New Production'}
        className="relative w-full sm:max-w-3xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Product' : 'New Production'}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {/* Product details */}
          <div>
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Product Details</p>
            {!isEdit && (
              <div className="flex gap-1 mb-4" role="group" aria-label="Production product mode">
                <button
                  type="button"
                  onClick={() => {
                    if (productionMode === 'existing') {
                      setSelectedProductId('');
                      setSelectedProduct(null);
                      setName('');
                      setSku('');
                      setSkuName('');
                      setOutputUom('');
                      setSalePrice('');
                      setReorderLevel('');
                    }
                    setProductionMode('new');
                  }}
                  className={`h-8 px-3 rounded-md text-sm font-medium ${productionMode === 'new' ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-100'}`}
                >
                  New product
                </button>
                <button
                  type="button"
                  onClick={() => setProductionMode('existing')}
                  className={`h-8 px-3 rounded-md text-sm font-medium ${productionMode === 'existing' ? 'bg-emerald text-white' : 'text-secondary hover:bg-slate-100'}`}
                >
                  Existing product
                </button>
              </div>
            )}
            {!isEdit && productionMode === 'existing' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Search product by name or SKU"
                  placeholder="Type a product name or SKU…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <SelectField label="Finished Product" required value={selectedProductId} onChange={(e) => selectExistingProduct(e.target.value)}>
                  <option value="">{productsLoading ? 'Loading products…' : 'Select product…'}</option>
                  {(productsData?.data.items ?? []).map((item) => (
                    <option key={item._id} value={item._id}>{item.name} · {item.sku}</option>
                  ))}
                </SelectField>
                {selectedProduct && (
                  <p className="sm:col-span-2 text-xs text-secondary">
                    Selected: <span className="font-semibold text-foreground">{selectedProduct.name}</span>
                    {' · SKU '}{selectedProduct.sku}
                    {' · Current stock '}{selectedProduct.currentStock}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Product Name" required placeholder="e.g. Aloe Vera Cream 200ml"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEdit) {
                    clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer);
                    (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer = setTimeout(() => setSkuName(e.target.value), 500);
                  }
                }}
              />
              <FormField label="SKU" required={isEdit} placeholder={isEdit ? '' : 'Auto-generated'} value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
            )}
          </div>

          {/* Input materials */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Input Materials</p>
              <button
                type="button"
                onClick={addMaterial}
                className="h-8 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} /> Add Material
              </button>
            </div>

            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_120px_90px_110px_36px] gap-2 px-1">
                <span className="text-[11px] font-medium text-secondary">Material</span>
                <span className="text-[11px] font-medium text-secondary">Usage UOM</span>
                <span className="text-[11px] font-medium text-secondary">Qty</span>
                <span className="text-[11px] font-medium text-secondary text-right">Line Cost</span>
                <span />
              </div>

              {materials.map((m, idx) => {
                const { cost: lineCost, hasConversion } = lineCostInBaseUom(m);
                const compat = compatibleUoms(m.baseUomId);
                const uomMismatch = m.itemId && m.uomId && m.uomId !== m.baseUomId && !hasConversion;
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_110px_36px] gap-2 items-start bg-white rounded-lg p-2">
                    <MaterialSelect
                      value={m.itemId}
                      items={allItems}
                      stockMap={stockMap}
                      onChange={(id) => pickItem(idx, id)}
                    />

                    <div className="flex flex-col gap-0.5">
                      <select
                        value={m.uomId}
                        onChange={(e) => setUom(idx, e.target.value)}
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
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Qty"
                      value={m.qty}
                      onChange={(e) => setQty(idx, e.target.value)}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                      aria-label="Quantity"
                    />

                    <div className="h-9 flex items-center justify-end px-2 rounded-md border border-border bg-white text-sm font-medium text-foreground">
                      {uomMismatch
                        ? <span className="text-red-400 text-xs">No conv.</span>
                        : lineCost > 0 ? formatCurrency(lineCost) : <span className="text-muted">—</span>
                      }
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMaterial(idx)}
                      className="h-9 w-9 flex items-center justify-center rounded-md text-secondary hover:bg-red-50 hover:text-red-500 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
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

          {/* Output */}
          <div>
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Output</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SelectField label="Output UOM" required value={outputUom} disabled={!isEdit && productionMode === 'existing'} onChange={(e) => setOutputUom(e.target.value)}>
                <option value="">Select UOM…</option>
                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
              </SelectField>
              <FormField label="Output Qty Produced" required type="number" min={0} step="any" placeholder="e.g. 100" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} />
              <SelectField label="Warehouse" required value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>
              {isEdit || productionMode === 'new' ? (
                <FormField label="Low Stock Qty" type="number" min={0} step="1" placeholder="e.g. 10" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secondary">Low Stock Qty</span>
                  <p className="h-10 flex items-center text-sm text-foreground">{selectedProduct?.reorderLevel ?? 0}</p>
                </div>
              )}
              {!isEdit && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <TextareaField label="Batch Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Cost summary */}
          <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 space-y-1.5">
            <div className="flex justify-end">
              <div className="flex flex-col space-y-1.5 w-full max-w-sm">
                <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-2">Cost Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Total Raw Material Cost</span>
                  <span className="font-medium text-foreground">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Output Qty</span>
                  <span className="font-medium text-foreground">
                    {outQty > 0 ? `${outQty} ${outputUomSymbol}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="text-sm font-semibold text-foreground">Production Cost / {outputUomSymbol || 'unit'}</span>
                  <span className="text-base font-bold text-emerald">
                    {costPerUnit > 0 ? formatCurrency(costPerUnit) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="text-sm font-semibold text-violet-600">Sale Price (৳)</span>
                  {isEdit || productionMode === 'new' ? <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 150"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-28 h-8 rounded-md border border-green-300 bg-violet-green px-2 text-sm font-semibold text-green-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                  /> : <span className="text-sm font-semibold text-green-700">{selectedProduct?.salePrice ? formatCurrency(selectedProduct.salePrice) : '—'}</span>}
                </div>
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
            {isEdit ? 'Save Changes' : 'Record Production Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}
