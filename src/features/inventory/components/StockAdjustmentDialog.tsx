'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useCreateAdjustmentMutation, useGetWarehousesQuery } from '../services/inventoryApi';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import type { Item } from '../types';

const adjustmentSchema = z.object({
  warehouse: z.string().min(1, 'Warehouse is required'),
  quantity: z.coerce.number().refine((v) => v !== 0, 'Quantity cannot be zero'),
  notes: z.string().optional(),
});

type AdjustmentForm = z.infer<typeof adjustmentSchema>;

interface StockAdjustmentDialogProps {
  open: boolean;
  item: Item | null;
  onClose: () => void;
}

export function StockAdjustmentDialog({ open, item, onClose }: StockAdjustmentDialogProps) {
  const { data: warehouseData } = useGetWarehousesQuery();
  const [createAdjustment, { isLoading }] = useCreateAdjustmentMutation();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
  });

  useEffect(() => {
    if (open) reset({ quantity: 0, notes: '' });
  }, [open, reset]);

  async function onSubmit(values: AdjustmentForm) {
    if (!item) return;
    try {
      await createAdjustment({ item: item._id, ...values }).unwrap();
      toast.success('Stock adjustment posted');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Adjustment failed';
      toast.error(msg);
    }
  }

  if (!open || !item) return null;

  const warehouses = warehouseData?.data?.filter((w) => w.isActive) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Stock adjustment"
        className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Stock Adjustment</h2>
            <p className="text-xs text-muted mt-0.5">{item.name} · {item.sku}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
            ))}
          </SelectField>

          <FormField
            label="Quantity"
            type="number"
            step="0.01"
            required
            hint="Use positive to add stock, negative to deduct"
            error={errors.quantity?.message}
            {...register('quantity')}
          />

          <TextareaField
            label="Notes"
            placeholder="Reason for adjustment…"
            {...register('notes')}
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
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
              Post Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
