'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateSupplierPaymentMutation } from '../services/procurementApi';
import { formatCurrency } from '@/lib/formatters';

const makeSchema = (maxAmount: number) => z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0').max(maxAmount, `Amount cannot exceed ${maxAmount.toFixed(2)}`),
  paymentDate: z.string().min(1, 'Date is required'),
  method: z.string().min(1, 'Method is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'];

interface SupplierPaymentDialogProps {
  open: boolean;
  supplierId: string;
  supplierName: string;
  outstandingBalance: number;
  purchaseOrderId?: string;
  onClose: () => void;
}

export function SupplierPaymentDialog({
  open, supplierId, supplierName, outstandingBalance, purchaseOrderId, onClose,
}: SupplierPaymentDialogProps) {
  const [createPayment, { isLoading }] = useCreateSupplierPaymentMutation();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(outstandingBalance)),
    defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), method: 'Cash' },
  });

  useEffect(() => {
    if (open) reset({ paymentDate: new Date().toISOString().slice(0, 10), method: 'Cash' });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await createPayment({
        supplier: supplierId,
        purchaseOrder: purchaseOrderId,
        amount: values.amount,
        paymentDate: new Date(values.paymentDate).toISOString(),
        method: values.method,
        reference: values.reference,
        notes: values.notes,
      }).unwrap();
      toast.success('Payment recorded');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to record payment';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Record Payment</h2>
            <p className="text-xs text-muted mt-0.5">{supplierName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {outstandingBalance > 0 && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700 font-medium">Outstanding Balance</p>
            <p className="text-lg font-semibold text-amber-800">{formatCurrency(outstandingBalance)}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Amount (৳)"
              type="number"
              min={0.01}
              step="0.01"
              required
              placeholder={`Max ${formatCurrency(outstandingBalance)}`}
              error={errors.amount?.message}
              {...register('amount')}
            />
            <FormField
              label="Payment Date"
              type="date"
              required
              error={errors.paymentDate?.message}
              {...register('paymentDate')}
            />
          </div>
          <SelectField label="Payment Method" required error={errors.method?.message} {...register('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </SelectField>
          <FormField label="Reference / Cheque No." placeholder="Optional" {...register('reference')} />
          <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
