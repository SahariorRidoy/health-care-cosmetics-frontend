'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, Package, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';
import { createItemSchema, type ItemFormValues } from '@/features/inventory/schemas/itemSchema';
import { useCreateItemMutation, useGetUOMsQuery, useGetWarehousesQuery, useGenerateSkuQuery } from '@/features/inventory/services/inventoryApi';
import { useGetSuppliersQuery, useCreateSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import type { Supplier } from '@/features/procurement/types';

const ITEM_TYPES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKAGING', label: 'Packaging' },
];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'];

export default function NewPurchaseOrderPage() {
  const router = useRouter();

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);
  const [skuName, setSkuName] = useState('');

  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: supplierData } = useGetSuppliersQuery({ isActive: 'true' });
  const { data: skuData } = useGenerateSkuQuery(skuName, { skip: skuName.trim().length < 2 });

  const [createItem, { isLoading: creating }] = useCreateItemMutation();
  const [createPayment, { isLoading: paying }] = useCreateSupplierPaymentMutation();
  const isLoading = creating || paying;

  const uoms = uomData?.data?.uoms?.filter((u) => u.isActive) ?? [];
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  const suppliers = supplierData?.data?.suppliers ?? [];

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      type: 'RAW_MATERIAL',
      unitPrice: 0,
      quantity: 1,
      paidAmount: 0,
      paymentMethod: 'Cash',
      warehouse: '',
    },
  });

  useEffect(() => {
    if (skuData?.data?.sku) setValue('sku', skuData.data.sku);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuData]);

  useEffect(() => {
    const def = warehouseData?.data?.warehouses?.find((w) => w.isActive && w.isDefault)?._id;
    if (def) setValue('warehouse', def);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseData]);

  useEffect(() => {
    if (pendingSupplierId && supplierData) {
      const exists = supplierData.data?.suppliers?.find((s) => s._id === pendingSupplierId);
      if (exists) { setValue('supplier', pendingSupplierId); setPendingSupplierId(null); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierData, pendingSupplierId]);

  const quantity = useWatch({ control, name: 'quantity' });
  const unitPrice = useWatch({ control, name: 'unitPrice' });
  const paidAmount = useWatch({ control, name: 'paidAmount' });
  const totalPrice = (quantity && unitPrice) ? Number(quantity) * Number(unitPrice) : 0;
  const remaining = totalPrice - (Number(paidAmount) || 0);
  const isFullyPaid = totalPrice > 0 && remaining <= 0;

  async function onSubmit(values: ItemFormValues) {
    try {
      const result = await createItem(values).unwrap();
      const paid = Number(values.paidAmount) || 0;
      if (paid > 0 && values.supplier) {
        void result;
        await createPayment({
          supplier: values.supplier,
          amount: paid,
          paymentDate: new Date().toISOString(),
          method: values.paymentMethod ?? 'Cash',
          notes: `Initial payment for ${values.name}`,
        }).unwrap();
      }
      toast.success('Purchase recorded & stock updated');
      reset({ type: 'RAW_MATERIAL', unitPrice: 0, quantity: 1, paidAmount: 0, paymentMethod: 'Cash' });
      setSkuName('');
      router.push('/materials');
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Operation failed';
      toast.error(msg);
    }
  }

  return (
    <>
      <PageHeader
        title="New Raw Material Purchase"
        description="Record a new purchase and update stock"
        breadcrumbs={[{ label: 'Materials', href: '/materials' }, { label: 'New Purchase' }]}
        actions={
          <button
            onClick={() => router.back()}
            className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Left column ── */}
          <div className="flex flex-col gap-5">

            {/* Item Details */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-slate-50/60">
                <Package size={14} className="text-emerald shrink-0" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Item Details</p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Item Name"
                  required
                  placeholder="e.g. Aloe Vera Gel"
                  error={errors.name?.message}
                  {...register('name', {
                    onChange: (e) => {
                      const val: string = e.target.value;
                      clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer);
                      (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer = setTimeout(() => setSkuName(val), 500);
                    },
                  })}
                />
                <FormField
                  label="SKU"
                  placeholder="Auto-generated"
                  error={errors.sku?.message}
                  {...register('sku')}
                />
                <SelectField label="Type" required error={errors.type?.message} {...register('type')}>
                  <option value="">Select type…</option>
                  {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </SelectField>
                <SelectField label="Base UOM" required error={errors.baseUom?.message} {...register('baseUom')}>
                  <option value="">Select UOM…</option>
                  {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
                </SelectField>
                <div className="sm:col-span-2">
                  <TextareaField
                    label="Description"
                    placeholder="Optional notes about this item…"
                    rows={2}
                    {...register('description')}
                  />
                </div>
              </div>
            </div>

            {/* Purchase Details */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-slate-50/60">
                <ShoppingCart size={14} className="text-emerald shrink-0" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Purchase Details</p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Supplier */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      className={`flex-1 h-10 rounded-md border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald transition-colors ${errors.supplier ? 'border-red-500' : 'border-border'}`}
                      {...register('supplier')}
                    >
                      <option value="">Select supplier…</option>
                      {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setSupplierDialogOpen(true)}
                      className="h-10 w-10 rounded-md bg-emerald hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors"
                      title="Add new supplier"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {errors.supplier?.message && <p className="text-[11px] text-red-500">{errors.supplier.message}</p>}
                </div>

                <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </SelectField>

                <FormField
                  label="Quantity"
                  type="number"
                  min={0.001}
                  step="0.001"
                  required
                  error={errors.quantity?.message}
                  {...register('quantity')}
                />
                <FormField
                  label="Unit Price (৳)"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  error={errors.unitPrice?.message}
                  {...register('unitPrice')}
                />
                <div className="sm:col-span-2">
                  <FormField
                    label="Low Stock Qty"
                    type="number"
                    min={0}
                    step="1"
                    hint="Alert when stock falls at or below this qty"
                    error={errors.reorderLevel?.message}
                    {...register('reorderLevel')}
                  />
                </div>

                <div className="sm:col-span-2">
                  <TextareaField
                    label="Purchase Notes"
                    placeholder="Optional notes for this purchase…"
                    rows={2}
                    {...register('notes')}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── Right column — sticky summary ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">

            {/* Order Summary */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-slate-50/60">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Order Summary</p>
              </div>
              <div className="p-5 flex flex-col gap-3">

                {/* Payment fields */}
                <FormField
                  label="Paid Now (৳)"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00 — leave blank if unpaid"
                  error={errors.paidAmount?.message}
                  {...register('paidAmount')}
                />
                <SelectField label="Payment Method" {...register('paymentMethod')}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </SelectField>

                <div className="border-t border-border pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">Unit Price</span>
                    <span className="font-medium text-foreground">{formatCurrency(Number(unitPrice) || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">Quantity</span>
                    <span className="font-medium text-foreground">{Number(quantity) || 0}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm font-semibold text-foreground">Total Amount</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(totalPrice)}</span>
                  </div>

                  {totalPrice > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">Paid Now</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(Number(paidAmount) || 0)}</span>
                      </div>
                      <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${isFullyPaid ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
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

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 px-6 rounded-lg bg-emerald hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                {isLoading ? 'Recording…' : 'Record Purchase'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isLoading}
                className="h-10 px-4 rounded-lg border border-border text-sm text-secondary hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
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
