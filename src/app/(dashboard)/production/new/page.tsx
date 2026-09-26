'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';
import { useGetItemsQuery, useGetUOMsQuery, useGetWarehousesQuery, useGenerateSkuQuery, useGetStockBalancesQuery } from '@/features/inventory/services/inventoryApi';
import { useGetUOMConversionsQuery } from '@/features/settings/services/settingsApi';
import { useGetProductsQuery } from '@/features/products/services/productsApi';
import { useCreateProductionBatchMutation } from '@/features/production/services/productionApi';
import type { Product } from '@/features/products/types';
import type { UOMConversion } from '@/features/settings/types';
import type { Item } from '@/features/inventory/types';

interface MaterialLine {
  itemId: string;
  baseUomId: string;
  baseUomSymbol: string;
  costPrice: number;
  uomId: string;
  qty: string;
}

// ── Material select with stock + price ──────────────────────────────────────
function MaterialSelect({ value, items, stockMap, onChange }: {
  value: string;
  items: Item[];
  stockMap: Map<string, number>;
  onChange: (id: string) => void;
}) {
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
          <div className="max-h-72 overflow-y-auto">
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

export default function NewProductionPage() {
  const router = useRouter();
  const [productionMode, setProductionMode] = useState<'new' | 'existing'>('new');
  const [productSearch, setProductSearch] = useState('');
  const { data: rawData } = useGetItemsQuery({ type: 'RAW_MATERIAL', isActive: 'true' });
  const { data: pkgData } = useGetItemsQuery({ type: 'PACKAGING', isActive: 'true' });
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: convData } = useGetUOMConversionsQuery();
  const { data: allBalancesData } = useGetStockBalancesQuery({});
  const { data: productsData, isLoading: productsLoading } = useGetProductsQuery(
    { page: 1, search: productSearch || undefined, isActive: 'true' },
    { skip: productionMode !== 'existing' },
  );
  const [createProductionBatch, { isLoading }] = useCreateProductionBatchMutation();

  const allItems = useMemo(() => [...(rawData?.data?.items ?? []), ...(pkgData?.data?.items ?? [])], [rawData, pkgData]);
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);
  const conversions = useMemo(() => convData?.data?.conversions ?? [], [convData]);
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];

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
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { data: skuData } = useGenerateSkuQuery(skuName, { skip: skuName.trim().length < 2 });
  const [outputUom, setOutputUom] = useState('');
  const [outputQty, setOutputQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<MaterialLine[]>([{ itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);

  useEffect(() => {
    if (productionMode === 'new' && skuData?.data?.sku) setSku(skuData.data.sku);
  }, [skuData, productionMode]);

  useEffect(() => {
    const defaultWh = warehouseData?.data?.warehouses?.find((w) => w.isActive && w.isDefault);
    if (defaultWh) setWarehouse(defaultWh._id);
  }, [warehouseData]);

  const addMaterial = useCallback(() => {
    setMaterials((p) => [...p, { itemId: '', baseUomId: '', baseUomSymbol: '', costPrice: 0, uomId: '', qty: '' }]);
  }, []);

  const removeMaterial = useCallback((idx: number) => {
    setMaterials((p) => p.filter((_, i) => i !== idx));
  }, []);

  const pickItem = useCallback((idx: number, itemId: string) => {
    const item = allItems.find((i) => i._id === itemId);
    if (!item) return;
    const baseUomObj = typeof item.baseUom === 'object' ? item.baseUom : uoms.find((u) => u._id === item.baseUom);
    const baseUomId = baseUomObj?._id ?? (typeof item.baseUom === 'string' ? item.baseUom : '');
    setMaterials((p) => p.map((m, i) => i === idx ? { ...m, itemId, baseUomId, baseUomSymbol: baseUomObj?.symbol ?? '', costPrice: item.costPrice, uomId: baseUomId } : m));
  }, [allItems, uoms]);

  const setUom = useCallback((idx: number, uomId: string) => {
    setMaterials((p) => p.map((m, i) => (i === idx ? { ...m, uomId } : m)));
  }, []);

  const setQty = useCallback((idx: number, qty: string) => {
    setMaterials((p) => p.map((m, i) => (i === idx ? { ...m, qty } : m)));
  }, []);

  function lineCostInBaseUom(m: MaterialLine) {
    const qty = parseFloat(m.qty) || 0;
    if (!qty || !m.itemId) return { cost: 0, baseQty: 0, hasConversion: true };
    if (m.uomId === m.baseUomId || !m.uomId) return { cost: qty * m.costPrice, baseQty: qty, hasConversion: true };
    const factor = resolveConversionFactor(m.uomId, m.baseUomId, conversions);
    if (isNaN(factor)) return { cost: 0, baseQty: 0, hasConversion: false };
    return { cost: qty * factor * m.costPrice, baseQty: qty * factor, hasConversion: true };
  }

  function compatibleUoms(baseUomId: string) {
    if (!baseUomId) return uoms;
    const related = new Set<string>([baseUomId]);
    conversions.forEach((c) => {
      if (c.fromUOM._id === baseUomId) related.add(c.toUOM._id);
      if (c.toUOM._id === baseUomId) related.add(c.fromUOM._id);
    });
    return uoms.filter((u) => related.has(u._id));
  }

  const costLines = materials.map(lineCostInBaseUom);
  const totalCost = costLines.reduce((s, l) => s + l.cost, 0);
  const outQty = parseFloat(outputQty) || 0;
  const costPerUnit = outQty > 0 ? totalCost / outQty : 0;
  const outputUomSymbol = uoms.find((u) => u._id === outputUom)?.symbol ?? '';
  const hasMissingConversion = costLines.some((l, i) => materials[i].itemId && materials[i].uomId !== materials[i].baseUomId && !l.hasConversion);

  function selectExistingProduct(productId: string) {
    const product = productsData?.data.items.find((item) => item._id === productId) ?? null;
    setSelectedProductId(productId);
    setSelectedProduct(product);
    if (!product) return;
    setName(product.name);
    setSku(product.sku);
    setOutputUom(typeof product.baseUom === 'string' ? product.baseUom : product.baseUom._id);
    setSalePrice(product.salePrice ? String(product.salePrice) : '');
    setReorderLevel(String(product.reorderLevel ?? 0));
  }

  async function handleSave() {
    if (productionMode === 'new' && (!name.trim() || !sku.trim() || !outputUom)) {
      toast.error('Fill in all required product fields');
      return;
    }
    if (productionMode === 'existing' && (!selectedProductId || !selectedProduct)) {
      toast.error('Select an existing finished product');
      return;
    }
    if (!outputUom) { toast.error('Select an output UOM'); return; }
    if (outQty <= 0) { toast.error('Output qty is required'); return; }
    if (productionMode === 'new' && !(parseFloat(salePrice) > 0)) { toast.error('Sale price is required'); return; }
    if (!warehouse) { toast.error('Select a warehouse'); return; }
    if (materials.every((m) => !m.itemId)) { toast.error('Add at least one input material'); return; }
    if (materials.some((m) => m.itemId && !(parseFloat(m.qty) > 0))) { toast.error('Each material needs a quantity'); return; }
    if (hasMissingConversion) { toast.error('Some materials have no UOM conversion. Add them in Settings → UOM.'); return; }

    const filledMaterials = materials
      .filter((m) => m.itemId && parseFloat(m.qty) > 0)
      .map((m) => ({ item: m.itemId, qty: parseFloat(m.qty), uom: m.uomId || m.baseUomId }));

    try {
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
        materials: filledMaterials,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success(`Production batch ${result.data.batch.batchNumber} recorded`);
      const productId = typeof result.data.batch.product === 'string'
        ? result.data.batch.product
        : result.data.batch.product._id;
      router.push(`/production/${productId}`);
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to save product');
    }
  }

  return (
    <>
      <PageHeader
        title="Create Production"
        description="Produce a new or existing finished product in a tracked batch"
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: 'Create' }]}
        actions={
          <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        }
      />

      <div className="flex flex-col gap-6">
        {/* Product Details */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Product Details</p>
          </div>
          <div className="px-5 pt-4 flex gap-1" role="group" aria-label="Production product mode">
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
          {productionMode === 'new' ? (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Product Name" required placeholder="e.g. Aloe Vera Cream 200ml"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer);
                  (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer = setTimeout(() => setSkuName(e.target.value), 500);
                }}
              />
              <FormField label="SKU" placeholder="Auto-generated" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
          ) : (
            <div className="p-5 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Search product by name or SKU"
                placeholder="Type a product name or SKU…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <SelectField label="Finished Product" required value={selectedProductId} onChange={(e) => selectExistingProduct(e.target.value)}>
                <option value="">{productsLoading ? 'Loading products…' : 'Select product…'}</option>
                {(productsData?.data.items ?? []).map((product) => (
                  <option key={product._id} value={product._id}>{product.name} · {product.sku}</option>
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
          )}
        </div>

        {/* Input Materials */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Input Materials</p>
            <button type="button" onClick={addMaterial} className="h-8 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors">
              <Plus size={13} /> Add Another Material
            </button>
          </div>
          <div className="p-5 flex flex-col gap-3 bg-slate-200 rounded-b-lg">
            <div className="hidden sm:grid grid-cols-[1fr_120px_90px_110px_36px] gap-2 px-1">
              <span className="text-sm font-bold text-foreground">Material</span>
              <span className="text-sm font-bold text-foreground">Usage UOM</span>
              <span className="text-sm font-bold text-foreground">Qty</span>
              <span className="text-sm font-bold text-foreground text-right">Line Cost</span>
              <span />
            </div>
            {materials.map((m, idx) => {
              const { cost: lineCost, hasConversion } = lineCostInBaseUom(m);
              const compat = compatibleUoms(m.baseUomId);
              const uomMismatch = m.itemId && m.uomId && m.uomId !== m.baseUomId && !hasConversion;
              return (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_110px_36px] gap-2 items-start bg-white rounded-lg p-2">
                  <MaterialSelect value={m.itemId} items={allItems} stockMap={stockMap} onChange={(id) => pickItem(idx, id)} />
                  <div className="flex flex-col gap-0.5">
                    <select
                      value={m.uomId}
                      onChange={(e) => setUom(idx, e.target.value)}
                      disabled={!m.itemId}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald disabled:bg-slate-100 disabled:text-muted"
                    >
                      <option value="">UOM…</option>
                      {compat.map((u) => <option key={u._id} value={u._id}>{u.symbol}{u._id === m.baseUomId ? ' (base)' : ''}</option>)}
                    </select>
                    {uomMismatch && <p className="text-[10px] text-red-500 leading-tight">No conversion</p>}
                  </div>
                  <input
                    type="number" min={0} step="any" placeholder="Qty" value={m.qty}
                    onChange={(e) => setQty(idx, e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                  />
                  <div className="h-9 flex items-center justify-end px-2 rounded-md border border-border bg-white text-sm font-medium text-foreground">
                    {uomMismatch ? <span className="text-red-400 text-xs">No conv.</span> : lineCost > 0 ? formatCurrency(lineCost) : <span className="text-muted">—</span>}
                  </div>
                  <button type="button" onClick={() => removeMaterial(idx)} className="h-9 w-9 flex items-center justify-center rounded-md text-secondary hover:bg-red-50 hover:text-red-500 transition-colors" aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={addMaterial} className="self-start h-8 px-3 rounded-md border border-dashed border-emerald text-emerald text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-50 transition-colors">
              <Plus size={13} /> Add Another Material
            </button>
            {hasMissingConversion && (
              <p className="text-xs text-red-500">⚠ Some materials have no UOM conversion. Go to Settings → UOM → Conversions to add them.</p>
            )}
          </div>
        </div>

        {/* Output + Cost Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="bg-white rounded-lg border border-border">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Output</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SelectField label="Output UOM" required value={outputUom} disabled={productionMode === 'existing'} onChange={(e) => setOutputUom(e.target.value)}>
                <option value="">Select UOM…</option>
                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
              </SelectField>
              <FormField label="Output Qty produced" required type="number" min={0} step="any" placeholder="e.g. 100" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} />
              <SelectField label="Warehouse" required value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>
              {productionMode === 'new' ? (
                <FormField label="Low Stock Qty" type="number" min={0} step="1" placeholder="e.g. 10" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secondary">Low Stock Qty</span>
                  <p className="h-9 flex items-center text-sm text-foreground">{selectedProduct?.reorderLevel ?? 0}</p>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-1">
                <label htmlFor="production-notes" className="text-xs font-medium text-secondary">Batch Notes</label>
                <textarea
                  id="production-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-border">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Cost Summary</p>
              </div>
              <div className="p-5 flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Total Raw Material Cost</span>
                  <span className="font-medium text-foreground">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Output Qty</span>
                  <span className="font-medium text-foreground">{outQty > 0 ? `${outQty} ${outputUomSymbol}` : '—'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="text-sm font-semibold text-foreground">Cost / {outputUomSymbol || 'unit'}</span>
                  <span className="text-base font-bold text-emerald">{costPerUnit > 0 ? formatCurrency(costPerUnit) : '—'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="text-sm font-semibold text-violet-600">Sale Price (৳)</span>
                  {productionMode === 'new' ? (
                    <input
                      type="number" min={0} step="0.01" placeholder="e.g. 150" value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-28 h-8 rounded-md border border-green-300 px-2 text-sm font-semibold text-green-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-green-700">
                      {selectedProduct?.salePrice ? formatCurrency(selectedProduct.salePrice) : '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button type="button" onClick={handleSave} disabled={isLoading} className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Record Production Batch
              </button>
              <button type="button" onClick={() => router.back()} className="h-10 px-4 rounded-md border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
