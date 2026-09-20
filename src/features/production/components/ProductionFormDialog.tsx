'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { useGetItemsQuery, useGetUOMsQuery, useGetWarehousesQuery, useGenerateSkuQuery } from '@/features/inventory/services/inventoryApi';
import { useCreateProductMutation, useUpdateProductMutation } from '@/features/products/services/productsApi';
import type { Product } from '@/features/products/types';
import { FormField, SelectField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';

interface MaterialLine {
  itemId: string;
  uomSymbol: string;
  costPrice: number;
  qty: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

export function ProductionFormDialog({ open, onClose, product }: Props) {
  const isEdit = !!product;
  const { data: rawData } = useGetItemsQuery({ type: 'RAW_MATERIAL', isActive: 'true' });
  const { data: pkgData } = useGetItemsQuery({ type: 'PACKAGING', isActive: 'true' });
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const isLoading = creating || updating;

  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [skuName, setSkuName] = useState('');
  const { data: skuData } = useGenerateSkuQuery(skuName, { skip: isEdit || skuName.trim().length < 2 });
  const [outputUom, setOutputUom] = useState(
    product ? (typeof product.baseUom === 'string' ? product.baseUom : (product.baseUom?._id ?? '')) : ''
  );
  const [outputQty, setOutputQty] = useState('');
  const [salePrice, setSalePrice] = useState(product?.salePrice ? String(product.salePrice) : '');
  const [warehouse, setWarehouse] = useState('');
  const [materials, setMaterials] = useState<MaterialLine[]>([]);

  const allItems = useMemo(() => [...(rawData?.data?.items ?? []), ...(pkgData?.data?.items ?? [])], [rawData, pkgData]);
  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];

  // Auto-fill SKU from API
  useEffect(() => {
    if (!isEdit && skuData?.data?.sku) setSku(skuData.data.sku);
  }, [skuData, isEdit]);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setSku(product?.sku ?? '');
    setOutputUom(product ? (typeof product.baseUom === 'string' ? product.baseUom : (product.baseUom?._id ?? '')) : '');
    setSalePrice(product?.salePrice ? String(product.salePrice) : '');
    setOutputQty(product?.currentStock ? String(product.currentStock) : '');
    setWarehouse('');
    setMaterials(isEdit ? [] : [{ itemId: '', uomSymbol: '', costPrice: 0, qty: '' }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?._id]);

  const addMaterial = useCallback(() => {
    setMaterials((p) => [...p, { itemId: '', uomSymbol: '', costPrice: 0, qty: '' }]);
  }, []);

  const removeMaterial = useCallback((idx: number) => {
    setMaterials((p) => p.filter((_, i) => i !== idx));
  }, []);

  const pickItem = useCallback(
    (idx: number, itemId: string) => {
      const item = allItems.find((i) => i._id === itemId);
      if (!item) return;
      const uom = typeof item.baseUom === 'object' ? item.baseUom : uoms.find((u) => u._id === item.baseUom);
      setMaterials((p) =>
        p.map((m, i) =>
          i === idx ? { ...m, itemId, uomSymbol: uom?.symbol ?? '', costPrice: item.costPrice } : m,
        ),
      );
    },
    [allItems, uoms],
  );

  const setQty = useCallback((idx: number, qty: string) => {
    setMaterials((p) => p.map((m, i) => (i === idx ? { ...m, qty } : m)));
  }, []);

  const totalCost = materials.reduce((s, m) => s + (parseFloat(m.qty) || 0) * m.costPrice, 0);
  const outQty = parseFloat(outputQty) || 0;
  const costPerUnit = outQty > 0 ? totalCost / outQty : 0;
  const outputUomSymbol = uoms.find((u) => u._id === outputUom)?.symbol ?? '';

  function reset() {
    setName(''); setSku(''); setSkuName(''); setOutputUom('');
    setOutputQty(''); setSalePrice(''); setWarehouse('');
    setMaterials([{ itemId: '', uomSymbol: '', costPrice: 0, qty: '' }]);
  }

  async function handleSave() {
    if (!name.trim() || !sku.trim() || !outputUom) {
      toast.error('Fill in all required product fields');
      return;
    }
    if (outQty <= 0) { toast.error('Output qty is required'); return; }
    if (!warehouse) { toast.error('Select a warehouse'); return; }
    if (materials.length === 0) { toast.error('Add at least one input material'); return; }
    if (materials.some((m) => !m.itemId || !(parseFloat(m.qty) > 0))) {
      toast.error('Each material needs an item and a quantity');
      return;
    }
    try {
      const costPrice = costPerUnit > 0 ? costPerUnit : undefined;
      if (isEdit) {
        await updateProduct({
          id: product._id,
          body: {
            name: name.trim(),
            sku: sku.trim(),
            baseUom: outputUom,
            costPrice,
            salePrice: parseFloat(salePrice) || undefined,
          },
        }).unwrap();
        toast.success('Product updated');
      } else {
        await createProduct({
          name: name.trim(),
          sku: sku.trim(),
          baseUom: outputUom,
          reorderLevel: 0,
          warehouse,
          quantity: outQty,
          unitPrice: costPerUnit > 0 ? costPerUnit : 0,
          costPrice,
          salePrice: parseFloat(salePrice) || undefined,
        }).unwrap();
        toast.success('Product created');
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
              <FormField label="SKU" required={isEdit} placeholder={isEdit ? '' : 'Auto-generated'} readOnly={!isEdit} className={!isEdit ? 'bg-slate-50 text-secondary' : ''} value={sku} onChange={(e) => setSku(e.target.value)} />
              <FormField label="Sale Price (৳)" type="number" min={0} step="0.01" placeholder="Optional" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              <SelectField label="Output UOM" required value={outputUom} onChange={(e) => setOutputUom(e.target.value)}>
                <option value="">Select UOM…</option>
                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
              </SelectField>
              <FormField label="Output Qty (units produced)" required type="number" min={0} step="any" placeholder="e.g. 100" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} />
              <SelectField label="Warehouse" required value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>
            </div>
          </div>

          {/* Input materials */}
          <div>
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

            {materials.length === 0 ? null : (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_80px_90px_110px_36px] gap-2 px-1">
                  <span className="text-[11px] font-medium text-secondary">Material</span>
                  <span className="text-[11px] font-medium text-secondary">UOM</span>
                  <span className="text-[11px] font-medium text-secondary">Qty</span>
                  <span className="text-[11px] font-medium text-secondary text-right">Line Cost</span>
                  <span />
                </div>

                {materials.map((m, idx) => {
                  const lineCost = (parseFloat(m.qty) || 0) * m.costPrice;
                  return (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_90px_110px_36px] gap-2 items-center bg-slate-50 rounded-lg p-2">
                      <select
                        value={m.itemId}
                        onChange={(e) => pickItem(idx, e.target.value)}
                        className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                        aria-label="Select material"
                      >
                        <option value="">Select material…</option>
                        {allItems.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name} ({formatCurrency(item.costPrice)}/{typeof item.baseUom === 'object' ? item.baseUom.symbol : ''})
                          </option>
                        ))}
                      </select>

                      <div className="h-9 flex items-center px-2 rounded-md border border-border bg-white text-sm text-secondary">
                        {m.uomSymbol || <span className="text-muted">—</span>}
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
                        {lineCost > 0 ? formatCurrency(lineCost) : <span className="text-muted">—</span>}
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
            )}
          </div>

          {/* Cost summary */}
          {materials.length > 0 && (
            <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 space-y-1.5">
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
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-sm font-semibold text-foreground">Production Cost / {outputUomSymbol || 'unit'}</span>
                <span className="text-base font-bold text-emerald">
                  {costPerUnit > 0 ? formatCurrency(costPerUnit) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={handleClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Save & Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
