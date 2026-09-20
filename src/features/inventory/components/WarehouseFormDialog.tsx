'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { FormField, TextareaField } from '@/components/forms/FormField';
import { useCreateWarehouseMutation, useUpdateWarehouseMutation } from '../services/inventoryApi';
import type { Warehouse } from '../types';

const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
});
type WarehouseFormValues = z.infer<typeof warehouseSchema>;

interface Props {
  open: boolean;
  warehouse?: Warehouse | null;
  onClose: () => void;
}

export function WarehouseFormDialog({ open, warehouse, onClose }: Props) {
  const isEdit = !!warehouse;
  const [create, { isLoading: creating }] = useCreateWarehouseMutation();
  const [update, { isLoading: updating }] = useUpdateWarehouseMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
  });

  useEffect(() => {
    if (open) {
      reset(warehouse
        ? { name: warehouse.name, code: warehouse.code, address: warehouse.address ?? '', isDefault: warehouse.isDefault }
        : { isDefault: false },
      );
    }
  }, [open, warehouse, reset]);

  async function onSubmit(values: WarehouseFormValues) {
    try {
      if (isEdit) {
        await update({ id: warehouse._id, body: values }).unwrap();
        toast.success('Warehouse updated');
      } else {
        await create(values).unwrap();
        toast.success('Warehouse created');
      }
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
        aria-label={isEdit ? 'Edit warehouse' : 'New warehouse'}
        className="relative w-full sm:max-w-lg bg-white rounded-none sm:rounded-xl shadow-lg z-10"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Warehouse' : 'New Warehouse'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Warehouse Name" required error={errors.name?.message} placeholder="e.g. Main Warehouse" {...register('name')} />
            <FormField label="Code" required error={errors.code?.message} placeholder="e.g. WH-01" {...register('code')} />
          </div>
          <TextareaField label="Address" placeholder="Full address…" {...register('address')} />
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input type="checkbox" {...register('isDefault')} className="w-4 h-4 rounded border-border accent-emerald" />
            Set as default warehouse
          </label>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
