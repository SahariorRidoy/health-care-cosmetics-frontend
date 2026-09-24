'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, Trash2, Search, AlertCircle, Package, ShoppingCart, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCurrency } from '@/lib/formatters';
import { useGetItemsQuery, useGetWarehousesQuery, useGetUOMsQuery, useGenerateSkuQuery, useBulkPurchaseItemsMutation } from '@/features/inventory/services/inventoryApi';
import { useGetSuppliersQuery, useGetSupplierDuesQuery, useCreateSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import type { Item } from '@/features/inventory/types';
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

function makeExistingLine(): ExistingLine {
  return { id: crypto.randomUUID(), mode: 'existing', item: null, search: '', dropdownOpen: false, quantity: 1, unitPrice: 0, reorderLevel: 0 };
}
function makeNewLine(): NewLine {
  return { id: crypto.randomUUID(), mode: 'new', name: '', sku: '', skuTrigger: '', type: 'RAW_MATERIAL', baseUom: '', description: '', quantity: 1, unitPrice: 0, reorderLevel: 0 };
}

function SkuAutoFill({ trigger, onSku }: { trigger: string; onSku: (sku: string) => void }) {
  const { data } = useGenerateSkuQuery(trigger, { skip: trigger.trim().length < 2 });
  useEffect(() => { if (data?.data?.sku) onSku(data.data.sku); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();

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
    const def = warehouseData?.data?.warehouses?.find((w) => w.isActive && w.isDefault)?._id;
    if (def && !warehouseId) setWarehouseId(def);
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
      if (l.mode === 'existing') return { ...makeNewLine(), id };
      return { ...makeExistingLine(), id };
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
  const isFullyPaid = subtotal > 0 && remaining <= 0;

  const lineErrors = lines.some((l) => l.mode === 'existing' ? !l.item : (!l.name || !l.baseUom));
  const hasError = !supplierId || !warehouseId || lineErrors;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError) { toast.error('Please fill all required fields'); return; }
    try {
      await bulkPurchase({
        supplier: supplierId,
        warehouse: warehouseId,
        items: lines.map((l) => l.mode === 'existing'
          ? { mode: 'existing' as const, item: l.item!._id, quantity: l.quantity, unitPrice: l.unitPrice, reorderLevel: l.reorderLevel || undefined }
          : { mode: 'new' as const, name: l.name, sku: l.sku || undefined, type: l.type, baseUom: l.baseUom, description: l.description || undefined, quantity: l.quantity, unitPrice: l.unitPrice, reorderLevel: l.reorderLevel || undefined },
        ),
        paidAmount,
        paymentMethod,
        notes: notes || undefined,
      }).unwrap();

      if ((paidAmount || 0) > 0) {
        await createPayment({
          supplier: supplierId, amount: paidAmount,
          paymentDate: new Date().toISOString(), method: paymentMethod,
          notes: notes || 'Payment for purchase order',
        }).unwrap();
      }

      toast.success(`Purchase recorded — ${lines.length} item${lines.length > 1 ? 's' : ''} stock updated`);
      router.push('/materials');
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Operation failed');
    }
  }

  return (
    <>
      <PageHeader
        title="New Purchase Order"
        description="Purchase one or more materials in a single order"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'New Purchase Order' }]}
        actions={
          <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <ArrowLeft size={15} /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* Left */}
          <div className="flex flex-col gap-5">

            {/* Supplier & Warehouse */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-slate-50/60">
                <ShoppingCart size={14} className="text-emerald shrink-0" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Order Details</p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-foreground">Supplier <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="flex-1 h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                    >
                      <option value="">Select supplier…</option>
                      {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setSupplierDialogOpen(true)} className="h-10 w-10 rounded-md bg-emerald hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors" title="Add new supplier">
                      <Plus size={16} />
                    </button>
                  </div>
                  {supplierId && supplierDue > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      <AlertCircle size={12} className="shrink-0" />
                      Outstanding due: <span className="font-semibold">{formatCurrency(supplierDue)}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-foreground">Warehouse <span className="text-red-500">*</span></label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-bold text-foreground block mb-1">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={2} className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-emerald" />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-slate-50/60">
                <Package size={14} className="text-emerald shrink-0" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Items</p>
              </div>

              <div className="p-5 flex flex-col gap-4">

                {lines.map((line, idx) => (
                  <div key={line.id} className={`rounded-lg border-2 overflow-hidden ${
                    line.mode === 'existing' ? 'border-emerald-200 bg-emerald-50/20' : 'border-violet-200 bg-violet-50/20'
                  }`}>
                    {/* Line header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b-2 ${
                      line.mode === 'existing' ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-base font-bold ${
                          line.mode === 'existing' ? 'text-emerald-700' : 'text-violet-700'
                        }`}>Item {idx + 1}</span>
                        <div className="flex items-center rounded-lg border overflow-hidden text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => line.mode === 'new' && toggleMode(line.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                              line.mode === 'existing'
                                ? 'bg-emerald text-white'
                                : 'bg-white text-secondary hover:bg-slate-50'
                            }`}
                          >
                            <Search size={11} /> Existing
                          </button>
                          <button
                            type="button"
                            onClick={() => line.mode === 'existing' && toggleMode(line.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                              line.mode === 'new'
                                ? 'bg-violet-600 text-white'
                                : 'bg-white text-secondary hover:bg-slate-50'
                            }`}
                          >
                            <Plus size={11} /> New Item
                          </button>
                        </div>
                      </div>
                      <button type="button" onClick={() => setLines((p) => p.filter((l) => l.id !== line.id))} disabled={lines.length === 1} className="h-7 w-7 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 disabled:opacity-30 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      {line.mode === 'existing' ? (
                        <>
                          {/* Row: material (half) + qty + unit price */}
                          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
                            <div className="flex flex-col gap-1" ref={(el) => { dropdownRefs.current[line.id] = el; }}>
                              <label className="text-sm font-bold text-foreground">Material <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                                <input
                                  type="text"
                                  value={line.search}
                                  onChange={(e) => { setItemSearch(e.target.value); updateLine(line.id, { search: e.target.value, item: null, dropdownOpen: true } as Partial<ExistingLine>); }}
                                  onFocus={() => { setItemSearch(line.search); updateLine(line.id, { dropdownOpen: true } as Partial<ExistingLine>); }}
                                  placeholder="Search by name or SKU…"
                                  className={`w-full h-10 rounded-md border bg-white pl-9 pr-9 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald ${line.item ? 'border-emerald-300' : 'border-border'}`}
                                />
                                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                              </div>
                              {line.dropdownOpen && existingItems.length > 0 && (
                                <div className="border border-border rounded-md bg-white shadow-lg max-h-48 overflow-y-auto z-20">
                                  {existingItems.map((it) => (
                                    <button key={it._id} type="button" onClick={() => selectExistingItem(line.id, it)} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 border-b border-border last:border-0">
                                      <div>
                                        <p className="text-sm font-medium text-foreground">{it.name}</p>
                                        <p className="text-xs text-secondary">{it.sku} · {typeof it.baseUom === 'object' ? it.baseUom.symbol : ''}</p>
                                      </div>
                                      <span className="text-xs text-secondary shrink-0">Stock: {it.currentStock}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {line.item && (
                                <p className="text-[11px] text-emerald-600">SKU: {line.item.sku} · Type: {line.item.type} · UOM: {typeof line.item.baseUom === 'object' ? line.item.baseUom.symbol : '—'}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-bold text-foreground">Quantity <span className="text-red-500">*</span></label>
                                <input type="number" min={0.001} step="0.001" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-sm font-bold text-foreground">Unit Price (৳) <span className="text-red-500">*</span></label>
                                <input type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                              </div>
                            </div>
                          {line.quantity > 0 && line.unitPrice > 0 && (
                            <div className="flex items-center justify-end px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                              <span className="text-secondary mr-2">Line Total</span>
                              <span className="font-semibold text-emerald-700">{formatCurrency(line.quantity * line.unitPrice)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <SkuAutoFill trigger={line.skuTrigger} onSku={(sku) => updateLine(line.id, { sku } as Partial<NewLine>)} />
                          {/* Row 1: name (half) + SKU + type */}
                          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">Item Name <span className="text-red-500">*</span></label>
                              <input type="text" value={line.name} onChange={(e) => { const v = e.target.value; clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer); (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer = setTimeout(() => updateLine(line.id, { skuTrigger: v } as Partial<NewLine>), 500); updateLine(line.id, { name: v } as Partial<NewLine>); }} placeholder="e.g. Aloe Vera Gel" className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">SKU</label>
                              <input type="text" value={line.sku} onChange={(e) => updateLine(line.id, { sku: e.target.value } as Partial<NewLine>)} placeholder="Auto-generated" className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">Type <span className="text-red-500">*</span></label>
                              <select value={line.type} onChange={(e) => updateLine(line.id, { type: e.target.value } as Partial<NewLine>)} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                                {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                          </div>
                          {/* Row 2: base UOM + qty + unit price + low stock qty */}
                          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">Base UOM <span className="text-red-500">*</span></label>
                              <select value={line.baseUom} onChange={(e) => updateLine(line.id, { baseUom: e.target.value } as Partial<NewLine>)} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald">
                                <option value="">Select UOM…</option>
                                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">Quantity <span className="text-red-500">*</span></label>
                              <input type="number" min={0.001} step="0.001" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">Unit Price (৳) <span className="text-red-500">*</span></label>
                              <input type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })} className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-bold text-amber-600">Low Stock Qty</label>
                              <input type="number" min={0} step="1" value={line.reorderLevel} onChange={(e) => updateLine(line.id, { reorderLevel: Number(e.target.value) })} placeholder="0" className="h-10 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400" />
                            </div>
                          </div>
                          {/* Row 3: description + line total */}
                          <div className="flex items-end gap-3">
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-sm font-bold text-foreground">Description</label>
                              <input type="text" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value } as Partial<NewLine>)} placeholder="Optional description" className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald" />
                            </div>
                            {line.quantity > 0 && line.unitPrice > 0 && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-sm shrink-0 h-10">
                                <span className="text-secondary">Total</span>
                                <span className="font-semibold text-violet-700">{formatCurrency(line.quantity * line.unitPrice)}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add another buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, makeExistingLine()])}
                    className="flex-1 h-10 rounded-lg border-2 border-emerald bg-emerald-50 text-emerald-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
                  >
                    <Plus size={15} /> Add Existing Item
                  </button>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, makeNewLine()])}
                    className="flex-1 h-10 rounded-lg border-2 border-violet-400 bg-violet-50 text-violet-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-100 transition-colors"
                  >
                    <Plus size={15} /> Add New Item
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Right — sticky summary */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-slate-50/60">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Order Summary</p>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">Paid Now (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    placeholder="0.00 — leave blank if unpaid"
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                  >
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="border-t border-border pt-3 flex flex-col gap-2">
                  {lines.filter((l) => l.mode === 'existing' ? (l.item && l.quantity > 0 && l.unitPrice > 0) : (l.name && l.quantity > 0 && l.unitPrice > 0)).map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs text-secondary">
                      <span className="truncate max-w-[140px]">{l.mode === 'existing' ? l.item!.name : l.name}</span>
                      <span>{formatCurrency(l.quantity * l.unitPrice)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(subtotal)}</span>
                  </div>
                  {subtotal > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">Paid Now</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(paidAmount || 0)}</span>
                      </div>
                      <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${isFullyPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <span className={`text-sm font-medium ${isFullyPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {isFullyPaid ? 'Fully Paid' : 'Remaining Due'}
                        </span>
                        <span className={`text-base font-bold ${isFullyPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {isFullyPaid ? '✓ Paid' : formatCurrency(remaining)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isLoading || hasError}
                className="h-11 px-6 rounded-lg bg-emerald hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading && <Loader2 size={15} className="animate-spin" />}
                {isLoading ? 'Recording…' : 'Record Purchase'}
              </button>
              <button type="button" onClick={() => router.back()} disabled={isLoading} className="h-10 px-4 rounded-lg border border-border text-sm text-secondary hover:bg-slate-50 disabled:opacity-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>

      <SupplierFormDialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        onCreated={(supplier: Supplier) => setPendingSupplierId(supplier._id)}
      />
    </>
  );
}
