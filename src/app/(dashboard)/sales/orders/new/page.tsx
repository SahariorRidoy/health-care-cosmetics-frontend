'use client';

import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';
import { useCreateSalesOrderMutation } from '@/features/sales/services/salesApi';
import { useGetCustomersQuery } from '@/features/sales/services/salesApi';
import { useGetItemsQuery, useGetUOMsQuery, useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';

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
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'Add at least one item'),
});

type OrderForm = z.infer<typeof orderSchema>;

function LineTotal({ qty, price, discount }: { qty: number; price: number; discount: number }) {
  const line = (qty || 0) * (price || 0) * (1 - (discount || 0) / 100);
  return <span className="text-sm text-secondary">{formatCurrency(line)}</span>;
}

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [createOrder, { isLoading }] = useCreateSalesOrderMutation();
  const { data: customersData } = useGetCustomersQuery({ page: 1 });
  const { data: itemsData } = useGetItemsQuery({ page: 1 });
  const { data: uomData } = useGetUOMsQuery();
  const { data: warehouseData } = useGetWarehousesQuery();

  const { register, control, handleSubmit, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { taxPercent: 0, items: [{ item: '', uom: '', qty: 1, unitPrice: 0, discount: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedTax = useWatch({ control, name: 'taxPercent' });

  const subtotal = watchedItems?.reduce((sum, l) => {
    const line = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discount) || 0) / 100);
    return sum + line;
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
        deliveryDate: values.deliveryDate ? new Date(values.deliveryDate).toISOString() : undefined,
        items: values.items.map((l) => ({
          item: l.item,
          uom: l.uom,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discount: l.discount,
          description: l.description,
        })),
      }).unwrap();
      toast.success('Sales order created');
      router.push(`/sales/orders/${result.data.salesOrder._id}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create order';
      toast.error(msg);
    }
  }

  const customers = customersData?.data?.customers?.filter((c) => c.isActive) ?? [];
  const items = itemsData?.data ?? [];
  const uoms = uomData?.data?.filter((u) => u.isActive) ?? [];
  const warehouses = warehouseData?.data?.filter((w) => w.isActive) ?? [];

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
          <SelectField label="Customer" required error={errors.customer?.message} {...register('customer')}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </SelectField>
          <FormField label="Tax %" type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} {...register('taxPercent')} />
          <FormField label="Delivery Date" type="date" error={errors.deliveryDate?.message} {...register('deliveryDate')} />
          <div className="col-span-full">
            <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
            <button
              type="button"
              onClick={() => append({ item: '', uom: '', qty: 1, unitPrice: 0, discount: 0 })}
              className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} aria-hidden="true" /> Add Line
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg bg-slate-50 border border-border">
                <SelectField label="Item" required error={errors.items?.[i]?.item?.message} {...register(`items.${i}.item`)}>
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it._id} value={it._id}>{it.name} ({it.sku})</option>)}
                </SelectField>
                <SelectField label="UOM" required error={errors.items?.[i]?.uom?.message} {...register(`items.${i}.uom`)}>
                  <option value="">UOM…</option>
                  {uoms.map((u) => <option key={u._id} value={u._id}>{u.symbol}</option>)}
                </SelectField>
                <FormField label="Qty" type="number" min={0.001} step="0.001" required error={errors.items?.[i]?.qty?.message} {...register(`items.${i}.qty`)} />
                <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" required error={errors.items?.[i]?.unitPrice?.message} {...register(`items.${i}.unitPrice`)} />
                <FormField label="Discount %" type="number" min={0} max={100} step="0.01" error={errors.items?.[i]?.discount?.message} {...register(`items.${i}.discount`)} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Total</span>
                  <div className="h-10 flex items-center">
                    <LineTotal
                      qty={Number(watchedItems?.[i]?.qty)}
                      price={Number(watchedItems?.[i]?.unitPrice)}
                      discount={Number(watchedItems?.[i]?.discount)}
                    />
                  </div>
                </div>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="h-10 w-10 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 flex items-center justify-center self-end transition-colors"
                    aria-label="Remove line"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {errors.items?.root && <p className="text-[11px] text-red-500">{errors.items.root.message}</p>}
          </div>

          <div className="px-4 py-3 border-t border-border flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8 text-secondary">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex gap-8 text-secondary">
              <span>Tax ({Number(watchedTax) || 0}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex gap-8 font-semibold text-foreground border-t border-border pt-1 mt-1">
              <span>Grand Total</span>
              <span className="text-emerald-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => router.back()} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" disabled={isLoading} className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Create Sales Order
          </button>
        </div>
      </form>
    </>
  );
}
