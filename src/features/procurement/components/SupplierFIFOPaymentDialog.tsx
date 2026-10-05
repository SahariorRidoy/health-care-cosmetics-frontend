'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, X, Info } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateSupplierPaymentFifoMutation, useGetPurchaseOrdersQuery } from '../services/procurementApi';
import { formatCurrency, formatDate } from '@/lib/formatters';

const makeSchema = (max: number) => z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0').max(max, `Cannot exceed outstanding balance of ${formatCurrency(max)}`),
  paymentDate: z.string().min(1, 'Date is required'),
  method: z.string().min(1, 'Method is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'];

interface Props {
  open: boolean;
  supplierId: string;
  supplierName: string;
  outstandingBalance: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SupplierFIFOPaymentDialog({ open, supplierId, supplierName, outstandingBalance, onClose, onSuccess }: Props) {
  const [createPayment, { isLoading }] = useCreateSupplierPaymentFifoMutation();

  // Fetch unpaid POs sorted oldest first to show the FIFO preview
  const { data: unpaidData } = useGetPurchaseOrdersQuery(
    { supplier: supplierId, paymentStatus: 'UNPAID', limit: 50 },
    { skip: !open },
  );
  const { data: partialData } = useGetPurchaseOrdersQuery(
    { supplier: supplierId, paymentStatus: 'PARTIAL', limit: 50 },
    { skip: !open },
  );

  const allPOs = [
    ...(unpaidData?.data?.purchaseOrders ?? []),
    ...(partialData?.data?.purchaseOrders ?? []),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(outstandingBalance)),
    defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), method: 'Cash' },
  });

  useEffect(() => {
    if (open) reset({ paymentDate: new Date().toISOString().slice(0, 10), method: 'Cash' });
  }, [open, reset]);

  const watchedAmount = watch('amount') ?? 0;

  // Compute FIFO preview
  const preview: { poNumber: string; date: string; total: number; was: number; applying: number; after: number }[] = [];
  let rem = Number(watchedAmount) || 0;
  for (const po of allPOs) {
    if (rem <= 0) break;
    const due = Math.max(0, po.totalAmount - (po.paidAmount ?? 0));
    if (due <= 0) continue;
    const applying = Math.min(rem, due);
    preview.push({
      poNumber: po.poNumber,
      date: po.createdAt,
      total: po.totalAmount,
      was: po.paidAmount ?? 0,
      applying,
      after: Math.round(((po.paidAmount ?? 0) + applying) * 100) / 100,
    });
    rem = Math.round((rem - applying) * 100) / 100;
  }

  async function onSubmit(values: FormValues) {
    try {
      const d = new Date(values.paymentDate);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      await createPayment({
        supplier: supplierId,
        amount: values.amount,
        paymentDate: d.toISOString(),
        method: values.method,
        reference: values.reference,
        notes: values.notes,
      }).unwrap();
      toast.success('Payment recorded and distributed (FIFO)');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to record payment');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-lg bg-white rounded-none sm:rounded-xl shadow-lg z-10 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pay Due — Auto FIFO</h2>
            <p className="text-xs text-muted mt-0.5">{supplierName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Outstanding balance */}
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700 font-medium">Total Outstanding Balance</p>
            <p className="text-lg font-bold text-amber-800">{formatCurrency(outstandingBalance)}</p>
          </div>

          {/* FIFO info */}
          <div className="mx-6 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>Payment will be automatically applied to the oldest purchase orders first (FIFO).</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate id="fifo-form" className="px-6 py-4 flex flex-col gap-4">
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
            <div className="flex gap-4">
              <FormField label="Reference / Cheque No." placeholder="Optional" {...register('reference')} />
              <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
            </div>
          </form>

          {/* FIFO preview */}
          {preview.length > 0 && (
            <div className="mx-6 mb-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Payment Distribution Preview</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted">PO #</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted">Date</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted">Due Before</th>
                      <th className="text-right px-3 py-2 font-semibold text-emerald-600">Paying</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => {
                      const dueBefore = row.total - row.was;
                      const dueAfter = row.total - row.after;
                      return (
                        <tr key={row.poNumber} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">{row.poNumber}</td>
                          <td className="px-3 py-2 text-muted">{formatDate(row.date)}</td>
                          <td className="px-3 py-2 text-right text-amber-600 font-medium">{formatCurrency(dueBefore)}</td>
                          <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{formatCurrency(row.applying)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${dueAfter > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {dueAfter > 0 ? formatCurrency(dueAfter) : '✓ Cleared'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="submit" form="fifo-form" disabled={isLoading} className="h-10 px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
