'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateProductionOrderMutation, useGetBOMsQuery } from '@/features/production/services/productionApi';
import { useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';
import type { BOM } from '@/features/production/types';

const orderSchema = z.object({
  bom: z.string().min(1, 'BOM is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  plannedQty: z.coerce.number().min(0.001, 'Planned qty > 0'),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

export default function NewProductionOrderPage() {
  const router = useRouter();
  const [createOrder, { isLoading }] = useCreateProductionOrderMutation();
  const { data: bomsData } = useGetBOMsQuery({ isActive: 'true' });
  const { data: warehousesData } = useGetWarehousesQuery();

  const { register, handleSubmit, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { plannedQty: 1 },
  });

  const boms = bomsData?.data?.boms?.filter((b) => b.isActive) ?? [];
  const warehouses = warehousesData?.data ?? [];

  async function onSubmit(values: OrderForm) {
    try {
      const result = await createOrder({
        ...values,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
      }).unwrap();
      toast.success('Production order created');
      router.push(`/production/orders/${result.data.productionOrder._id}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create order';
      toast.error(msg);
    }
  }

  return (
    <>
      <PageHeader
        title="New Production Order"
        breadcrumbs={[
          { label: 'Production' },
          { label: 'Orders', href: '/production/orders' },
          { label: 'New' },
        ]}
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
        <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Bill of Materials" required error={errors.bom?.message} {...register('bom')}>
            <option value="">Select BOM…</option>
            {boms.map((b: BOM) => {
              const product = typeof b.product === 'string' ? b.product : (b.product as { name: string }).name;
              return <option key={b._id} value={b._id}>{product} — {b.version}</option>;
            })}
          </SelectField>
          <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </SelectField>
          <FormField
            label="Planned Qty"
            type="number" min={0.001} step="0.001"
            required
            error={errors.plannedQty?.message}
            {...register('plannedQty')}
          />
          <FormField
            label="Start Date"
            type="date"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <div className="col-span-full">
            <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Create Production Order
          </button>
        </div>
      </form>
    </>
  );
}
