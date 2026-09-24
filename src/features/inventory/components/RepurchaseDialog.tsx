'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, X, Plus } from 'lucide-react';
import { useGetWarehousesQuery, useRepurchaseItemMutation } from '../services/inventoryApi';
import { useGetSuppliersQuery, useCreateSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';
import type { Item } from '../types';
import type { Supplier } from '@/features/procurement/types';

const schema = z.object({
  supplier: z.string().min(1, 'Supplier is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  quantity: z.coerce.number().min(0.001, 'Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be 0 or more'),
  paidAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  preselectedItem?: Item | null;
  onClose: () => void;
}

export function RepurchaseDialog({ open, preselectedItem, onClose }: Props) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);

  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: supplierData } = useGetSuppliersQuery({ isActive: 'true' });

  const [repurchase, { isLoading: repurchasing }] = useRepurchaseItemMutation();
  const [createPayment, { isLoading: paying }] = useCreateSupplierPaymentMutation();
  const isLoading = repurchasing || paying;

  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  const suppliers = supplierData?.data?.suppliers ?? [];

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, unitPrice: 0, paidAmount: 0, paymentMethod: 'Cash' },
  });

  const quantity = useWatch({ control, name: 'quantity' });
  const unitPrice = useWatch({ control, name: 'unitPrice' });
  const paidAmount = useWatch({ control, name: 'paidAmount' });
  const uomSymbol = selectedItem && typeof selectedItem.baseUom === 'object'
    ? selectedItem.baseUom.symbol
    : 'units';
  const totalPrice = (quantity && unitPrice) ? Number(quantity) * Number(unitPrice) : 0;
  const remaining = totalPrice - (Number(paidAmount) || 0);

  // Initialise when dialog opens
  useEffect(() => {
    if (!open) return;
    const item = preselectedItem ?? null;
    setSelectedItem(item);
    const defaultWarehouse = warehouseData?.data?.warehouses?.find((w) => w.isActive && w.isDefault)?._id ?? '';
    const defaultSupplier = item?.supplier ? (typeof item.supplier === 'string' ? item.supplier : item.supplier._id) : '';
    reset({
      supplier: defaultSupplier,
      warehouse: defaultWarehouse,
      quantity: 1,
      unitPrice: item?.costPrice ?? 0,
      paidAmount: 0,
      paymentMethod: 'Cash',
      notes: '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedItem]);

  // Auto-select pending supplier after creation
  useEffect(() => {
    if (pendingSupplierId && supplierData) {
      const exists = supplierData.data?.suppliers?.find((s) => s._id === pendingSupplierId);
      if (exists) { setValue('supplier', pendingSupplierId); setPendingSupplierId(null); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierData, pendingSupplierId]);

  async function onSubmit(values: FormValues) {
    if (!selectedItem) { toast.error('Please select a material'); return; }
    try {
      await repurchase({
        id: selectedItem._id,
        supplier: values.supplier,
        warehouse: values.warehouse,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        paidAmount: values.paidAmount,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
      }).unwrap();

      const paid = Number(values.paidAmount) || 0;
      if (paid > 0) {
        await createPayment({
          supplier: values.supplier,
          amount: paid,
          paymentDate: new Date().toISOString(),
          method: values.paymentMethod ?? 'Cash',
          notes: values.notes || `Repurchase payment for ${selectedItem.name}`,
        }).unwrap();
      }

      toast.success(`Repurchase recorded — stock updated for ${selectedItem.name}`);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Operation failed';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Repurchase material"
        className="relative w-full sm:max-w-xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Repurchase Material</h2>
            <p className="text-xs text-secondary mt-0.5">Add stock to an existing material</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 space-y-4">

            {/* Fixed single-item restock section */}
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-200 bg-emerald-50">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Restock Item</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">This restock applies only to the selected material.</p>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{selectedItem?.name ?? 'Selected material unavailable'}</p>
                  {selectedItem && <p className="text-xs text-secondary mt-0.5">SKU: {selectedItem.sku} · Type: {selectedItem.type} · UOM: {uomSymbol}</p>}
                </div>
                {selectedItem && <span className="text-xs font-semibold text-emerald-800 shrink-0">Stock: {selectedItem.currentStock} {uomSymbol}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Supplier */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Supplier <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    className={`flex-1 h-10 rounded-md border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald ${errors.supplier ? 'border-red-500' : 'border-border'}`}
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

              <FormField label={`Quantity (${uomSymbol})`} type="number" min={0.001} step="0.001" required error={errors.quantity?.message} {...register('quantity')} />
              <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" required error={errors.unitPrice?.message} {...register('unitPrice')} />
            </div>

            {/* Total */}
            {totalPrice > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-border">
                <span className="text-sm font-medium text-foreground">Total Amount</span>
                <span className="text-base font-semibold text-foreground">{formatCurrency(totalPrice)}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Paid Now (৳)" type="number" min={0} step="0.01" placeholder="0.00 — leave blank if unpaid" error={errors.paidAmount?.message} {...register('paidAmount')} />
              <SelectField label="Payment Method" {...register('paymentMethod')}>
                {['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
              </SelectField>
            </div>

            {/* Remaining due */}
            {totalPrice > 0 && (
              <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${remaining > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <span className="text-sm font-medium">{remaining > 0 ? 'Remaining Due' : 'Fully Paid'}</span>
                <span className={`text-base font-semibold ${remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {remaining > 0 ? formatCurrency(remaining) : '✓ Paid'}
                </span>
              </div>
            )}

            <TextareaField label="Notes" placeholder="Optional notes for this repurchase…" {...register('notes')} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading || !selectedItem} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Record Repurchase
            </button>
          </div>
        </form>
      </div>

      <SupplierFormDialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        onCreated={(supplier: Supplier) => setPendingSupplierId(supplier._id)}
      />
    </div>
  );
}
