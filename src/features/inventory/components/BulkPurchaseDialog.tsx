'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X, Plus, Search, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { useGetItemsQuery, useGetWarehousesQuery, useGetUOMsQuery, useGenerateSkuQuery, useBulkPurchaseItemsMutation } from '../services/inventoryApi';
import { useGetSuppliersQuery, useGetSupplierDuesQuery, useCreateSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { formatCurrency } from '@/lib/formatters';
import type { Item } from '../types';
import type { Supplier } from '@/features/procurement/types';

const ITEM_TYPES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'SEMI_FINISHED', label: 'Semi-Finished' },
];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'];

interface ExistingLine {
  id: string; mode: 'existing';
  item: Item | null; search: string; dropdownOpen: boolean;
  quantity: number; unitPrice: number; reorderLevel: number;
}
interface NewLine {
  id: string; mode: 'new';
  name: string; sku: string; skuTrigger: string; type: string; baseUom: string; description: string;
  quantity: number; unitPrice: number; reorderLevel: number;
}
type Line = ExistingLine | NewLine;

function makeExistingLine(item?: Item | null): ExistingLine {
  return { id: crypto.randomUUID(), mode: 'existing', item: item ?? null, search: item?.name ?? '', dropdownOpen: false, quantity: 1, unitPrice: item?.costPrice ?? 0, reorderLevel: item?.reorderLevel ?? 0 };
}
function makeNewLine(): NewLine {
  return { id: crypto.randomUUID(), mode: 'new', name: '', sku: '', skuTrigger: '', type: 'RAW_MATERIAL', baseUom: '', description: '', quantity: 1, unitPrice: 0, reorderLevel: 0 };
}

interface Props { open: boolean; preselectedItem?: Item | null; onClose: () => void; }

// Small SKU auto-fetch hook per new line
function SkuAutoFill({ trigger, onSku }: { trigger: string; onSku: (sku: string) => void }) {
  const { data } = useGenerateSkuQuery(trigger, { skip: trigger.trim().length < 2 });
  useEffect(() => { if (data?.data?.sku) onSku(data.data.sku); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function BulkPurchaseDialog({ open, preselectedItem, onClose }: Props) {
  const [lines, setLines] = useState<Line[]>([makeExistingLine()]);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: itemsData } = useGetItemsQuery({ search: itemSearch || undefined });
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: uomData } = useGetUOMsQuery();
  const { data: supplierData } = useGetSuppliersQuery({ isActive: 'true' });
  const { data: duesData } = useGetSupplierDuesQuery(supplierId, { skip: !supplierId });
  const [bulkPurchase, { isLoading: purchasing }] = useBulkPurchaseItemsMutation();
  const [createPayment, { isLoading: paying }] = useCreateSupplierPaymentMutation();
  const isLoading = purchasing || paying;

  const existingItems = itemsData?.data?.items ?? [];
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  const uoms = uomData?.data?.uoms?.filter((u) => u.isActive) ?? [];
  const suppliers = supplierData?.data?.suppliers ?? [];
  const supplierDue = duesData?.data?.outstandingBalance ?? 0;

  useEffect(() => {
    if (!open) return;
    setLines([makeExistingLine(preselectedItem)]);
    setSupplierId(preselectedItem?.supplier ? (typeof preselectedItem.supplier === 'string' ? preselectedItem.supplier : preselectedItem.supplier._id) : '');
    setWarehouseId(warehouseData?.data?.warehouses?.find((w) => w.isActive && w.isDefault)?._id ?? '');
    setPaidAmount(0); setPaymentMethod('Cash'); setNotes('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedItem]);

  useEffect(() => {
    if (!warehouseId && warehouseData) {
      const def = warehouseData.data?.warehouses?.find((w) => w.isActive && w.isDefault)?._id;
      if (def) setWarehouseId(def);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseData]);

  useEffect(() => {
    if (pendingSupplierId && supplierData) {
      const exists = supplierData.data?.suppliers?.find((s) => s._id === pendingSupplierId);
      if (exists) { setSupplierId(pendingSupplierId); setPendingSupplierId(null); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierData, pendingSupplierId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      setLines((prev) => prev.map((l) => {
        if (l.mode !== 'existing') return l;
        const ref = dropdownRefs.current[l.id];
        if (ref && !ref.contains(e.target as Node)) return { ...l, dropdownOpen: false };
        return l;
      }));
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } as Line : l));
  }

  function toggleMode(id: string) {
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      if (l.mode === 'existing') return makeNewLine();
      return { ...makeExistingLine(), id: l.id };
    }));
  }

  function selectExistingItem(lineId: string, item: Item) {
    setLines((prev) => prev.map((l) => l.id === lineId && l.mode === 'existing'
      ? { ...l, item, search: item.name, dropdownOpen: false, unitPrice: item.costPrice ?? 0, reorderLevel: item.reorderLevel ?? 0 }
      : l,
    ));
    if (!supplierId && item.supplier) {
      setSupplierId(typeof item.supplier === 'string' ? item.supplier : item.supplier._id);
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const remaining = subtotal - (paidAmount || 0);

  const lineErrors = lines.some((l) => {
    if (l.mode === 'existing') return !l.item;
    return !l.name || !l.baseUom;
  });
  const hasError = !supplierId || !warehouseId || lineErrors;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError) { toast.error('Please fill all required fields'); return; }
    try {
      await bulkPurchase({
        supplier: supplierId, warehouse: warehouseId,
        items: lines.map((l) => l.mode === 'existing'
          ? { mode: 'existing' as const, item: l.item!._id, quantity: l.quantity, unitPrice: l.unitPrice, reorderLevel: l.reorderLevel || undefined }
          : { mode: 'new' as const, name: l.name, sku: l.sku || undefined, type: l.type, baseUom: l.baseUom, description: l.description || undefined, quantity: l.quantity, unitPrice: l.unitPrice, reorderLevel: l.reorderLevel || undefined },
        ),
        paidAmount, paymentMethod, notes: notes || undefined,
      }).unwrap();

      if ((paidAmount || 0) > 0) {
        await createPayment({ supplier: supplierId, amount: paidAmount, paymentDate: new Date().toISOString(), method: paymentMethod, notes: notes || 'Payment for purchase' }).unwrap();
      }
      toast.success(`Purchase recorded — ${lines.length} item${lines.length > 1 ? 's' : ''} updated`);
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Operation failed');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Purchase Materials</h2>
            <p className="text-xs text-secondary mt-0.5">Add one or more items in a single purchase order</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 space-y-5">

            {/* Supplier + Warehouse */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Supplier <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="flex-1 h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setSupplierDialogOpen(true)} className="h-10 w-10 rounded-md bg-emerald hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors"><Plus size={16} /></button>
                </div>
                {supplierId && supplierDue > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertCircle size={12} className="shrink-0" />
                    Outstanding due: <span className="font-semibold ml-1">{formatCurrency(supplierDue)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Warehouse <span className="text-red-500">*</span></label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            {/* Line items */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Items</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setLines((p) => [...p, makeExistingLine()])} className="h-7 px-2.5 rounded-md border border-emerald text-emerald text-xs font-medium flex items-center gap-1 hover:bg-emerald-50 transition-colors">
                    <Plus size={12} /> Existing
                  </button>
                  <button type="button" onClick={() => setLines((p) => [...p, makeNewLine()])} className="h-7 px-2.5 rounded-md border border-slate-300 text-secondary text-xs font-medium flex items-center gap-1 hover:bg-slate-50 transition-colors">
                    <Plus size={12} /> New Item
                  </button>
                </div>
              </div>

              {lines.map((line, idx) => (
                <div key={line.id} className="rounded-lg border border-border bg-slate-50 overflow-hidden">
                  {/* Line header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-white">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted">Item {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => toggleMode(line.id)}
                        className="h-5 px-2 rounded text-[10px] font-medium border transition-colors bg-slate-100 border-slate-200 text-secondary hover:bg-slate-200"
                      >
                        {line.mode === 'existing' ? 'Existing ↕ New' : 'New ↕ Existing'}
                      </button>
                    </div>
                    <button type="button" onClick={() => setLines((p) => p.filter((l) => l.id !== line.id))} disabled={lines.length === 1} className="h-6 w-6 flex items-center justify-center rounded text-secondary hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {line.mode === 'existing' ? (
                      <>
                        {/* Item search */}
                        <div className="sm:col-span-2 flex flex-col gap-1" ref={(el) => { dropdownRefs.current[line.id] = el; }}>
                          <label className="text-xs font-medium text-foreground">Material <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                            <input
                              type="text"
                              value={line.search}
                              onChange={(e) => { setItemSearch(e.target.value); updateLine(line.id, { search: e.target.value, item: null, dropdownOpen: true } as Partial<ExistingLine>); }}
                              onFocus={() => { setItemSearch(line.search); updateLine(line.id, { dropdownOpen: true } as Partial<ExistingLine>); }}
                              placeholder="Search by name or SKU…"
                              className={`w-full h-9 rounded-md border bg-white pl-8 pr-8 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald ${line.item ? 'border-emerald-300' : 'border-border'}`}
                            />
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                          </div>
                          {line.dropdownOpen && existingItems.length > 0 && (
                            <div className="border border-border rounded-md bg-white shadow-lg max-h-44 overflow-y-auto z-20">
                              {existingItems.map((it) => (
                                <button key={it._id} type="button" onClick={() => selectExistingItem(line.id, it)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 border-b border-border last:border-0">
                                  <div>
                                    <p className="text-xs font-medium text-foreground">{it.name}</p>
                                    <p className="text-[11px] text-secondary">{it.sku} · {typeof it.baseUom === 'object' ? it.baseUom.symbol : ''}</p>
                                  </div>
                                  <span className="text-[11px] text-secondary shrink-0">Stock: {it.currentStock}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {line.item && (
                            <p className="text-[11px] text-emerald-600">SKU: {line.item.sku} · Type: {line.item.type} · UOM: {typeof line.item.baseUom === 'object' ? line.item.baseUom.symbol : '—'}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* SKU auto-fill side-effect */}
                        <SkuAutoFill trigger={line.skuTrigger} onSku={(sku) => updateLine(line.id, { sku } as Partial<NewLine>)} />

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-foreground">Item Name <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={line.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer);
                              (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer = setTimeout(() => updateLine(line.id, { skuTrigger: val } as Partial<NewLine>), 500);
                              updateLine(line.id, { name: val } as Partial<NewLine>);
                            }}
                            placeholder="e.g. Aloe Vera Gel"
                            className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-foreground">SKU</label>
                          <input
                            type="text"
                            value={line.sku}
                            onChange={(e) => updateLine(line.id, { sku: e.target.value } as Partial<NewLine>)}
                            placeholder="Auto-generated"
                            className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-foreground">Type <span className="text-red-500">*</span></label>
                          <select value={line.type} onChange={(e) => updateLine(line.id, { type: e.target.value } as Partial<NewLine>)} className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                            {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-foreground">Base UOM <span className="text-red-500">*</span></label>
                          <select value={line.baseUom} onChange={(e) => updateLine(line.id, { baseUom: e.target.value } as Partial<NewLine>)} className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                            <option value="">Select UOM…</option>
                            {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
                          </select>
                        </div>

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="text-xs font-medium text-foreground">Description</label>
                          <input type="text" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value } as Partial<NewLine>)} placeholder="Optional description" className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald" />
                        </div>
                      </>
                    )}

                    {/* Shared fields */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">Quantity <span className="text-red-500">*</span></label>
                      <input type="number" min={0.001} step="0.001" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })} className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">Unit Price (৳) <span className="text-red-500">*</span></label>
                      <input type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })} className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">Low Stock Qty</label>
                      <input type="number" min={0} step="1" value={line.reorderLevel} onChange={(e) => updateLine(line.id, { reorderLevel: Number(e.target.value) })} placeholder="0" className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                    </div>

                    {line.quantity > 0 && line.unitPrice > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-white border border-border text-xs">
                        <span className="text-secondary">Line Total</span>
                        <span className="font-semibold text-foreground">{formatCurrency(line.quantity * line.unitPrice)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Payment summary */}
            {subtotal > 0 && (
              <div className="rounded-lg border border-border bg-slate-50 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Subtotal</span>
                  <span className="text-base font-bold text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">Paid Now (৳)</label>
                    <input type="number" min={0} step="0.01" value={paidAmount || ''} onChange={(e) => setPaidAmount(Number(e.target.value))} placeholder="0.00 — leave blank if unpaid" className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">Payment Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                {(paidAmount > 0 || remaining > 0) && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm font-medium ${remaining <= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    <span>{remaining <= 0 ? 'Fully Paid' : 'Remaining Due'}</span>
                    <span className="font-bold">{remaining <= 0 ? '✓ Paid' : formatCurrency(remaining)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={2} className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-emerald" />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading || hasError} className="h-10 px-5 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Record Purchase
            </button>
          </div>
        </form>
      </div>

      <SupplierFormDialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} onCreated={(s: Supplier) => setPendingSupplierId(s._id)} />
    </div>
  );
}
