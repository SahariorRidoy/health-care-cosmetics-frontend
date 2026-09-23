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
import type { Customer } from '@/features/sales/types';
import { useGetItemsQuery, useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

const lineSchema = z.object({
  item: z.string().min(1, 'Item required'),
  uom: z.string().min(1, 'UOM required'),
  qty: z.coerce.number().int('Qty must be a whole number').min(1, 'Qty > 0'),
  unitPrice: z.coerce.number().min(0, 'Price ≥ 0'),
  discount: z.coerce.number().min(0).max(100).default(0),
  description: z.string().optional(),
});

const orderSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
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

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [createOrder, { isLoading }] = useCreateSalesOrderMutation();
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [extraCustomers, setExtraCustomers] = useState<Customer[]>([]);
  const { data: customersData } = useGetCustomersQuery({ page: 1 });
  const { data: itemsData } = useGetItemsQuery({ page: 1, type: 'FINISHED_GOOD' });
  const { data: warehouseData } = useGetWarehousesQuery();

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      taxPercent: 0, payNow: false,
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
  const watchedPaymentAmount = useWatch({ control, name: 'paymentAmount' });

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
        items: values.items.map((l) => ({
          item: l.item, uom: l.uom, qty: l.qty,
          unitPrice: l.unitPrice, discount: l.discount, description: l.description,
        })),
        ...(values.paymentAmount > 0 ? {
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

  const customers = [...(customersData?.data?.customers?.filter((c) => c.isActive) ?? []), ...extraCustomers];
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
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-[2fr_60px_1fr_1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg bg-slate-50 border border-border">
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
                <FormField label="Qty" type="number" min={1} step="1" required error={errors.items?.[i]?.qty?.message} {...register(`items.${i}.qty`)} />
                <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" required error={errors.items?.[i]?.unitPrice?.message} {...register(`items.${i}.unitPrice`)} />
                <FormField label="Discount %" type="number" min={0} max={100} step="0.01" error={errors.items?.[i]?.discount?.message} {...register(`items.${i}.discount`)} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Total</span>
                  <div className="h-10 flex items-center">
                    <LineTotal qty={Number(watchedItems?.[i]?.qty)} price={Number(watchedItems?.[i]?.unitPrice)} discount={Number(watchedItems?.[i]?.discount)} />
                  </div>
                </div>
                <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="h-10 w-10 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 flex items-center justify-center self-end transition-colors disabled:opacity-0 disabled:pointer-events-none" aria-label="Remove line">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {errors.items?.root && <p className="text-[11px] text-red-500">{errors.items.root.message}</p>}
          </div>
        </div>

        {/* Order Details + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Left — Order Details */}
          <div className="bg-white rounded-lg border border-border divide-y divide-border">
            <div className="px-5 py-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Order Details</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Controller
                    control={control}
                    name="customer"
                    render={({ field }) => (
                      <SelectField label="Customer" required error={errors.customer?.message} {...field}>
                        <option value="">Select customer…</option>
                        {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </SelectField>
                    )}
                  />
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

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} rows={1} />
                </div>
                <div className="w-24 shrink-0">
                  <FormField label="Tax %" type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} {...register('taxPercent')} />
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-border pt-4 flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm text-secondary">
                    <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-secondary">
                    <span>Tax ({Number(watchedTax) || 0}%)</span><span>{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-2">
                    <span>Grand Total</span><span className="text-emerald-600 text-base">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Payment */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-border divide-y divide-border">
              <div className="px-5 py-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Payment</p>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <FormField
                  label="Amount (৳)"
                  type="number" min={0} step="0.01"
                  error={errors.paymentAmount?.message}
                  {...register('paymentAmount')}
                />
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <SelectField label="Payment Method" error={errors.paymentMethod?.message} {...field}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                    </SelectField>
                  )}
                />
                <FormField label="Reference" placeholder="Cheque no. / transaction ID…" {...register('paymentReference')} />
                {Number(watchedPaymentAmount) > 0 && (
                  <div className="border-t border-border pt-3 flex flex-col gap-1.5">
                    {Number(watchedPaymentAmount) >= grandTotal ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Change</span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(Number(watchedPaymentAmount) - grandTotal)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Due Balance</span>
                        <span className="font-semibold text-amber-600">{formatCurrency(grandTotal - Number(watchedPaymentAmount))}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button type="submit" disabled={isLoading} className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Create Sales Order
              </button>
              <button type="button" onClick={() => router.back()} className="h-10 px-4 rounded-md border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>


      </form>

      <CustomerFormDialog
        open={customerDialogOpen}
        onClose={(created) => {
          setCustomerDialogOpen(false);
          if (created) {
            setExtraCustomers((prev) => [...prev, created]);
            setValue('customer', created._id);
          }
        }}
      />
    </>
  );
}
