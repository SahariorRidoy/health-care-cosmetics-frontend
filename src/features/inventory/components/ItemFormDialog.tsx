'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { createItemSchema, editItemSchema, type ItemFormValues } from '../schemas/itemSchema';
import { useCreateItemMutation, useUpdateItemMutation, useGetUOMsQuery, useGetWarehousesQuery, useCreateAdjustmentMutation, useGenerateSkuQuery } from '../services/inventoryApi';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useGetSuppliersQuery, useCreateSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import { formatCurrency } from '@/lib/formatters';
import type { Item } from '../types';

const ITEM_TYPES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKAGING', label: 'Packaging' },
];

interface ItemFormDialogProps {
  open: boolean;
  item?: Item | null;
  onClose: () => void;
}

export function ItemFormDialog({ open, item, onClose }: ItemFormDialogProps) {
  const isEdit = !!item;
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: supplierData } = useGetSuppliersQuery({ isActive: 'true' });
  const [createItem, { isLoading: creating }] = useCreateItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateItemMutation();
  const [createAdjustment, { isLoading: adjusting }] = useCreateAdjustmentMutation();
  const [createPayment, { isLoading: paying }] = useCreateSupplierPaymentMutation();
  const isLoading = creating || updating || adjusting || paying;

  const [skuName, setSkuName] = useState('');
  const { data: skuData } = useGenerateSkuQuery(skuName, { skip: isEdit || skuName.trim().length < 2 });

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(isEdit ? editItemSchema : createItemSchema),
  });

  // Auto-fill SKU when API returns a suggestion
  useEffect(() => {
    if (!isEdit && skuData?.data?.sku) setValue('sku', skuData.data.sku);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuData]);

  const quantity = useWatch({ control, name: 'quantity' });
  const unitPrice = useWatch({ control, name: 'unitPrice' });
  const paidAmount = useWatch({ control, name: 'paidAmount' });
  const totalPrice = (!isEdit && quantity && unitPrice) ? Number(quantity) * Number(unitPrice) : 0;
  const remaining = totalPrice - (Number(paidAmount) || 0);

  useEffect(() => {
    if (open) {
      reset(item
        ? {
            name: item.name,
            sku: item.sku,
            type: item.type,
            description: item.description ?? '',
            baseUom: typeof item.baseUom === 'string' ? item.baseUom : item.baseUom._id,
            supplier: typeof item.supplier === 'string' ? item.supplier : item.supplier?._id ?? '',
            notes: '',
            adjustQty: undefined,
            adjustWarehouse: '',
            adjustNotes: '',
          }
        : { type: 'RAW_MATERIAL', unitPrice: 0, quantity: 1, paidAmount: 0 },
      );
    }
  }, [open, item, reset]);

  async function onSubmit(values: ItemFormValues) {
    try {
      if (isEdit) {
        await updateItem({ id: item._id, body: { name: values.name, sku: values.sku, type: values.type, description: values.description, baseUom: values.baseUom, supplier: values.supplier } }).unwrap();
        if (values.adjustQty && values.adjustQty !== 0 && values.adjustWarehouse) {
          await createAdjustment({ item: item._id, warehouse: values.adjustWarehouse, quantity: values.adjustQty, notes: values.adjustNotes }).unwrap();
        }
        toast.success('Item updated');
      } else {
        const result = await createItem(values).unwrap();
        const paid = Number(values.paidAmount) || 0;
        if (paid > 0 && values.supplier) {
          const itemData = result.data?.item as { supplier?: string } | undefined;
          void itemData;
          await createPayment({
            supplier: values.supplier,
            amount: paid,
            paymentDate: new Date().toISOString(),
            method: values.paymentMethod ?? 'Cash',
            notes: `Initial payment for ${values.name}`,
          }).unwrap();
        }
        toast.success('Purchase recorded & stock updated');
      }
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Operation failed';
      toast.error(msg);
    }
  }

  if (!open) return null;

  const uoms = uomData?.data?.uoms?.filter((u) => u.isActive) ?? [];
  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  const suppliers = supplierData?.data?.suppliers ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit item' : 'New purchase'}
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Item' : 'New Raw Material Purchase'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 space-y-4">

            {/* Item details */}
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Item Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Item Name" required placeholder="e.g. Aloe Vera Gel"
                error={errors.name?.message}
                {...register('name', {
                  onChange: (e) => {
                    const val: string = e.target.value;
                    if (!isEdit) {
                      clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer);
                      (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._skuTimer = setTimeout(() => setSkuName(val), 500);
                    }
                  },
                })}
              />
              <FormField label="SKU" required={isEdit} placeholder={isEdit ? '' : 'Auto-generated'} readOnly={!isEdit} error={errors.sku?.message} className={!isEdit ? 'bg-slate-50 text-secondary' : ''} {...register('sku')} />
              <SelectField label="Type" required error={errors.type?.message} {...register('type')}>
                <option value="">Select type…</option>
                {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectField>
              <SelectField label="Base UOM" required error={errors.baseUom?.message} {...register('baseUom')}>
                <option value="">Select UOM…</option>
                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
              </SelectField>
              <div className="col-span-full">
                <TextareaField label="Description" placeholder="Optional notes about this item" {...register('description')} />
              </div>
            </div>

            {/* Purchase details — only on create */}
            {!isEdit && (
              <>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-2">Purchase Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField label="Supplier" required error={errors.supplier?.message} {...register('supplier')}>
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </SelectField>
                  <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </SelectField>
                  <FormField label="Quantity" type="number" min={1} step="1" required error={errors.quantity?.message} {...register('quantity')} />
                  <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" required error={errors.unitPrice?.message} {...register('unitPrice')} />

                  {/* Live total */}
                  {totalPrice > 0 && (
                    <div className="col-span-full flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-border">
                      <span className="text-sm font-medium text-foreground">Total Amount</span>
                      <span className="text-base font-semibold text-foreground">{formatCurrency(totalPrice)}</span>
                    </div>
                  )}

                  <FormField label="Paid Now (৳)" type="number" min={0} step="0.01" placeholder="0.00 — leave blank if unpaid" error={errors.paidAmount?.message} {...register('paidAmount')} />
                  <SelectField label="Payment Method" {...register('paymentMethod')}>
                    {['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </SelectField>

                  {/* Remaining due */}
                  {totalPrice > 0 && (
                    <div className={`col-span-full flex items-center justify-between px-4 py-3 rounded-lg border ${
                      remaining > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <span className="text-sm font-medium">{remaining > 0 ? 'Remaining Due' : 'Fully Paid'}</span>
                      <span className={`text-base font-semibold ${remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {remaining > 0 ? formatCurrency(remaining) : '✓ Paid'}
                      </span>
                    </div>
                  )}

                  <div className="col-span-full">
                    <TextareaField label="Purchase Notes" placeholder="Optional notes for this purchase…" {...register('notes')} />
                  </div>
                </div>
              </>
            )}

            {/* Supplier select on edit */}
            {isEdit && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField label="Supplier" error={errors.supplier?.message} {...register('supplier')}>
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </SelectField>
              </div>
            )}

            {/* Stock adjustment — edit only */}
            {isEdit && (
              <>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-2">Stock Adjustment <span className="normal-case font-normal text-muted">(optional)</span></p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField label="Warehouse" error={errors.adjustWarehouse?.message} {...register('adjustWarehouse')}>
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </SelectField>
                  <FormField
                    label="Adjustment Qty"
                    type="number"
                    step="1"
                    placeholder="e.g. 10 or -5"
                    error={errors.adjustQty?.message}
                    {...register('adjustQty')}
                  />
                  <div className="col-span-full">
                    <TextareaField label="Adjustment Notes" placeholder="Reason for adjustment…" {...register('adjustNotes')} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Record Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
