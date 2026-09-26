'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateSupplierPaymentMutation, useGetPurchaseOrdersQuery } from '../services/procurementApi';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { PurchaseOrder } from '../types';

function POSelector({ pos, value, onChange, error }: {
  pos: PurchaseOrder[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = pos.find((p) => p._id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">
        Purchase Order <span className="text-red-500">*</span>
      </label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`h-9 w-full rounded-md border bg-white px-3 text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-emerald ${
            error ? 'border-red-400' : 'border-border'
          }`}
        >
          {selected ? (
            <span className="truncate text-foreground">
              {selected.poNumber} · {formatDate(selected.createdAt)}
              {' — '}
              <span className="text-amber-600 font-semibold">
                Due: {formatCurrency(selected.totalAmount - (selected.paidAmount ?? 0))}
              </span>
            </span>
          ) : (
            <span className="text-muted">Select a purchase order…</span>
          )}
          <ChevronDown size={13} className="text-secondary shrink-0" />
        </button>
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-white shadow-lg max-h-52 overflow-y-auto">
            {pos.map((po) => {
              const due = po.totalAmount - (po.paidAmount ?? 0);
              return (
                <div
                  key={po._id}
                  onMouseDown={() => { onChange(po._id); setOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between gap-2 ${
                    po._id === value ? 'bg-emerald-50' : ''
                  }`}
                >
                  <span className="text-foreground">
                    {po.poNumber}
                    <span className="text-muted ml-1">· {formatDate(po.createdAt)}</span>
                  </span>
                  <span className="text-amber-600 font-semibold shrink-0">{formatCurrency(due)}</span>
                </div>
              );
            })}
            {pos.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">No unpaid orders found</p>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const makeSchema = (maxAmount: number, requirePO: boolean) => z.object({
  purchaseOrderId: requirePO ? z.string().min(1, 'Purchase order is required') : z.string().optional(),
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
  onSuccess?: () => void;
}

export function SupplierPaymentDialog({
  open, supplierId, supplierName, outstandingBalance, purchaseOrderId, onClose, onSuccess,
}: SupplierPaymentDialogProps) {
  const [createPayment, { isLoading }] = useCreateSupplierPaymentMutation();
  const requirePO = !purchaseOrderId;

  // Fetch unpaid POs for this supplier only when no purchaseOrderId is pre-selected
  const { data: posData } = useGetPurchaseOrdersQuery(
    { supplier: supplierId, paymentStatus: 'PARTIAL' },
    { skip: !open || !requirePO },
  );
  const { data: unpaidPosData } = useGetPurchaseOrdersQuery(
    { supplier: supplierId, paymentStatus: 'UNPAID' },
    { skip: !open || !requirePO },
  );

  const unpaidPOs: PurchaseOrder[] = [
    ...(posData?.data?.purchaseOrders ?? []),
    ...(unpaidPosData?.data?.purchaseOrders ?? []),
  ];

  const [selectedPODue, setSelectedPODue] = useState(outstandingBalance);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(selectedPODue, requirePO)),
    defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), method: 'Cash' },
  });

  const watchedPOId = watch('purchaseOrderId');

  useEffect(() => {
    if (open) {
      reset({ paymentDate: new Date().toISOString().slice(0, 10), method: 'Cash' });
      setSelectedPODue(outstandingBalance);
    }
  }, [open, reset, outstandingBalance]);

  useEffect(() => {
    if (!requirePO || !watchedPOId) return;
    const po = unpaidPOs.find((p) => p._id === watchedPOId);
    if (po) {
      const due = po.totalAmount - (po.paidAmount ?? 0);
      setSelectedPODue(due);
      setValue('amount', due as unknown as number, { shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPOId]);

  async function onSubmit(values: FormValues) {
    try {
      await createPayment({
        supplier: supplierId,
        purchaseOrder: purchaseOrderId ?? values.purchaseOrderId,
        amount: values.amount,
        paymentDate: new Date(values.paymentDate).toISOString(),
        method: values.method,
        reference: values.reference,
        notes: values.notes,
      }).unwrap();
      toast.success('Payment recorded');
      onSuccess?.();
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
          {requirePO && (
            <POSelector
              pos={unpaidPOs}
              value={watchedPOId ?? ''}
              onChange={(id) => setValue('purchaseOrderId', id, { shouldValidate: true })}
              error={errors.purchaseOrderId?.message}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Amount (৳)"
              type="number"
              min={0.01}
              step="0.01"
              required
              placeholder={`Max ${formatCurrency(selectedPODue)}`}
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
