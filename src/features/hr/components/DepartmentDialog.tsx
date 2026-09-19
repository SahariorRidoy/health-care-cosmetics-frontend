'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { FormField, TextareaField } from '@/components/forms/FormField';
import { useCreateDepartmentMutation, useUpdateDepartmentMutation } from '../services/hrApi';
import type { Department } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
}

export function DepartmentDialog({ open, onClose, department }: Props) {
  const isEdit = !!department;
  const [create, { isLoading: creating }] = useCreateDepartmentMutation();
  const [update, { isLoading: updating }] = useUpdateDepartmentMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      reset(department
        ? { name: department.name, description: department.description ?? '' }
        : { name: '', description: '' });
    }
  }, [open, department, reset]);

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && department) {
        await update({ id: department._id, body: values }).unwrap();
      } else {
        await create(values).unwrap();
      }
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="dept-dialog-title"
        className="relative w-full sm:max-w-md bg-white rounded-xl shadow-lg p-6 z-10"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="dept-dialog-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Department' : 'New Department'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Name" required error={errors.name?.message} placeholder="e.g. Production" {...register('name')} />
          <TextareaField label="Description" error={errors.description?.message} placeholder="Optional" rows={2} {...register('description')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
