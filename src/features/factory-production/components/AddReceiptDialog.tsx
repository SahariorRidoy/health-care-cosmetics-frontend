'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { FormField, SelectField } from '@/components/forms/FormField';
import { useGetUOMsQuery, useGenerateSkuQuery, useGetItemsQuery } from '@/features/inventory/services/inventoryApi';
import { useGetUOMConversionsQuery } from '@/features/settings/services/settingsApi';
import { useAddFactoryReceiptMutation } from '../services/factoryProductionApi';
import { formatCurrency } from '@/lib/formatters';
import type { FactoryBatch, FactoryDispatchMaterial } from '../types';

interface MaterialUsedLine {
  item: string;
  usedQty: string;
  uom: string;
}

interface ProductLine {
  productName: string;
  isNewProduct: boolean;
  linkedItem: string;
  newName: string;
  newSku: string;
  newBaseUom: string;
  newSalePrice: string;
  newReorderLevel: string;
  receivedQty: string;
  uom: string;
  salePrice: string;
  materialsUsed: MaterialUsedLine[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  batch: FactoryBatch;
}

function emptyProduct(): ProductLine {
  return {
    productName: '', isNewProduct: true, linkedItem: '',
    newName: '', newSku: '', newBaseUom: '', newSalePrice: '', newReorderLevel: '',
    receivedQty: '', uom: '', salePrice: '',
    materialsUsed: [{ item: '', usedQty: '', uom: '' }],
  };
}

// Derive dispatched materials as a flat list with populated names
function useDispatchedMaterials(batch: FactoryBatch) {
  return useMemo(() => {
    return batch.dispatch.materials.map((m: FactoryDispatchMaterial) => {
      const item = m.item as { _id: string; name: string; sku: string; costPrice: number } | string;
      const uom = m.uom as { _id: string; symbol: string } | string;
      return {
        id: typeof item === 'string' ? item : item._id,
        name: typeof item === 'string' ? item : item.name,
        costPrice: typeof item === 'string' ? 0 : (item.costPrice ?? 0),
        uomId: typeof uom === 'string' ? uom : uom._id,
        uomSymbol: typeof uom === 'string' ? '' : uom.symbol,
        dispatchedQty: m.dispatchedQty,
        unitCost: m.unitCost,
      };
    });
  }, [batch.dispatch.materials]);
}

function getEntityId(entity: { _id: string } | string) {
  return typeof entity === 'string' ? entity : entity._id;
}

function ItemSearchField({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('');
  const { data } = useGetItemsQuery({ search: query || undefined, isActive: 'true', type: 'FINISHED_GOOD' });
  const items = data?.data?.items ?? [];

  useEffect(() => { if (!value) { setDisplay(''); setQuery(''); } }, [value]);

  return (
    <div className="relative">
      <label className="block text-sm font-bold text-foreground mb-1">Existing Item <span className="text-red-500">*</span></label>
      <div className="relative">
        <input
          type="text"
          placeholder="Search item name or SKU…"
          value={display || query}
          onChange={(e) => { setQuery(e.target.value); setDisplay(''); onChange('', ''); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="h-9 w-full rounded-md border border-border bg-white px-3 pr-14 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
        />
        {value && (
          <button
            type="button"
            onMouseDown={() => { onChange('', ''); setDisplay(''); setQuery(''); }}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 transition-colors"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-white shadow-lg max-h-48 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item._id}
              onMouseDown={() => { onChange(item._id, item.name); setDisplay(item.name); setQuery(''); setOpen(false); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 flex items-center justify-between gap-2"
            >
              <span className="font-medium text-foreground truncate">{item.name}</span>
              <span className="text-xs text-secondary shrink-0">{item.sku}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkuAutoFill({ name, onSku }: { name: string; onSku: (sku: string) => void }) {
  const { data } = useGenerateSkuQuery(name, { skip: name.trim().length < 2 });
  useEffect(() => {
    const sku = data?.data?.sku;
    if (sku) onSku(sku);
  }, [data, onSku]);
  return null;
}

export function AddReceiptDialog({ open, onClose, batch }: Props) {
  const { data: uomData } = useGetUOMsQuery();
  const { data: convData } = useGetUOMConversionsQuery();
  const [addReceipt, { isLoading }] = useAddFactoryReceiptMutation();

  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);
  const conversions = useMemo(() => convData?.data?.conversions ?? [], [convData]);

  const getRelatedUomIds = useCallback((baseUomId: string): string[] => {
    const related = new Set<string>([baseUomId]);
    for (const c of conversions) {
      if (c.fromUOM._id === baseUomId) related.add(c.toUOM._id);
      if (c.toUOM._id === baseUomId) related.add(c.fromUOM._id);
    }
    return Array.from(related);
  }, [conversions]);
  const dispatchedMaterials = useDispatchedMaterials(batch);
  const availableMaterials = useMemo(() => {
    const used = new Map<string, number>();
    const returned = new Map<string, number>();

    for (const receipt of batch.receipts) {
      for (const product of receipt.products) {
        for (const material of product.materialsUsed) {
          const itemId = getEntityId(material.item);
          used.set(itemId, (used.get(itemId) ?? 0) + material.usedQty);
        }
      }
    }
    for (const materialReturn of batch.materialReturns) {
      for (const material of materialReturn.materials) {
        const itemId = getEntityId(material.item);
        returned.set(itemId, (returned.get(itemId) ?? 0) + material.returnedQty);
      }
    }

    return new Map(dispatchedMaterials.map((material) => [
      material.id,
      Math.max(0, material.dispatchedQty - (used.get(material.id) ?? 0) - (returned.get(material.id) ?? 0)),
    ]));
  }, [batch.materialReturns, batch.receipts, dispatchedMaterials]);

  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryCost, setDeliveryCost] = useState('');
  const [productionCost, setProductionCost] = useState('');
  const [otherCost, setOtherCost] = useState('');
  const [products, setProducts] = useState<ProductLine[]>([emptyProduct()]);

  function reset() {
    setReceiptDate(new Date().toISOString().split('T')[0]); setDeliveryCost(''); setProductionCost(''); setOtherCost('');
    setProducts([emptyProduct()]);
  }

  function handleClose() { reset(); onClose(); }

  // ── Product helpers ───────────────────────────────────────────────────────

  const updateProduct = useCallback((idx: number, patch: Partial<ProductLine>) => {
    setProducts((p) => p.map((row, i) => i === idx ? { ...row, ...patch } : row));
  }, []);

  const removeProduct = useCallback((idx: number) => {
    setProducts((p) => p.filter((_, i) => i !== idx));
  }, []);

  const addProduct = useCallback(() => {
    setProducts((p) => [...p, emptyProduct()]);
  }, []);

  // ── Material-used helpers ─────────────────────────────────────────────────

  const updateMaterial = useCallback((pIdx: number, mIdx: number, patch: Partial<MaterialUsedLine>) => {
    setProducts((p) => p.map((row, i) => {
      if (i !== pIdx) return row;
      return {
        ...row,
        materialsUsed: row.materialsUsed.map((m, j) => j === mIdx ? { ...m, ...patch } : m),
      };
    }));
  }, []);

  const addMaterial = useCallback((pIdx: number) => {
    setProducts((p) => p.map((row, i) => i !== pIdx ? row : {
      ...row, materialsUsed: [...row.materialsUsed, { item: '', usedQty: '', uom: '' }],
    }));
  }, []);

  const removeMaterial = useCallback((pIdx: number, mIdx: number) => {
    setProducts((p) => p.map((row, i) => i !== pIdx ? row : {
      ...row, materialsUsed: row.materialsUsed.filter((_, j) => j !== mIdx),
    }));
  }, []);

  // ── Live cost calculation ─────────────────────────────────────────────────

  const sharedCost = (parseFloat(deliveryCost) || 0) + (parseFloat(productionCost) || 0) + (parseFloat(otherCost) || 0);
  const totalPieces = products.reduce((s, p) => s + (parseFloat(p.receivedQty) || 0), 0);

  const costRows = useMemo(() => products.map((p) => {
    const qty = parseFloat(p.receivedQty) || 0;
    const materialCost = p.materialsUsed.reduce((s, mu) => {
      const mat = dispatchedMaterials.find((d) => d.id === mu.item);
      return s + (parseFloat(mu.usedQty) || 0) * (mat?.unitCost ?? 0);
    }, 0);
    const allocatedShared = totalPieces > 0 ? (qty / totalPieces) * sharedCost : 0;
    const unitCost = qty > 0 ? (materialCost + allocatedShared) / qty : 0;
    const sale = parseFloat(p.isNewProduct ? p.newSalePrice : p.salePrice) || 0;
    const margin = sale > 0 && unitCost > 0 ? ((sale - unitCost) / sale) * 100 : null;
    return { materialCost, allocatedShared, unitCost, margin, sale };
  }), [products, dispatchedMaterials, sharedCost, totalPieces]);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!receiptDate) { toast.error('Receipt date is required'); return; }
    if (!products.length) { toast.error('Add at least one product'); return; }

    for (const p of products) {
      if (!p.productName.trim()) { toast.error('Product name is required for all products'); return; }
      if (!p.receivedQty || parseFloat(p.receivedQty) <= 0) { toast.error(`Enter received qty for "${p.productName}"`); return; }
      if (!p.isNewProduct && !p.uom) { toast.error(`Select UOM for "${p.productName}"`); return; }
      if (p.isNewProduct && !p.newBaseUom) { toast.error(`Select base UOM for new product "${p.productName}"`); return; }
      if (!p.isNewProduct && !p.linkedItem) { toast.error(`Select existing item for "${p.productName}"`); return; }
      const salePrice = parseFloat(p.isNewProduct ? p.newSalePrice : p.salePrice);
      if (!salePrice || salePrice <= 0) { toast.error(`Enter sale price for "${p.productName}"`); return; }
      if (!p.materialsUsed.length) { toast.error(`Add at least one material used for "${p.productName}"`); return; }
      for (const mu of p.materialsUsed) {
        if (!mu.item) { toast.error(`Select material for all material-used rows in "${p.productName}"`); return; }
        if (!mu.usedQty || parseFloat(mu.usedQty) <= 0) { toast.error(`Enter used qty for all materials in "${p.productName}"`); return; }
        if (!mu.uom) { toast.error(`Select UOM for all materials in "${p.productName}"`); return; }
      }
    }

    const requestedMaterials = new Map<string, number>();
    for (const product of products) {
      for (const material of product.materialsUsed) {
        requestedMaterials.set(material.item, (requestedMaterials.get(material.item) ?? 0) + parseFloat(material.usedQty));
      }
    }
    for (const [itemId, requestedQty] of requestedMaterials) {
      const availableQty = availableMaterials.get(itemId) ?? 0;
      if (requestedQty > availableQty) {
        const materialName = dispatchedMaterials.find((material) => material.id === itemId)?.name ?? 'material';
        toast.error(`Insufficient ${materialName}: ${availableQty} available, but ${requestedQty} requested`);
        return;
      }
    }

    const payload = {
      receiptDate: new Date(receiptDate).toISOString(),
      deliveryCost: parseFloat(deliveryCost) || 0,
      productionCost: parseFloat(productionCost) || 0,
      otherCost: parseFloat(otherCost) || 0,
      products: products.map((p) => ({
        productName: p.productName.trim(),
        isNewProduct: p.isNewProduct,
        linkedItem: p.isNewProduct ? undefined : p.linkedItem || undefined,
        newProductData: p.isNewProduct ? {
          name: p.newName.trim() || p.productName.trim(),
          sku: p.newSku.trim() || undefined,
          baseUom: p.newBaseUom,
          salePrice: parseFloat(p.newSalePrice) || undefined,
          reorderLevel: parseFloat(p.newReorderLevel) || 0,
        } : undefined,
        receivedQty: parseFloat(p.receivedQty),
        uom: p.isNewProduct ? p.newBaseUom : p.uom,
        salePrice: p.isNewProduct ? (parseFloat(p.newSalePrice) || undefined) : (parseFloat(p.salePrice) || undefined),
        materialsUsed: p.materialsUsed.map((mu) => ({
          item: mu.item,
          usedQty: parseFloat(mu.usedQty),
          uom: mu.uom,
        })),
      })),
    };

    try {
      await addReceipt({ id: batch._id, body: payload }).unwrap();
      toast.success('Production receipt added');
      reset();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to add receipt');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-label="Add Production Receipt"
        className="relative w-full sm:max-w-4xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[94vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add Production Receipt</h2>
            <p className="text-xs text-secondary mt-0.5">{batch.fbNumber} — {batch.batchName}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Section B — Products */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <p className="text-xl font-extrabold text-secondary uppercase tracking-wide">Products Received</p>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-emerald-600 whitespace-nowrap">Receipt Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="h-9 flex-1 sm:flex-none rounded-lg border-2 border-emerald bg-emerald-50 px-3 text-base font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>
            </div>

            <div className="space-y-3">
              {products.map((p, pIdx) => {
                const costs = costRows[pIdx];
                return (
                  <div key={pIdx} className="rounded-lg overflow-hidden border-2 border-emerald shadow-[0_0_0_3px_rgba(16,185,129,0.15)] bg-white">
                    <div className="px-4 py-4 space-y-4">
                        {/* Product type toggle with number badge and delete */}
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 bg-emerald text-white">
                            {pIdx + 1}
                          </span>
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                            <button
                              type="button"
                              onClick={() => updateProduct(pIdx, { isNewProduct: true, linkedItem: '' })}
                              className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                                p.isNewProduct
                                  ? 'bg-white text-emerald shadow-sm ring-1 ring-black/5'
                                  : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.isNewProduct ? 'bg-emerald' : 'bg-slate-300'}`} />
                              New Product
                            </button>
                            <button
                              type="button"
                              onClick={() => updateProduct(pIdx, { isNewProduct: false })}
                              className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                                !p.isNewProduct
                                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                  : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!p.isNewProduct ? 'bg-blue-500' : 'bg-slate-300'}`} />
                              Existing Item
                            </button>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            {products.length > 1 && (
                              <button type="button" onClick={() => removeProduct(pIdx)} className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors text-xs font-semibold" aria-label="Remove product">
                                <X size={13} /> Remove Product
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Product Name + SKU / Existing Item ID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {p.isNewProduct && (
                            <FormField
                              label="Product Name" required placeholder="e.g. Whitening Cream 50ml"
                              value={p.productName}
                              onChange={(e) => updateProduct(pIdx, { productName: e.target.value })}
                            />
                          )}
                          {p.isNewProduct ? (
                            <div>
                              {!p.newSku && p.productName.trim().length >= 2 && (
                                <SkuAutoFill name={p.productName} onSku={(sku) => updateProduct(pIdx, { newSku: sku })} />
                              )}
                              <FormField label="SKU (optional)" placeholder="Auto-generated" value={p.newSku} onChange={(e) => updateProduct(pIdx, { newSku: e.target.value })} />
                            </div>
                          ) : (
                            <ItemSearchField
                              value={p.linkedItem}
                              onChange={(id, name) => updateProduct(pIdx, { linkedItem: id, productName: name || p.productName })}
                            />
                          )}
                        </div>

                        {/* Materials Used */}
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div className="px-3 py-2 bg-gray-700 border-b border-border">
                            <p className="text-xs font-semibold text-white uppercase tracking-wide">Materials Used</p>
                          </div>

                          <div className="p-3 space-y-1.5">
                            <div className="hidden sm:grid grid-cols-[1fr_140px_80px_32px] gap-2 mb-1">
                              <span className="text-[11px] font-medium text-secondary">Material (from dispatch)</span>
                              <span className="text-[11px] font-medium text-secondary">Used Qty</span>
                              <span className="text-[11px] font-medium text-secondary">UOM</span>
                              <span />
                            </div>
                            {p.materialsUsed.map((mu, mIdx) => {
                              const mat = dispatchedMaterials.find((d) => d.id === mu.item);
                              const lineCost = (parseFloat(mu.usedQty) || 0) * (mat?.unitCost ?? 0);
                              const availableQty = mat ? availableMaterials.get(mat.id) ?? 0 : null;
                              return (
                                <div key={mIdx} className="bg-slate-50 rounded-md p-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_80px_32px] gap-2 items-center">
                                    <select
                                      value={mu.item}
                                      onChange={(e) => {
                                        const found = dispatchedMaterials.find((d) => d.id === e.target.value);
                                        updateMaterial(pIdx, mIdx, { item: e.target.value, uom: found?.uomId ?? '' });
                                      }}
                                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                                    >
                                      <option value="">Select material…</option>
                                      {dispatchedMaterials.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number" min={0} step="any" placeholder="Qty"
                                      value={mu.usedQty}
                                      onChange={(e) => updateMaterial(pIdx, mIdx, { usedQty: e.target.value })}
                                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                                    />
                                    <select
                                      value={mu.uom}
                                      onChange={(e) => updateMaterial(pIdx, mIdx, { uom: e.target.value })}
                                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                                    >
                                      <option value="">UOM…</option>
                                      {(mat
                                        ? uoms.filter((u) => getRelatedUomIds(mat.uomId).includes(u._id))
                                        : uoms
                                      ).map((u) => <option key={u._id} value={u._id}>{u.symbol}</option>)}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => removeMaterial(pIdx, mIdx)}
                                      disabled={p.materialsUsed.length === 1}
                                      className="h-9 w-8 flex items-center justify-center rounded-md text-red-500 hover:text-red-600 disabled:opacity-30 transition-colors"
                                      aria-label="Remove material"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                  {(lineCost > 0 || availableQty !== null) && (
                                    <div className="flex items-center gap-3 mt-1 px-1">
                                      {lineCost > 0 && <span className="text-[10px] text-emerald-600 font-medium">Cost: {formatCurrency(lineCost)}</span>}
                                      {availableQty !== null && <span className="text-[10px] text-secondary">Available: {availableQty} {mat?.uomSymbol}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className="flex items-center justify-between mt-1">
                              <button type="button" onClick={() => addMaterial(pIdx)} className="h-8 px-3 rounded-md border border-dashed border-emerald-500 text-emerald-500 text-xs font-medium flex items-center gap-1.5 transition-colors hover:bg-emerald-100">
                                <Plus size={12} /> Add Another Material
                              </button>
                              {costs.materialCost > 0 && (
                                <div className="flex items-center gap-3 text-xs text-secondary">
                                  <span>Material: <span className="font-semibold text-emerald-700">{formatCurrency(costs.materialCost)}</span></span>
                                  {costs.unitCost > 0 && <span>Unit cost: <span className="font-semibold text-foreground">{formatCurrency(costs.unitCost)}</span></span>}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Received Qty + Base UOM + Low Stock Qty — footer inside border */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-3 py-3 border-t border-border">
                            <FormField label="Received Production Qty" required type="number" min={0} step="any" placeholder="0" value={p.receivedQty} onChange={(e) => updateProduct(pIdx, { receivedQty: e.target.value })} />
                            {p.isNewProduct ? (
                              <SelectField label="Base UOM" required value={p.newBaseUom} onChange={(e) => updateProduct(pIdx, { newBaseUom: e.target.value })}>
                                <option value="">Select…</option>
                                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
                              </SelectField>
                            ) : (
                              <SelectField label="UOM" required value={p.uom} onChange={(e) => updateProduct(pIdx, { uom: e.target.value })}>
                                <option value="">Select…</option>
                                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
                              </SelectField>
                            )}
                            <FormField label="Low Stock Qty" type="number" min={0} step="any" placeholder="0" value={p.newReorderLevel} onChange={(e) => updateProduct(pIdx, { newReorderLevel: e.target.value })} />
                          </div>
                        </div>
                      </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addProduct} className="mt-3 h-10 px-5 rounded-md border-2 border-dashed border-gray-400 bg-transparent text-gray-600 text-sm font-semibold flex items-center gap-2 transition-colors hover:border-gray-600 hover:text-gray-800">
              <Plus size={13} /> Add Another Product
            </button>
          </div>

          {/* Section C — Live Cost Summary */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 bg-gray-700">
              <p className="text-xs font-semibold text-white uppercase tracking-wide">Cost Summary</p>
            </div>
            <div className="p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <FormField label="Delivery Cost (৳)" type="number" min={0} step="any" placeholder="0" value={deliveryCost} onChange={(e) => setDeliveryCost(e.target.value)} />
              <FormField label="Production Cost (৳)" type="number" min={0} step="any" placeholder="0" value={productionCost} onChange={(e) => setProductionCost(e.target.value)} />
              <FormField label="Other Cost (৳)" type="number" min={0} step="any" placeholder="0" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} />
            </div>
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-border">
                      {['Product', 'Qty', 'Material Cost', 'Shared Cost', 'Unit Cost', 'Sale Price (৳) *', 'Margin'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => {
                      const c = costRows[i];
                      return (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground truncate max-w-[140px]">{p.productName || `Product ${i + 1}`}</td>
                          <td className="px-3 py-2 text-secondary">{p.receivedQty || '—'}</td>
                          <td className="px-3 py-2">{c.materialCost > 0 ? formatCurrency(c.materialCost) : '—'}</td>
                          <td className="px-3 py-2">{c.allocatedShared > 0 ? formatCurrency(c.allocatedShared) : '—'}</td>
                          <td className="px-3 py-2 font-semibold text-foreground">{c.unitCost > 0 ? formatCurrency(c.unitCost) : '—'}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number" min={0} step="any" placeholder="0" required
                              value={p.isNewProduct ? p.newSalePrice : p.salePrice}
                              onChange={(e) => updateProduct(i, p.isNewProduct ? { newSalePrice: e.target.value } : { salePrice: e.target.value })}
                              className={`h-8 w-24 rounded-md border px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald ${
                                !(p.isNewProduct ? p.newSalePrice : p.salePrice) ? 'border-red-400 bg-red-50' : 'border-border bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {c.margin !== null ? (
                              <span className={`font-semibold ${c.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {c.margin.toFixed(1)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
            Save Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
