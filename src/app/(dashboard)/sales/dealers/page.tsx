'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Pencil, Trash2, Eye, CreditCard,
  MoreVertical, User, Phone, Mail, MapPin, TrendingDown, TrendingUp,
  ChevronDown, ChevronLeft, ChevronRight, FileText, Loader2, Printer, FileDown, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetDealersQuery, useDeleteDealerMutation,
  useGetDealerDuesQuery, useGetDealerPaymentsQuery,
  useCreateCustomerPaymentMutation,
} from '@/features/sales/services/salesApi';
import { DealerFormDialog } from '@/features/sales/components/DealerFormDialog';
import { useAppSelector } from '@/lib/store/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField, SelectField } from '@/components/forms/FormField';
import type { Dealer, InvoiceSummary, CustomerPayment } from '@/features/sales/types';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];
const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  method: z.string().min(1, 'Required'),
  reference: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

function PayDueDialog({ dealer, invoices, onClose }: {
  dealer: Dealer;
  invoices: InvoiceSummary[];
  onClose: () => void;
}) {
  const [createPayment, { isLoading }] = useCreateCustomerPaymentMutation();
  const unpaidInvoices = [...invoices]
    .filter((inv) => inv.dueAmount > 0 && inv.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const totalDue = unpaidInvoices.reduce((s, inv) => s + inv.dueAmount, 0);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: totalDue, method: 'CASH' },
  });
  const watched = Number(watch('amount'));
  const change = Math.max(0, watched - totalDue);
  const remaining = Math.max(0, totalDue - watched);

  // Preview: allocate oldest-first
  const allocation = (() => {
    let left = watched;
    return unpaidInvoices.map((inv) => {
      const applied = Math.min(left, inv.dueAmount);
      left = Math.max(0, left - inv.dueAmount);
      return { inv, applied };
    }).filter((a) => a.applied > 0);
  })();

  async function onSubmit(values: PaymentForm) {
    try {
      let remaining = values.amount;
      for (const inv of unpaidInvoices) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, inv.dueAmount);
        await createPayment({
          dealer: dealer._id,
          invoice: inv._id,
          amount: applied,
          method: values.method,
          reference: values.reference,
        }).unwrap();
        remaining -= applied;
      }
      // if there's leftover (overpayment), apply to last invoice
      if (remaining > 0 && unpaidInvoices.length > 0) {
        const last = unpaidInvoices[unpaidInvoices.length - 1];
        await createPayment({
          dealer: dealer._id,
          invoice: last._id,
          amount: remaining,
          method: values.method,
          reference: values.reference,
        }).unwrap();
      }
      toast.success('Payment recorded');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to record payment');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Pay Due — {dealer.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <div className="flex gap-4 text-sm bg-slate-50 rounded-md px-4 py-3">
            <span className="text-secondary">Total Due: <span className="font-semibold text-red-500">{formatCurrency(totalDue)}</span></span>
            <span className="text-secondary">{unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''}</span>
          </div>
          <FormField label="Amount (৳)" type="number" min={0.01} step="0.01" required error={errors.amount?.message} onFocus={(e) => e.target.select()} {...register('amount')} />
          {watched > 0 && allocation.length > 0 && (
            <div className="bg-slate-50 rounded-md px-3 py-2 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Allocation (oldest first)</p>
              {allocation.map(({ inv, applied }) => (
                <div key={inv._id} className="flex justify-between text-xs">
                  <span className="text-secondary">{inv.invoiceNumber}</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(applied)}</span>
                </div>
              ))}
              {change > 0 && <div className="flex justify-between text-xs border-t border-border pt-1 mt-1"><span className="text-muted">Change</span><span className="font-semibold text-blue-600">{formatCurrency(change)}</span></div>}
              {remaining > 0 && <div className="flex justify-between text-xs border-t border-border pt-1 mt-1"><span className="text-muted">Still remaining</span><span className="font-semibold text-amber-600">{formatCurrency(remaining)}</span></div>}
            </div>
          )}
          <SelectField label="Payment Method" required error={errors.method?.message} {...register('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectField>
          <FormField label="Reference" placeholder="Cheque no. / transaction ID…" error={errors.reference?.message} {...register('reference')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isLoading || unpaidInvoices.length === 0} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" />} Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type InvoiceEntry = { kind: 'invoice'; date: string; ref: string; id: string; amount: number; grossAmount: number; commission: number; itemCount: number; productNames: string[]; balance: number; groupStart?: boolean; groupEnd?: boolean };
type PaymentEntry = { kind: 'payment'; date: string; ref: string; id: string; amount: number; balance: number; groupStart?: boolean; groupEnd?: boolean };
type FlatLedgerRow = InvoiceEntry | PaymentEntry;

// 2-minute window to detect "same-time" upfront payment
const SAME_TIME_MS = 60 * 1000;

function buildFlatLedger(invoices: InvoiceSummary[], payments: CustomerPayment[]): FlatLedgerRow[] {
  // Build invoice lookup
  const invoiceMap = new Map(invoices.map((inv) => [inv._id, inv]));

  // Classify each payment: same-time (upfront) or later
  const sameTimePaymentIds = new Set<string>();
  for (const p of payments) {
    const invId = typeof p.invoice === 'string' ? p.invoice : p.invoice?._id;
    const inv = invId ? invoiceMap.get(invId) : undefined;
    if (inv && Math.abs(new Date(p.paymentDate).getTime() - new Date(inv.createdAt).getTime()) <= SAME_TIME_MS) {
      sameTimePaymentIds.add(p._id);
    }
  }

  // Build flat rows sorted by date
  const rows: (Omit<FlatLedgerRow, 'balance' | 'groupStart' | 'groupEnd'> & { rawDate: number })[] = [
    ...invoices.map((inv) => ({
      kind: 'invoice' as const,
      date: inv.createdAt,
      rawDate: new Date(inv.createdAt).getTime(),
      ref: inv.invoiceNumber,
      id: inv._id,
      amount: inv.totalAmount,
      grossAmount: inv.grossAmount ?? inv.totalAmount,
      commission: inv.totalCommission ?? inv.commissionAmount ?? 0,
      itemCount: inv.items?.length ?? inv.itemCount ?? 0,
      productNames: inv.items?.map((it) => typeof it.item === 'string' ? it.item : it.item.name) ?? [],
    })),
    ...payments.map((p) => ({
      kind: 'payment' as const,
      date: p.paymentDate,
      rawDate: new Date(p.paymentDate).getTime(),
      ref: p.receiptNumber,
      id: p._id,
      amount: p.amount,
    })),
  ].sort((a, b) => a.rawDate - b.rawDate);

  // Assign running balance
  let balance = 0;
  const withBalance: FlatLedgerRow[] = rows.map((r) => {
    balance = r.kind === 'invoice' ? balance + r.amount : balance - r.amount;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rawDate, ...rest } = r;
    return { ...rest, balance } as FlatLedgerRow;
  });

  // Mark groupStart / groupEnd: an invoice followed immediately by its same-time payment(s)
  for (let i = 0; i < withBalance.length; i++) {
    const row = withBalance[i];
    if (row.kind !== 'invoice') continue;
    // Collect consecutive same-time payments right after this invoice
    let j = i + 1;
    while (j < withBalance.length && withBalance[j].kind === 'payment' && sameTimePaymentIds.has(withBalance[j].id)) j++;
    if (j > i + 1) {
      row.groupStart = true;
      withBalance[j - 1].groupEnd = true;
    }
  }

  return withBalance;
}

function ThreeDotMenu({ dealer, onEdit, onDelete, router }: {
  dealer: Dealer;
  onEdit: () => void;
  onDelete: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="More actions"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 bg-white rounded-lg border border-border shadow-lg py-1">
          <button onClick={() => { router.push(`/sales/dealers/${dealer._id}`); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
            <Eye size={14} className="text-blue-500" /> View Details
          </button>
          <button onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
            <Pencil size={14} className="text-emerald-500" /> Edit
          </button>
          <button onClick={() => { router.push(`/sales/orders/new?dealer=${dealer._id}`); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
            <FileText size={14} className="text-violet-500" /> New Order
          </button>
          <div className="border-t border-border my-1" />
          <button onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Deactivate
          </button>
        </div>
      )}
    </div>
  );
}

function DealerLedger({ dealer, onEdit }: { dealer: Dealer; onEdit: () => void }) {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.accessToken);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const { data: duesData, isLoading: duesLoading } = useGetDealerDuesQuery(dealer._id);
  const { data: paymentsData, isLoading: paymentsLoading } = useGetDealerPaymentsQuery({ dealerId: dealer._id });

  const dues = duesData?.data;
  const invoices = dues?.invoices ?? [];
  const payments = paymentsData?.data?.payments ?? [];
  const ledger = buildFlatLedger(invoices, payments);
  const isLoading = duesLoading || paymentsLoading;

  async function handleDownload(invoiceId: string, invoiceNumber: string) {
    if (!token) return;
    setDownloadingId(invoiceId);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Invoice-${invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePrint(invoiceId: string) {
    if (!token) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      win?.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
    } catch {
      toast.error('Failed to load PDF for printing');
    }
  }

  return (
    <div className="flex flex-col sm2:h-full">
      {/* Dealer header */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        {/* Row 1: name+edit (left) | actions (right) — wraps to 2 lines below lg */}
        <div className="flex flex-wrap lg:flex-nowrap items-start justify-between gap-2">
          {/* Left: name, commission */}
          <div className="flex items-start gap-2 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{dealer.name}</h2>
              {dealer.commissionRate > 0 && (
                <p className="text-xs text-violet-600 font-medium mt-0.5">{dealer.commissionRate}% commission</p>
              )}
              {/* Address shown inline on lg+, below name on smaller */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 lg:hidden">
                {dealer.phone && <span className="flex items-center gap-1 text-xs text-muted"><Phone size={11} />{dealer.phone}</span>}
                {dealer.email && <span className="flex items-center gap-1 text-xs text-muted"><Mail size={11} />{dealer.email}</span>}
                {dealer.address && <span className="flex items-center gap-1 text-xs text-muted"><MapPin size={11} />{dealer.address}</span>}
              </div>
            </div>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-slate-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors shrink-0 mt-0.5"
            >
              <Pencil size={13} /> Edit
            </button>
          </div>
          {/* Right: action buttons + balance badge (badge hidden below lg, shown in info row instead) */}
          <div className="flex items-center gap-1.5 flex-wrap lg:flex-nowrap justify-end w-full lg:w-auto">
            <button
              onClick={() => router.push(`/sales/dealers/${dealer._id}`)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-slate-50 transition-colors"
            >
              <Eye size={12} /> View Details
            </button>
            <button
              onClick={() => router.push(`/sales/orders/new`)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
            >
              <FileText size={12} /> New Order
            </button>
            {dealer.balance > 0 && (
              <button
                onClick={() => setPayOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <CreditCard size={12} /> Pay Due
              </button>
            )}
          </div>
        </div>

        {/* Info row — only on lg+ (shown inline above on smaller) */}
        <div className="hidden lg:flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {dealer.phone && <span className="flex items-center gap-1 text-xs text-muted"><Phone size={11} />{dealer.phone}</span>}
          {dealer.email && <span className="flex items-center gap-1 text-xs text-muted"><Mail size={11} />{dealer.email}</span>}
          {dealer.address && <span className="flex items-center gap-1 text-xs text-muted"><MapPin size={11} />{dealer.address}</span>}
        </div>

        {/* Summary stats */}
        {dues && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
            {[
              { label: 'Gross TP', value: formatCurrency(dues.totalGrossAmount ?? 0), color: 'text-foreground' },
              { label: 'Commission', value: formatCurrency(dues.totalCommission ?? 0), color: 'text-violet-600' },
              { label: 'Net Sales', value: formatCurrency(dues.totalNetAmount ?? 0), color: 'text-emerald-600' },
              { label: 'Outstanding', value: formatCurrency(dues.outstandingBalance), color: dues.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg px-2 py-1.5 border border-border">
                <p className="text-[9px] font-medium text-muted uppercase tracking-wide">{s.label}</p>
                <p className={`text-xs font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {payOpen && <PayDueDialog dealer={dealer} invoices={invoices} onClose={() => setPayOpen(false)} />}

      {/* Ledger table */}
      <div className="sm2:flex-1 sm2:min-h-0 overflow-auto px-2 sm2:px-3">
        <table className="w-full min-w-[380px] text-sm">
          <thead className="sticky top-0 bg-slate-50 border-b border-border z-10">
            <tr>
              <th className="text-left px-1.5 py-2 text-[10px] font-semibold text-muted uppercase tracking-wide">Date</th>
              <th className="text-left px-1.5 py-2 text-[10px] font-semibold text-muted uppercase tracking-wide">Ref</th>
              <th className="text-left px-1.5 py-2 text-[10px] font-semibold text-muted uppercase tracking-wide">Type</th>
              <th className="text-right px-1.5 py-2 text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Products</th>
              <th className="hidden lg:table-cell text-right px-1.5 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Gross TP (৳)</th>
              <th className="hidden lg:table-cell text-right px-1.5 py-2 text-[10px] font-semibold text-violet-500 uppercase tracking-wide">Commission (৳)</th>
              <th className="text-right px-1.5 py-2 text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Net Bill (৳)</th>
              <th className="text-right px-1.5 py-2 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Payment (৳)</th>
              <th className="text-right px-1.5 py-2 text-[10px] font-semibold text-muted uppercase tracking-wide">Balance</th>
              <th className="px-1.5 py-2 w-[70px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-10 text-sm text-muted">Loading…</td></tr>
            ) : ledger.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-sm text-muted">No transactions yet.</td></tr>
            ) : (
              ledger.map((entry, i) => {
                const inGroup = entry.groupStart || entry.groupEnd || (!entry.groupStart && !entry.groupEnd && i > 0 && ledger[i - 1].groupStart && !ledger[i - 1].groupEnd);
                const isGrouped = entry.groupStart || (inGroup && entry.kind === 'payment');
                const borderClass = entry.groupStart
                  ? 'border-t-2 border-l-2 border-r-2 border-blue-200'
                  : entry.groupEnd
                  ? 'border-b-2 border-l-2 border-r-2 border-blue-200'
                  : inGroup
                  ? 'border-l-2 border-r-2 border-blue-200 border-b border-blue-100'
                  : 'border-b border-border/60';
                const bgClass = entry.kind === 'payment' && isGrouped
                  ? 'bg-blue-50/20 hover:bg-blue-50/40'
                  : entry.kind === 'payment'
                  ? 'hover:bg-slate-50/60'
                  : 'hover:bg-slate-50/60';
                return (
                  <tr key={i} className={`transition-colors ${borderClass} ${bgClass}`}>
                    <td className="px-1.5 py-2 whitespace-nowrap">
                      <p className="text-[10px] font-medium text-slate-700">{formatDate(entry.date, 'dd MMM yy')}</p>
                      <p className="text-[9px] text-muted mt-0.5">{formatDate(entry.date, 'hh:mm a')}</p>
                    </td>
                    <td className="px-1.5 py-2">
                      {entry.kind === 'invoice' ? (
                        <button onClick={() => router.push(`/sales/invoices/${entry.id}`)}
                          className="text-[10px] font-medium text-amber-600 underline">
                          {entry.ref}
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-600">{entry.ref}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-2">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        entry.kind === 'invoice' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {entry.kind === 'invoice' ? <><TrendingUp size={9} /> Invoice</> : <><TrendingDown size={9} /> Payment</>}
                      </span>
                    </td>
                    <td className="px-1.5 py-2 text-right text-[10px] font-medium text-blue-600">
                      {entry.kind === 'invoice' && entry.itemCount > 0 ? (
                        <div className="relative inline-block group">
                          <span className="inline-flex items-center justify-center bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-semibold cursor-default group-hover:underline">
                            {entry.itemCount} {entry.itemCount === 1 ? 'item' : 'items'}
                          </span>
                          <div className="absolute right-0 top-full mt-1.5 z-50 hidden group-hover:block w-max max-w-[200px] bg-slate-800 text-white text-[10px] rounded-lg px-3 py-2 shadow-xl">
                            <p className="font-semibold text-slate-300 uppercase tracking-wide mb-1">Products</p>
                            <ul className="flex flex-col gap-0.5">
                              {entry.productNames.map((name, idx) => (
                                <li key={idx} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />{name}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="hidden lg:table-cell px-1.5 py-2 text-right text-[10px] font-medium text-slate-600">
                      {entry.kind === 'invoice' ? formatCurrency(entry.grossAmount) : '—'}
                    </td>
                    <td className="hidden lg:table-cell px-1.5 py-2 text-right text-[10px] font-medium text-violet-600">
                      {entry.kind === 'invoice' && entry.commission > 0 ? <span>- {formatCurrency(entry.commission)}</span> : '—'}
                    </td>
                    <td className="px-1.5 py-2 text-right text-[10px] font-medium text-amber-600">
                      {entry.kind === 'invoice' ? formatCurrency(entry.amount) : '—'}
                    </td>
                    <td className="px-1.5 py-2 text-right text-[10px] font-medium text-emerald-600">
                      {entry.kind === 'payment' ? formatCurrency(entry.amount) : '—'}
                    </td>
                    <td className={`px-1.5 py-2 text-right text-[10px] font-semibold ${entry.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatCurrency(entry.balance)}
                    </td>
                    <td className="px-1.5 py-2">
                      {entry.kind === 'invoice' && (
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => handlePrint(entry.id)} className="p-1 rounded text-secondary hover:bg-slate-100" title="Print"><Printer size={12} /></button>
                          <button onClick={() => handleDownload(entry.id, entry.ref)} disabled={downloadingId === entry.id}
                            className="p-1 rounded text-secondary hover:bg-slate-100 disabled:opacity-50" title="Download PDF">
                            {downloadingId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!isLoading && ledger.length > 0 && (
            <tfoot className="sticky bottom-0 bg-white border-t-2 border-border">
              <tr>
                <td colSpan={3} className="px-1.5 py-2 text-[10px] font-bold text-foreground uppercase tracking-wide">Total</td>
                <td className="px-1.5 py-2" />
                <td className="hidden lg:table-cell px-1.5 py-2 text-right"><span className="text-[10px] font-bold text-slate-600">{formatCurrency(ledger.reduce((s, e) => e.kind === 'invoice' ? s + e.grossAmount : s, 0))}</span></td>
                <td className="hidden lg:table-cell px-1.5 py-2 text-right"><span className="text-[10px] font-bold text-violet-600">- {formatCurrency(ledger.reduce((s, e) => e.kind === 'invoice' ? s + e.commission : s, 0))}</span></td>
                <td className="px-1.5 py-2 text-right"><span className="text-[10px] font-bold text-amber-600">{formatCurrency(ledger.reduce((s, e) => e.kind === 'invoice' ? s + e.amount : s, 0))}</span></td>
                <td className="px-1.5 py-2 text-right"><span className="text-[10px] font-bold text-emerald-600">{formatCurrency(ledger.reduce((s, e) => e.kind === 'payment' ? s + e.amount : s, 0))}</span></td>
                <td className="px-1.5 py-2 text-right"><span className={`text-xs font-bold ${(ledger[ledger.length - 1]?.balance ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(ledger[ledger.length - 1]?.balance ?? 0)}</span></td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function DealersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDealer, setEditDealer] = useState<Dealer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data, isLoading, isError, refetch } = useGetDealersQuery({ page: 1 });
  const { data: searchData } = useGetDealersQuery({ page: 1, search: search || undefined }, { skip: !search });
  const [deleteDealer, { isLoading: deleting }] = useDeleteDealerMutation();

  const dealers = useMemo(() => data?.data?.dealers ?? [], [data]);
  const dropdownDealers = useMemo(() => {
    if (!search) return dealers;
    return (searchData?.data?.dealers ?? dealers).filter((d) =>
      d.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, dealers, searchData]);
  const selected = dealers.find((d) => d._id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && dealers.length > 0) setSelectedId(dealers[0]._id);
  }, [dealers, selectedId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectDealer(id: string) {
    setSelectedId(id);
    setShowLedger(true);
    setDropdownOpen(false);
    setSearch('');
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteDealer(deleteId).unwrap();
      toast.success('Dealer deactivated');
      if (selectedId === deleteId) { setSelectedId(null); setShowLedger(false); }
    } catch {
      toast.error('Failed to deactivate dealer');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col sm2:h-[calc(100vh-120px)]">
      <div className="shrink-0">
        <PageHeader
          title="Dealers"
          breadcrumbs={[{ label: 'Sales' }, { label: 'Dealers' }]}
          actions={
            <button onClick={() => setCreateOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} /> New Dealer
            </button>
          }
        />
      </div>

      <div className="flex-1 sm2:min-h-0">
        <div className="flex sm2:h-full rounded-xl border border-border bg-white shadow-sm overflow-hidden">

          {/* Left — dealer list */}
          <div className={`relative flex flex-col border-r border-border shrink-0 transition-all duration-200
            ${showLedger ? 'hidden sm2:flex' : 'flex'}
            ${sidebarOpen ? 'w-full sm2:w-44' : 'w-0 sm2:w-10 overflow-hidden'}
          `}>
            {/* Collapse toggle — only on sm2+ */}
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="hidden sm2:flex absolute -right-3 top-4 z-30 w-6 h-6 rounded-full bg-emerald-500 border border-emerald-600 shadow items-center justify-center text-white hover:bg-emerald-600 transition-colors"
              title={sidebarOpen ? 'Collapse' : 'Expand'}
            >
              {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>

            {/* Collapsed: show only avatars */}
            {!sidebarOpen && (
              <ul className="flex-1 overflow-y-auto pt-16">
                {dealers.map((d) => (
                  <li key={d._id} onClick={() => selectDealer(d._id)}
                    className={`flex justify-center py-2 cursor-pointer transition-colors ${
                      selectedId === d._id ? 'bg-emerald-100' : 'hover:bg-slate-50'
                    }`}
                    title={d.name}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      selectedId === d._id ? 'bg-emerald-500' : 'bg-emerald-100'
                    }`}>
                      <User size={13} className={selectedId === d._id ? 'text-white' : 'text-emerald-700'} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Expanded content */}
            {sidebarOpen && (<>
            {/* Search with dropdown */}
            <div ref={searchRef} className="relative p-3 border-b border-border shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search dealers…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  className="h-8 w-full rounded-md border border-emerald bg-emerald-50 pl-8 pr-3 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald transition-all"
                />
              </div>
              {dropdownOpen && (
                <div className="absolute left-3 right-0 top-full mt-1 w-72 bg-white rounded-xl border border-border shadow-xl z-50 overflow-hidden">
                  {isLoading ? (
                    <p className="px-4 py-3 text-xs text-muted">Loading…</p>
                  ) : dropdownDealers.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted">No dealers found.</p>
                  ) : (
                    <ul className="max-h-56 overflow-y-auto py-1">
                      {dropdownDealers.map((d) => (
                        <li key={d._id}>
                          <button
                            onClick={() => selectDealer(d._id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${selectedId === d._id ? 'bg-emerald-50' : ''}`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${selectedId === d._id ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
                              <User size={11} className={selectedId === d._id ? 'text-white' : 'text-emerald-700'} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${selectedId === d._id ? 'text-emerald-800' : 'text-foreground'}`}>{d.name}</p>
                              {d.balance > 0 && <p className="text-[10px] text-amber-600 font-medium">{formatCurrency(d.balance)}</p>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Dealer list */}
            <ul className="flex-1 overflow-y-auto">
              {isLoading && <li className="px-4 py-3 text-xs text-muted">Loading…</li>}
              {isError && (
                <li className="px-4 py-3">
                  <button onClick={refetch} className="text-xs text-red-500 hover:underline">Retry</button>
                </li>
              )}
              {!isLoading && dealers.length === 0 && (
                <li className="px-4 py-6">
                  <EmptyState title="No dealers" description="Add your first dealer." />
                </li>
              )}
              {dealers.map((d) => (
                <li
                  key={d._id}
                  onClick={() => selectDealer(d._id)}
                  className={`flex flex-col px-2 py-2 cursor-pointer border-b border-border/50 transition-colors ${
                    selectedId === d._id ? 'bg-emerald-50 border-l-2 border-l-emerald' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Top row: avatar + active text + three-dot */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${selectedId === d._id ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
                          <User size={11} className={selectedId === d._id ? 'text-white' : 'text-emerald-700'} />
                        </div>
                        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${d.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </div>
                      <span className={`text-[9px] font-semibold ${d.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{d.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <ChevronDown size={13} className={`sm2:hidden transition-transform ${selectedId === d._id ? 'text-emerald-500 rotate-180' : 'text-muted'}`} />
                      <ThreeDotMenu dealer={d} onEdit={() => setEditDealer(d)} onDelete={() => setDeleteId(d._id)} router={router} />
                    </div>
                  </div>
                  {/* Full-width name row */}
                  <p className={`text-xs font-semibold w-full mt-1 break-words leading-tight ${
                    selectedId === d._id ? 'text-emerald-800' : 'text-foreground'
                  }`}>{d.name}</p>
                  {/* Sub info */}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {d.balance > 0 && <span className="text-[10px] font-medium text-amber-600">{formatCurrency(d.balance)}</span>}
                    {d.commissionRate > 0 && <span className="text-[9px] text-violet-600 font-medium">{d.commissionRate}%</span>}
                  </div>
                </li>
              ))}
            </ul>
            </>)}
          </div>

          {/* Right — ledger */}
          {/* Collapse toggle sits here between panels so it's never clipped */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="hidden sm2:flex self-start mt-4 -ml-3 z-30 shrink-0 w-6 h-6 rounded-full bg-emerald-500 border border-emerald-600 shadow items-center justify-center text-white hover:bg-emerald-600 transition-colors"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
          <div className={`flex-1 min-w-0 ${showLedger ? 'flex flex-col' : 'hidden sm2:flex sm2:flex-col'}`}>
            {showLedger && (
              <button
                onClick={() => setShowLedger(false)}
                className="sm2:hidden flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-secondary border-b border-border hover:bg-slate-50 shrink-0"
              >
                ← Back to Dealers
              </button>
            )}
            {selected ? (
              <DealerLedger key={selected._id} dealer={selected} onEdit={() => setEditDealer(selected)} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
                <User size={32} className="text-slate-300" />
                <p className="text-sm">Select a dealer to view ledger</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DealerFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <DealerFormDialog open={!!editDealer} dealer={editDealer} onClose={() => setEditDealer(null)} />
      <ConfirmDialog
        open={!!deleteId}
        title="Deactivate Dealer"
        description="This will deactivate the dealer. Existing records will not be affected."
        confirmLabel="Deactivate"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
