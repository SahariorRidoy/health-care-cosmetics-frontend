'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { FormField, TextareaField } from '@/components/forms/FormField';
import { useCreateDealerMutation, useUpdateDealerMutation } from '../services/salesApi';
import type { Dealer } from '../types';

const dealerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  commissionRate: z.coerce.number().min(0).max(25).default(0),
});
type DealerFormValues = z.infer<typeof dealerSchema>;

interface Props {
  open: boolean;
  dealer?: Dealer | null;
  onClose: (created?: Dealer) => void;
}

export function DealerFormDialog({ open, dealer, onClose }: Props) {
  const isEdit = !!dealer;
  const [create, { isLoading: creating }] = useCreateDealerMutation();
  const [update, { isLoading: updating }] = useUpdateDealerMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DealerFormValues>({
    resolver: zodResolver(dealerSchema),
  });

  useEffect(() => {
    if (open) {
      reset(dealer
        ? {
            name: dealer.name,
            phone: dealer.phone ?? '',
            email: dealer.email ?? '',
            address: dealer.address ?? '',
            commissionRate: dealer.commissionRate ?? 0,
          }
        : { commissionRate: 0 },
      );
    }
  }, [open, dealer, reset]);

  async function onSubmit(values: DealerFormValues) {
    const payload = {
      ...values,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
    };
    try {
      if (isEdit) {
        await update({ id: dealer._id, body: payload }).unwrap();
        toast.success('Dealer updated');
        onClose();
      } else {
        const result = await create(payload).unwrap();
        toast.success('Dealer created');
        reset();
        onClose(result.data.dealer);
      }
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Operation failed';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={() => onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit dealer' : 'New dealer'}
        className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Dealer' : 'New Dealer'}</h2>
          <button onClick={() => onClose()} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Dealer Name" required error={errors.name?.message} placeholder="e.g. Dhaka Pharma Ltd." {...register('name')} />
            <FormField label="Phone" type="tel" error={errors.phone?.message} placeholder="e.g. 01700000000" {...register('phone')} />
            <FormField label="Email" type="email" error={errors.email?.message} placeholder="e.g. dealer@example.com" {...register('email')} />
            <FormField
              label="Default Commission %"
              type="number"
              min={0}
              max={25}
              step={0.5}
              error={errors.commissionRate?.message}
              placeholder="0–25"
              {...register('commissionRate')}
            />
            <div className="md:col-span-2">
              <TextareaField label="Address" placeholder="Full address…" {...register('address')} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={() => onClose()} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Dealer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
