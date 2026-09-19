'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { supplierSchema, type SupplierFormValues } from '../schemas/supplierSchema';
import { useCreateSupplierMutation, useUpdateSupplierMutation } from '../services/procurementApi';
import { FormField, TextareaField } from '@/components/forms/FormField';
import type { Supplier } from '../types';

interface SupplierFormDialogProps {
  open: boolean;
  supplier?: Supplier | null;
  onClose: () => void;
}

export function SupplierFormDialog({ open, supplier, onClose }: SupplierFormDialogProps) {
  const isEdit = !!supplier;
  const [create, { isLoading: creating }] = useCreateSupplierMutation();
  const [update, { isLoading: updating }] = useUpdateSupplierMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  useEffect(() => {
    if (open) {
      reset(supplier
        ? { name: supplier.name, code: supplier.code, category: supplier.category,
            contactPerson: supplier.contactPerson ?? '', phone: supplier.phone ?? '',
            email: supplier.email ?? '', address: supplier.address ?? '' }
        : {},
      );
    }
  }, [open, supplier, reset]);

  async function onSubmit(values: SupplierFormValues) {
    const payload = { ...values, email: values.email || undefined };
    try {
      if (isEdit) {
        await update({ id: supplier._id, body: payload }).unwrap();
        toast.success('Supplier updated');
      } else {
        await create(payload).unwrap();
        toast.success('Supplier created');
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
        aria-label={isEdit ? 'Edit supplier' : 'New supplier'}
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Supplier' : 'New Supplier'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Supplier Name" required error={errors.name?.message} placeholder="e.g. ABC Chemicals Ltd." {...register('name')} />
            <FormField label="Code" required error={errors.code?.message} placeholder="e.g. SUP-001" {...register('code')} />
            <FormField label="Category" required error={errors.category?.message} placeholder="e.g. Raw Materials" {...register('category')} />
            <FormField label="Contact Person" error={errors.contactPerson?.message} placeholder="e.g. Mr. Karim" {...register('contactPerson')} />
            <FormField label="Phone" type="tel" error={errors.phone?.message} placeholder="e.g. 01700000000" {...register('phone')} />
            <FormField label="Email" type="email" error={errors.email?.message} placeholder="e.g. supplier@example.com" {...register('email')} />
            <div className="col-span-full">
              <TextareaField label="Address" placeholder="Full address…" {...register('address')} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
