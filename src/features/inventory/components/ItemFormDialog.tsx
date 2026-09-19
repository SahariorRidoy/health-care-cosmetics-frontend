'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { itemSchema, type ItemFormValues } from '../schemas/itemSchema';
import { useCreateItemMutation, useUpdateItemMutation, useGetUOMsQuery } from '../services/inventoryApi';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import type { Item } from '../types';

const ITEM_TYPES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'SEMI_FINISHED', label: 'Semi-Finished' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' },
];

interface ItemFormDialogProps {
  open: boolean;
  item?: Item | null;
  onClose: () => void;
}

export function ItemFormDialog({ open, item, onClose }: ItemFormDialogProps) {
  const isEdit = !!item;
  const { data: uomData } = useGetUOMsQuery();
  const [createItem, { isLoading: creating }] = useCreateItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateItemMutation();
  const isLoading = creating || updating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema) });

  useEffect(() => {
    if (open) {
      reset(
        item
          ? {
              name: item.name,
              sku: item.sku,
              type: item.type,
              category: item.category,
              description: item.description ?? '',
              baseUom: typeof item.baseUom === 'string' ? item.baseUom : item.baseUom._id,
              reorderLevel: item.reorderLevel,
              costPrice: item.costPrice,
              salePrice: item.salePrice ?? ('' as unknown as undefined),
            }
          : { reorderLevel: 0, costPrice: 0 },
      );
    }
  }, [open, item, reset]);

  async function onSubmit(values: ItemFormValues) {
    try {
      const payload = {
        ...values,
        salePrice: values.salePrice || undefined,
      };
      if (isEdit) {
        await updateItem({ id: item._id, body: payload }).unwrap();
        toast.success('Item updated');
      } else {
        await createItem(payload).unwrap();
        toast.success('Item created');
      }
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Operation failed';
      toast.error(msg);
    }
  }

  if (!open) return null;

  const uoms = uomData?.data?.filter((u) => u.isActive) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit item' : 'Create item'}
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Item' : 'New Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Item Name"
              required
              placeholder="e.g. Aloe Vera Gel"
              error={errors.name?.message}
              {...register('name')}
            />
            <FormField
              label="SKU"
              required
              placeholder="e.g. ALV-001"
              error={errors.sku?.message}
              {...register('sku')}
            />
            <SelectField label="Type" required error={errors.type?.message} {...register('type')}>
              <option value="">Select type…</option>
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </SelectField>
            <FormField
              label="Category"
              required
              placeholder="e.g. Ingredients"
              error={errors.category?.message}
              {...register('category')}
            />
            <SelectField label="Base UOM" required error={errors.baseUom?.message} {...register('baseUom')}>
              <option value="">Select UOM…</option>
              {uoms.map((u) => (
                <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>
              ))}
            </SelectField>
            <FormField
              label="Reorder Level"
              type="number"
              min={0}
              error={errors.reorderLevel?.message}
              {...register('reorderLevel')}
            />
            <FormField
              label="Cost Price (৳)"
              type="number"
              min={0}
              step="0.01"
              required
              error={errors.costPrice?.message}
              {...register('costPrice')}
            />
            <FormField
              label="Sale Price (৳)"
              type="number"
              min={0}
              step="0.01"
              placeholder="Optional"
              error={errors.salePrice?.message}
              {...register('salePrice')}
            />
            <div className="col-span-full">
              <TextareaField
                label="Description"
                placeholder="Optional notes about this item"
                {...register('description')}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
