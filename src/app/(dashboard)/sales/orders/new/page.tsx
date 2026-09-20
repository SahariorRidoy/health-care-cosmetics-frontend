'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { CustomerFormDialog } from '@/features/sales/components/CustomerFormDialog';
import { formatCurrency } from '@/lib/formatters';
import { useCreateSalesOrderMutation, useGetCustomersQuery } from '@/features/sales/services/salesApi';
import { useGetItemsQuery, useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

const lineSchema = z.object({
  item: z.string().min(1, 'Item required'),
  uom: z.string().min(1, 'UOM required'),
  qty: z.coerce.number().min(0.001, 'Qty > 0'),
  unitPrice: z.coerce.number().min(0, 'Price ≥ 0'),
  discount: z.coerce.number().min(0).max(100).default(0),
  description: z.string().optional(),
});

const orderSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'DISPATCHED', 'CLOSED']).default('CONFIRMED'),
  items: z.array(lineSchema).min(1, 'Add at least one item'),
  payNow: z.boolean().default(false),
  paymentAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().default('CASH'),
  paymentReference: z.string().optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

function LineTotal({ qty, price, discount }: { qty: number; price: number; discount: number }) {
  const line = (qty || 0) * (price || 0) * (1 - (discount || 0) / 100);
  return <span className="text-sm text-secondary">{formatCurrency(line)}</span>;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [createOrder, { isLoading }] = useCreateSalesOrderMutation();
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const { data: customersData, refetch: refetchCustomers } = useGetCustomersQuery({ page: 1 });
  const { data: itemsData } = useGetItemsQuery({ page: 1, type: 'FINISHED_GOOD' });
  const { data: warehouseData } = useGetWarehousesQuery();

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      taxPercent: 0, status: 'CONFIRMED', payNow: false,
      paymentMethod: 'CASH', paymentAmount: 0,
      items: [{ item: '', uom: '', qty: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  useEffect(() => {
    if (warehouses.length > 0) setValue('warehouse', warehouses[0]._id);
  }, [warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedTax = useWatch({ control, name: 'taxPercent' });
  const watchedStatus = useWatch({ control, name: 'status' });
  const watchedPayNow = useWatch({ control, name: 'payNow' });

  const canPay = watchedStatus === 'DISPATCHED' || watchedStatus === 'CLOSED';

  function handleItemChange(index: number, itemId: string) {
    setValue(`items.${index}.item`, itemId);
    const found = items.find((it) => it._id === itemId);
    if (found) {
      if (found.salePrice) setValue(`items.${index}.unitPrice`, found.salePrice);
      const uomId = typeof found.baseUom === 'string' ? found.baseUom : found.baseUom._id;
      setValue(`items.${index}.uom`, uomId);
    }
  }

  const subtotal = watchedItems?.reduce((sum, l) => {
    return sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discount) || 0) / 100);
  }, 0) ?? 0;
  const taxAmount = subtotal * (Number(watchedTax) || 0) / 100;
  const grandTotal = subtotal + taxAmount;

  async function onSubmit(values: OrderForm) {
    try {
      const result = await createOrder({
        customer: values.customer,
        warehouse: values.warehouse,
        taxPercent: values.taxPercent,
        notes: values.notes,
        status: values.status,
        items: values.items.map((l) => ({
          item: l.item, uom: l.uom, qty: l.qty,
          unitPrice: l.unitPrice, discount: l.discount, description: l.description,
        })),
        ...(values.payNow && canPay && values.paymentAmount > 0 ? {
          payment: {
            amount: values.paymentAmount,
            method: values.paymentMethod,
            reference: values.paymentReference,
          },
        } : {}),
      }).unwrap();
      toast.success('Sales order created');
      router.push(`/sales/orders/${result.data.salesOrder._id}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create order';
      toast.error(msg);
    }
  }

  const customers = customersData?.data?.customers?.filter((c) => c.isActive) ?? [];
  const items = itemsData?.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="New Sales Order"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Orders', href: '/sales/orders' }, { label: 'New' }]}
        actions={
          <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SelectField label="Customer" required error={errors.customer?.message} {...register('customer')}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </SelectField>
            </div>
            <button
              type="button"
              onClick={() => setCustomerDialogOpen(true)}
              className="h-10 w-10 rounded-md bg-emerald hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors mb-[1px]"
              title="New customer" aria-label="Create new customer"
            >
              <Plus size={16} />
            </button>
          </div>

          <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </SelectField>

          <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <FormField label="Tax %" type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} {...register('taxPercent')} />
            </div>
            <div className="w-40">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <SelectField label="Status" error={errors.status?.message} {...field}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </SelectField>
                )}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
            <button
              type="button"
              onClick={() => append({ item: '', uom: '', qty: 1, unitPrice: 0, discount: 0 })}
              className="h-8 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} aria-hidden="true" /> Add Line
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg bg-slate-50 border border-border">
                <SelectField label="Item" required error={errors.items?.[i]?.item?.message} {...register(`items.${i}.item`)} onChange={(e) => handleItemChange(i, e.target.value)}>
                  <option value="">Select item…</option>
                  {items.map((it) => (
                    <option key={it._id} value={it._id}>
                      {it.name} ({it.sku}){it.currentStock === 0 ? ' ⚠ No stock' : ` — ${it.currentStock} in stock`}
                    </option>
                  ))}
                </SelectField>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">UOM</span>
                  <div className="h-10 flex items-center px-3 rounded-md border border-border bg-slate-50 text-sm text-secondary">
                    {watchedItems?.[i]?.uom
                      ? (() => { const it = items.find((x) => x._id === watchedItems[i].item); return typeof it?.baseUom === 'object' ? it.baseUom.symbol : watchedItems[i].uom; })()
                      : <span className="text-muted">—</span>}
                  </div>
                </div>
                <FormField label="Qty" type="number" min={0.001} step="0.001" required error={errors.items?.[i]?.qty?.message} {...register(`items.${i}.qty`)} />
                <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" required error={errors.items?.[i]?.unitPrice?.message} {...register(`items.${i}.unitPrice`)} />
                <FormField label="Discount %" type="number" min={0} max={100} step="0.01" error={errors.items?.[i]?.discount?.message} {...register(`items.${i}.discount`)} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Total</span>
                  <div className="h-10 flex items-center">
                    <LineTotal qty={Number(watchedItems?.[i]?.qty)} price={Number(watchedItems?.[i]?.unitPrice)} discount={Number(watchedItems?.[i]?.discount)} />
                  </div>
                </div>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="h-10 w-10 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 flex items-center justify-center self-end transition-colors" aria-label="Remove line">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {errors.items?.root && <p className="text-[11px] text-red-500">{errors.items.root.message}</p>}
          </div>

          <div className="px-4 py-3 border-t border-border flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8 text-secondary">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex gap-8 text-secondary">
              <span>Tax ({Number(watchedTax) || 0}%)</span><span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex gap-8 font-semibold text-foreground border-t border-border pt-1 mt-1">
              <span>Grand Total</span><span className="text-emerald-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment section — only for DISPATCHED / CLOSED */}
        {canPay && (
          <div className="bg-white rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="payNow"
                className="w-4 h-4 rounded border-border text-emerald accent-emerald cursor-pointer"
                {...register('payNow')}
              />
              <label htmlFor="payNow" className="text-sm font-semibold text-foreground cursor-pointer">
                Record Payment Now
              </label>
              <span className="text-xs text-muted">(optional — you can pay later from the order page)</span>
            </div>

            {watchedPayNow && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  label="Amount (৳)"
                  type="number"
                  min={0.01}
                  max={grandTotal}
                  step="0.01"
                  required
                  error={errors.paymentAmount?.message}
                  {...register('paymentAmount')}
                />
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <SelectField label="Payment Method" required error={errors.paymentMethod?.message} {...field}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                    </SelectField>
                  )}
                />
                <FormField label="Reference" placeholder="Cheque no. / transaction ID…" {...register('paymentReference')} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => router.back()} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" disabled={isLoading} className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Create Sales Order
          </button>
        </div>
      </form>

      <CustomerFormDialog
        open={customerDialogOpen}
        onClose={async (created) => {
          setCustomerDialogOpen(false);
          if (created) {
            await refetchCustomers();
            setValue('customer', created._id);
          }
        }}
      />
    </>
  );
}
