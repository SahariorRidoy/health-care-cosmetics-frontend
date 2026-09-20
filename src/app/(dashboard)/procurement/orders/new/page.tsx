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
import { useCreatePurchaseOrderMutation } from '@/features/procurement/services/procurementApi';
import { useGetSuppliersQuery } from '@/features/procurement/services/procurementApi';
import { useGetItemsQuery, useGetUOMsQuery } from '@/features/inventory/services/inventoryApi';

const lineSchema = z.object({
  item: z.string().min(1, 'Item required'),
  uom: z.string().min(1, 'UOM required'),
  orderedQty: z.coerce.number().min(0.001, 'Qty > 0'),
  unitPrice: z.coerce.number().min(0, 'Price ≥ 0'),
  description: z.string().optional(),
});

const poSchema = z.object({
  supplier: z.string().min(1, 'Supplier is required'),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'Add at least one item'),
});

type POForm = z.infer<typeof poSchema>;

function LineTotal({ qty, price }: { qty: number; price: number }) {
  return <span className="text-sm text-secondary">{formatCurrency((qty || 0) * (price || 0))}</span>;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [createPO, { isLoading }] = useCreatePurchaseOrderMutation();
  const { data: suppliersData } = useGetSuppliersQuery({ page: 1 });
  const { data: itemsData } = useGetItemsQuery({ page: 1, type: 'RAW_MATERIAL,PACKAGING' });
  const { data: uomData } = useGetUOMsQuery();

  const { register, control, handleSubmit, formState: { errors } } = useForm<POForm>({
    resolver: zodResolver(poSchema),
    defaultValues: { items: [{ item: '', uom: '', orderedQty: 1, unitPrice: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });

  const grandTotal = watchedItems?.reduce((sum, l) => sum + (Number(l.orderedQty) || 0) * (Number(l.unitPrice) || 0), 0) ?? 0;

  async function onSubmit(values: POForm) {
    try {
      const result = await createPO({
        ...values,
        expectedDeliveryDate: values.expectedDeliveryDate ? new Date(values.expectedDeliveryDate).toISOString() : undefined,
      }).unwrap();
      toast.success('Purchase order created');
      router.push(`/procurement/orders/${result.data.purchaseOrder._id}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create PO';
      toast.error(msg);
    }
  }

  const suppliers = suppliersData?.data?.suppliers?.filter((s) => s.isActive) ?? [];
  const items = itemsData?.data?.items ?? [];
  const uoms = uomData?.data?.uoms?.filter((u) => u.isActive) ?? [];

  return (
    <>
      <PageHeader
        title="New Purchase Order"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Orders', href: '/procurement/orders' }, { label: 'New' }]}
        actions={
          <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        {/* Header fields */}
        <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Supplier" required error={errors.supplier?.message} {...register('supplier')}>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </SelectField>
          <FormField label="Expected Delivery Date" type="date" error={errors.expectedDeliveryDate?.message} {...register('expectedDeliveryDate')} />
          <div className="col-span-full">
            <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
            <button type="button" onClick={() => append({ item: '', uom: '', orderedQty: 1, unitPrice: 0 })} className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <Plus size={13} aria-hidden="true" /> Add Line
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg bg-slate-50 border border-border">
                <SelectField label="Item" required error={errors.items?.[i]?.item?.message} {...register(`items.${i}.item`)}>
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it._id} value={it._id}>{it.name} ({it.sku})</option>)}
                </SelectField>
                <SelectField label="UOM" required error={errors.items?.[i]?.uom?.message} {...register(`items.${i}.uom`)}>
                  <option value="">UOM…</option>
                  {uoms.map((u) => <option key={u._id} value={u._id}>{u.symbol}</option>)}
                </SelectField>
                <FormField label="Qty" type="number" min={0.001} step="0.001" required error={errors.items?.[i]?.orderedQty?.message} {...register(`items.${i}.orderedQty`)} />
                <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" required error={errors.items?.[i]?.unitPrice?.message} {...register(`items.${i}.unitPrice`)} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Total</span>
                  <div className="h-10 flex items-center">
                    <LineTotal qty={Number(watchedItems?.[i]?.orderedQty)} price={Number(watchedItems?.[i]?.unitPrice)} />
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

          <div className="px-4 py-3 border-t border-border flex justify-end">
            <div className="text-sm font-semibold text-foreground">
              Grand Total: <span className="text-emerald-600 ml-2">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => router.back()} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" disabled={isLoading} className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Create Purchase Order
          </button>
        </div>
      </form>
    </>
  );
}
