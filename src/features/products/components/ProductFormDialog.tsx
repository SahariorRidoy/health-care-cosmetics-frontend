'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useGetUOMsQuery } from '@/features/inventory/services/inventoryApi';
import { useCreateProductMutation, useUpdateProductMutation } from '../services/productsApi';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '../types';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  baseUom: z.string().min(1, 'Base UOM is required'),
  reorderLevel: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).optional(),
});
type ProductForm = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
}

export function ProductFormDialog({ open, product, onClose }: ProductFormDialogProps) {
  const isEdit = !!product;
  const { data: uomData } = useGetUOMsQuery();
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    if (open) {
      reset(
        product
          ? {
              name: product.name,
              sku: product.sku,
              description: product.description ?? '',
              baseUom: typeof product.baseUom === 'string' ? product.baseUom : product.baseUom._id,
              reorderLevel: product.reorderLevel,
              salePrice: product.salePrice,
            }
          : { reorderLevel: 0 },
      );
    }
  }, [open, product, reset]);

  async function onSubmit(values: ProductForm) {
    try {
      const payload = { ...values, salePrice: values.salePrice || undefined };
      if (isEdit) {
        await updateProduct({ id: product._id, body: payload }).unwrap();
        toast.success('Product updated');
      } else {
        await createProduct(payload).unwrap();
        toast.success('Product created');
      }
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Operation failed');
    }
  }

  if (!open) return null;

  const uoms = uomData?.data?.uoms?.filter((u) => u.isActive) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit product' : 'Create product'}
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Product Name" required placeholder="e.g. Aloe Vera Cream 200ml" error={errors.name?.message} {...register('name')} />
            <FormField label="SKU" required placeholder="e.g. AVC-200" error={errors.sku?.message} {...register('sku')} />
            <SelectField label="Base UOM" required error={errors.baseUom?.message} {...register('baseUom')}>
              <option value="">Select UOM…</option>
              {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
            </SelectField>
            <FormField label="Reorder Level" type="number" min={0} error={errors.reorderLevel?.message} {...register('reorderLevel')} />
            <FormField label="Sale Price (৳)" type="number" min={0} step="0.01" placeholder="Optional" error={errors.salePrice?.message} {...register('salePrice')} />
            {isEdit && product.costPrice > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Cost Price (৳) — from production</span>
                <div className="h-10 flex items-center px-3 rounded-md border border-border bg-slate-50 text-sm text-secondary">
                  {formatCurrency(product.costPrice)}
                </div>
              </div>
            )}
            <div className="col-span-full">
              <TextareaField label="Description" placeholder="Optional notes" {...register('description')} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
