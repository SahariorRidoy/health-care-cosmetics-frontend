'use client';

import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateBOMMutation } from '@/features/production/services/productionApi';
import { useGetItemsQuery, useGetUOMsQuery } from '@/features/inventory/services/inventoryApi';

const materialSchema = z.object({
  item: z.string().min(1, 'Item required'),
  qty: z.coerce.number().min(0.001, 'Qty > 0'),
  uom: z.string().min(1, 'UOM required'),
});

const bomSchema = z.object({
  product: z.string().min(1, 'Product is required'),
  version: z.string().min(1, 'Version is required').default('v1'),
  expectedOutputQty: z.coerce.number().min(0.001, 'Output qty > 0'),
  outputUom: z.string().min(1, 'Output UOM is required'),
  wastagePercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  inputMaterials: z.array(materialSchema).min(1, 'Add at least one material'),
});

type BOMForm = z.infer<typeof bomSchema>;

export default function NewBOMPage() {
  const router = useRouter();
  const [createBOM, { isLoading }] = useCreateBOMMutation();
  const { data: itemsData } = useGetItemsQuery({ page: 1 });
  const { data: uomData } = useGetUOMsQuery();

  const { register, control, handleSubmit, formState: { errors } } = useForm<BOMForm>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      version: 'v1',
      wastagePercent: 0,
      inputMaterials: [{ item: '', qty: 1, uom: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'inputMaterials' });

  const items = itemsData?.data ?? [];
  const uoms = uomData?.data?.filter((u) => u.isActive) ?? [];

  async function onSubmit(values: BOMForm) {
    try {
      const result = await createBOM(values).unwrap();
      toast.success('BOM created');
      router.push(`/production/boms/${result.data.bom._id}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create BOM';
      toast.error(msg);
    }
  }

  return (
    <>
      <PageHeader
        title="New Bill of Materials"
        breadcrumbs={[
          { label: 'Production' },
          { label: 'BOMs', href: '/production/boms' },
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

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        {/* Header fields */}
        <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Product (Finished Good)" required error={errors.product?.message} {...register('product')}>
            <option value="">Select product…</option>
            {items.map((it) => <option key={it._id} value={it._id}>{it.name} ({it.sku})</option>)}
          </SelectField>
          <FormField label="Version" required error={errors.version?.message} {...register('version')} />
          <FormField
            label="Expected Output Qty"
            type="number" min={0.001} step="0.001"
            required
            error={errors.expectedOutputQty?.message}
            {...register('expectedOutputQty')}
          />
          <SelectField label="Output UOM" required error={errors.outputUom?.message} {...register('outputUom')}>
            <option value="">Select UOM…</option>
            {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
          </SelectField>
          <FormField
            label="Wastage %"
            type="number" min={0} max={100} step="0.01"
            error={errors.wastagePercent?.message}
            {...register('wastagePercent')}
          />
          <div className="col-span-full">
            <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
          </div>
        </div>

        {/* Input materials */}
        <div className="bg-white rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Input Materials</h2>
            <button
              type="button"
              onClick={() => append({ item: '', qty: 1, uom: '' })}
              className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} aria-hidden="true" /> Add Material
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {fields.map((field, i) => (
              <div
                key={field.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg bg-slate-50 border border-border"
              >
                <SelectField label="Material Item" required error={errors.inputMaterials?.[i]?.item?.message} {...register(`inputMaterials.${i}.item`)}>
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it._id} value={it._id}>{it.name} ({it.sku})</option>)}
                </SelectField>
                <FormField
                  label="Qty"
                  type="number" min={0.001} step="0.001"
                  required
                  error={errors.inputMaterials?.[i]?.qty?.message}
                  {...register(`inputMaterials.${i}.qty`)}
                />
                <SelectField label="UOM" required error={errors.inputMaterials?.[i]?.uom?.message} {...register(`inputMaterials.${i}.uom`)}>
                  <option value="">UOM…</option>
                  {uoms.map((u) => <option key={u._id} value={u._id}>{u.symbol}</option>)}
                </SelectField>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="h-10 w-10 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 flex items-center justify-center self-end transition-colors"
                    aria-label="Remove material"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {errors.inputMaterials?.root && (
              <p className="text-[11px] text-red-500">{errors.inputMaterials.root.message}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
            Create BOM
          </button>
        </div>
      </form>
    </>
  );
}
