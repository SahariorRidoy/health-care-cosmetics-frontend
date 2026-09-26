'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X, CreditCard, FileDown, Printer, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetInvoiceQuery,
  useGetCustomerPaymentsQuery,
  useCreateCustomerPaymentMutation,
} from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import type { InvoiceItem, CustomerPayment } from '@/features/sales/types';
import { InvoiceEditDialog } from '@/features/sales/components/SalesRecordEditDialogs';

// ── Receipt dialog ────────────────────────────────────────────────────────────

const receiptSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  method: z.string().min(1, 'Payment method required'),
  paymentDate: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type ReceiptForm = z.infer<typeof receiptSchema>;

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

function RecordReceiptDialog({
  open, invoiceId, customerId, maxAmount, onClose,
}: {
  open: boolean;
  invoiceId: string;
  customerId: string;
  maxAmount: number;
  onClose: () => void;
}) {
  const [createPayment, { isLoading }] = useCreateCustomerPaymentMutation();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReceiptForm>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { amount: maxAmount, method: 'CASH' },
  });

  async function onSubmit(values: ReceiptForm) {
    try {
      await createPayment({
        customer: customerId,
        invoice: invoiceId,
        amount: values.amount,
        method: values.method,
        paymentDate: values.paymentDate ? new Date(values.paymentDate).toISOString() : undefined,
        reference: values.reference,
        notes: values.notes,
      }).unwrap();
      toast.success('Payment recorded');
      reset();
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Record Payment</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <FormField
            label="Amount (৳)"
            type="number"
            min={0.01}
            max={maxAmount}
            step="0.01"
            required
            error={errors.amount?.message}
            {...register('amount')}
          />
          <SelectField label="Payment Method" required error={errors.method?.message} {...register('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectField>
          <FormField label="Payment Date" type="date" error={errors.paymentDate?.message} {...register('paymentDate')} />
          <FormField label="Reference" placeholder="Cheque no. / transaction ID…" error={errors.reference?.message} {...register('reference')} />
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editInvoiceOpen, setEditInvoiceOpen] = useState(searchParams.get('edit') === '1');
  const [paymentPage, setPaymentPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const token = useAppSelector((s) => s.auth.accessToken);

  const { data, isLoading, isError, refetch } = useGetInvoiceQuery(id);
  const invoice = data?.data?.invoice;

  const customerId = invoice
    ? (typeof invoice.customer === 'string' ? invoice.customer : invoice.customer._id)
    : '';

  const { data: paymentsData, isLoading: paymentsLoading } = useGetCustomerPaymentsQuery(
    { customerId, page: paymentPage },
    { skip: !customerId },
  );

  const invoicePayments = paymentsData?.data?.payments?.filter((p) => {
    const inv = typeof p.invoice === 'string' ? p.invoice : (p.invoice as { _id: string })?._id;
    return inv === id;
  }) ?? [];

  async function handleReceiptPrint(paymentId: string) {
    if (!token) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/payments/${paymentId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
      };
    } catch {
      toast.error('Failed to print receipt');
    }
  }

  async function handleReceiptDownload(paymentId: string, receiptNumber: string) {
    if (!token) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/payments/${paymentId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Receipt-${receiptNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download receipt');
    }
  }

  async function handleDownload() {
    if (!token) return;
    setDownloading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice?.invoiceNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    if (!token) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
      };
    } catch {
      toast.error('Failed to load PDF for printing');
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (isError || !invoice) return <ErrorState onRetry={refetch} />;

  const customer = typeof invoice.customer === 'string' ? null : invoice.customer;
  const salesOrder = typeof invoice.salesOrder === 'string' ? null : invoice.salesOrder;
  const canPay = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.dueAmount > 0;

  const paymentColumns: Column<CustomerPayment>[] = [
    {
      key: 'receiptNumber', header: 'Receipt #', priority: 'P1',
      render: (row) => (
        <span
          className="font-medium text-emerald-600 cursor-pointer hover:underline"
          onClick={() => router.push(`/sales/invoices/${id}/receipts/${row._id}`)}
        >
          {row.receiptNumber}
        </span>
      ),
    },
    { key: 'paymentDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.paymentDate) },
    { key: 'amount', header: 'Received', priority: 'P1', render: (row) => formatCurrency(row.amount + (row.changeAmount ?? 0)) },
    { key: 'appliedAmount', header: 'Applied', priority: 'P1', render: (row) => formatCurrency(row.amount) },
    {
      key: 'changeAmount', header: 'Change', priority: 'P1',
      render: (row) => (row.changeAmount ?? 0) > 0
        ? <span className="text-blue-600 font-medium">{formatCurrency(row.changeAmount!)}</span>
        : <span className="text-muted">—</span>,
    },
    { key: 'method', header: 'Method', priority: 'P2' },
    { key: 'reference', header: 'Reference', priority: 'P3', render: (row) => row.reference ?? '—' },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleReceiptPrint(row._id)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Print Receipt" aria-label="Print Receipt"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={() => handleReceiptDownload(row._id, row.receiptNumber)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Download Receipt" aria-label="Download Receipt"
          >
            <FileDown size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`Customer: ${customer?.name ?? '—'}`}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Invoices', href: '/sales/invoices' }, { label: invoice.invoiceNumber }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            {invoice.status !== 'CANCELLED' && (
              <button onClick={() => setEditInvoiceOpen(true)} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Pencil size={14} aria-hidden="true" /> Edit Invoice
              </button>
            )}
            {canPay && (
              <button onClick={() => setReceiptOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <CreditCard size={15} aria-hidden="true" /> Record Payment
              </button>
            )}
            <button
              onClick={handlePrint}
              className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Printer size={15} aria-hidden="true" /> Print
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} aria-hidden="true" />}
              Download PDF
            </button>
          </div>
        }
      />

      {/* Info */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {[
          { label: 'Invoice Number', value: invoice.invoiceNumber },
          { label: 'Customer', value: customer?.name },
          { label: 'Sales Order', value: salesOrder?.orderNumber ?? '—' },
          { label: 'Status', value: <StatusBadge status={invoice.status} /> },
          { label: 'Date', value: formatDate(invoice.createdAt) },
          { label: 'Subtotal', value: formatCurrency(invoice.subtotal) },
          { label: `Tax (${invoice.taxPercent}%)`, value: formatCurrency(invoice.taxAmount) },
          { label: 'Total Amount', value: <span className="font-semibold">{formatCurrency(invoice.totalAmount)}</span> },
          { label: 'Paid Amount', value: <span className="text-emerald-600 font-medium">{formatCurrency(invoice.paidAmount)}</span> },
          {
            label: invoice.dueAmount > 0 ? 'Due Amount' : 'Due Amount',
            value: invoice.dueAmount > 0
              ? <span className="text-amber-600 font-semibold">{formatCurrency(invoice.dueAmount)}</span>
              : <span className="text-emerald-600 font-medium">Fully Paid</span>,
          },
          ...((invoicePayments.some((p) => (p.changeAmount ?? 0) > 0)) ? [{
            label: 'Change Given',
            value: <span className="text-blue-600 font-semibold">{formatCurrency(invoicePayments.reduce((s, p) => s + (p.changeAmount ?? 0), 0))}</span>,
          }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
            <span className="text-sm text-foreground">{value ?? '—'}</span>
          </div>
        ))}
        {invoice.notes && (
          <div className="col-span-full flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Notes</span>
            <span className="text-sm text-foreground">{invoice.notes}</span>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-lg border border-border mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Item', 'Qty', 'Unit Price', 'Discount', 'Total'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((line: InvoiceItem, i: number) => {
                const itemName = typeof line.item === 'string' ? line.item : line.item.name;
                return (
                  <tr key={i} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{itemName}</td>
                    <td className="px-4 py-3">{line.qty}</td>
                    <td className="px-4 py-3">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-3">{line.discount}%</td>
                    <td className="px-4 py-3">{formatCurrency(line.lineTotal)}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50">
                <td colSpan={4} className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase">Total</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(invoice.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Payment History</h2>
          {canPay && (
            <button onClick={() => setReceiptOpen(true)} className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <CreditCard size={13} aria-hidden="true" /> Record Payment
            </button>
          )}
        </div>
        <div className="p-4">
          <DataTable
            columns={paymentColumns}
            data={invoicePayments}
            keyField="_id"
            isLoading={paymentsLoading}
            pagination={paymentsData?.pagination}
            onPageChange={setPaymentPage}
            emptyMessage="No payments recorded yet."
          />
        </div>
      </div>

      {customerId && (
        <RecordReceiptDialog
          open={receiptOpen}
          invoiceId={id}
          customerId={customerId}
          maxAmount={invoice.dueAmount}
          onClose={() => setReceiptOpen(false)}
        />
      )}
      <InvoiceEditDialog invoice={invoice} open={editInvoiceOpen} onClose={() => setEditInvoiceOpen(false)} />
    </>
  );
}
