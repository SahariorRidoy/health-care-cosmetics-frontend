'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X, FileText, Truck, CreditCard, FileDown, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetSalesOrderQuery,
  useUpdateSalesOrderStatusMutation,
  useCreateInvoiceMutation,
  useGetInvoicesQuery,
  useCreateCustomerPaymentMutation,
  useGetCustomerPaymentsQuery,
} from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import type { SalesOrderItem, Invoice } from '@/features/sales/types';

// ── Invoice creation dialog ───────────────────────────────────────────────────

const invoiceSchema = z.object({
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

function CreateInvoiceDialog({ open, orderId, onClose }: { open: boolean; orderId: string; onClose: () => void }) {
  const [createInvoice, { isLoading }] = useCreateInvoiceMutation();
  const { data: orderData } = useGetSalesOrderQuery(orderId);

  const { register, handleSubmit, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { taxPercent: orderData?.data?.salesOrder?.taxPercent ?? 0 },
  });

  async function onSubmit(values: InvoiceForm) {
    const order = orderData?.data?.salesOrder;
    if (!order) return;
    try {
      await createInvoice({
        customer: typeof order.customer === 'string' ? order.customer : order.customer._id,
        salesOrder: orderId,
        taxPercent: values.taxPercent,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        notes: values.notes,
        items: order.items.map((l) => ({
          item: typeof l.item === 'string' ? l.item : l.item._id,
          uom: typeof l.uom === 'string' ? l.uom : l.uom._id,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discount: l.discount,
          description: l.description,
        })),
      }).unwrap();
      toast.success('Invoice created');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create invoice';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Create Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <FormField label="Tax %" type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} {...register('taxPercent')} />
          <FormField label="Due Date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
          <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record payment dialog ─────────────────────────────────────────────────────

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  method: z.string().min(1, 'Payment method required'),
  paymentDate: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

function RecordPaymentDialog({
  open, invoice, customerId, onClose,
}: {
  open: boolean;
  invoice: Invoice | null;
  customerId: string;
  onClose: () => void;
}) {
  const [createPayment, { isLoading }] = useCreateCustomerPaymentMutation();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: invoice?.dueAmount ?? 0, method: 'CASH' },
  });

  const watchedAmount = watch('amount');
  const change = Math.max(0, Number(watchedAmount) - (invoice?.dueAmount ?? 0));
  const due = Math.max(0, (invoice?.dueAmount ?? 0) - Number(watchedAmount));

  async function onSubmit(values: PaymentForm) {
    if (!invoice) return;
    try {
      await createPayment({
        customer: customerId,
        invoice: invoice._id,
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

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Record Payment — {invoice.invoiceNumber}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <div className="flex gap-4 text-sm bg-slate-50 rounded-md px-4 py-3">
            <span className="text-secondary">Total: <span className="font-medium text-foreground">{formatCurrency(invoice.totalAmount)}</span></span>
            <span className="text-secondary">Due: <span className="font-semibold text-amber-600">{formatCurrency(invoice.dueAmount)}</span></span>
          </div>
          <FormField label="Amount (৳)" type="number" min={0.01} step="0.01" required error={errors.amount?.message} {...register('amount')} />
          {Number(watchedAmount) > 0 && (
            <div className="flex justify-between text-sm px-1">
              {change > 0
                ? <><span className="text-muted">Change</span><span className="font-semibold text-blue-600">{formatCurrency(change)}</span></>
                : <><span className="text-muted">Remaining Due</span><span className="font-semibold text-amber-600">{formatCurrency(due)}</span></>}
            </div>
          )}
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

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const token = useAppSelector((s) => s.auth.accessToken);

  async function handleInvoiceDownload(invoiceId: string, invoiceNumber: string) {
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

  async function handleInvoicePrint(invoiceId: string) {
    if (!token) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
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

  const { data, isLoading, isError, refetch } = useGetSalesOrderQuery(id);
  const customerId = data?.data?.salesOrder
    ? (typeof data.data.salesOrder.customer === 'string' ? data.data.salesOrder.customer : data.data.salesOrder.customer._id)
    : undefined;
  const { data: invoicesData, isLoading: invLoading } = useGetInvoicesQuery(
    { customer: customerId },
    { skip: !customerId },
  );
  const [updateStatus, { isLoading: statusLoading }] = useUpdateSalesOrderStatusMutation();

  const { data: paymentsData } = useGetCustomerPaymentsQuery(
    { customerId: customerId! },
    { skip: !customerId },
  );

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.salesOrder) return <ErrorState onRetry={refetch} />;

  const order = data.data.salesOrder;
  const customer = typeof order.customer === 'string' ? null : order.customer;
  const orderInvoices = invoicesData?.data?.invoices?.filter((inv) => {
    const so = typeof inv.salesOrder === 'string' ? inv.salesOrder : inv.salesOrder?._id;
    return so === id;
  }) ?? [];
  const canActOnOrder = order.status === 'DRAFT' || order.status === 'CONFIRMED';
  const primaryInvoice = orderInvoices[0] ?? null;

  const orderPayments = paymentsData?.data?.payments?.filter((p) => {
    const inv = typeof p.invoice === 'string' ? p.invoice : (p.invoice as { _id: string })?._id;
    return inv === primaryInvoice?._id;
  }) ?? [];
  const totalReceived = orderPayments.reduce((s, p) => s + p.amount + (p.changeAmount ?? 0), 0);
  const totalChange = orderPayments.reduce((s, p) => s + (p.changeAmount ?? 0), 0);
  const hasPayment = orderPayments.length > 0;

  async function handleStatusUpdate() {
    if (!confirmStatus) return;
    try {
      await updateStatus({ id, status: confirmStatus }).unwrap();
      toast.success(`Order ${confirmStatus.toLowerCase()}`);
    } catch {
      toast.error('Status update failed');
    } finally {
      setConfirmStatus(null);
    }
  }

  const invoiceColumns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', priority: 'P1', render: (row) => <span className="font-medium">{row.invoiceNumber}</span> },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    { key: 'totalAmount', header: 'Total', priority: 'P1', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'paidAmount', header: 'Paid', priority: 'P1', render: (row) => <span className="text-emerald-600">{formatCurrency(row.paidAmount)}</span> },
    {
      key: 'dueAmount', header: 'Due', priority: 'P1',
      render: (row) => {
        if (row.dueAmount > 0) return <span className="text-amber-600 font-medium">Due: {formatCurrency(row.dueAmount)}</span>;
        return <span className="text-emerald-600">Paid</span>;
      },
    },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[130px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status !== 'PAID' && row.status !== 'CANCELLED' && (
            <button
              onClick={() => setPaymentInvoice(row)}
              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Record payment" title="Record Payment"
            >
              <CreditCard size={15} />
            </button>
          )}
          <button
            onClick={() => handleInvoicePrint(row._id)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Print invoice" title="Print"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={() => handleInvoiceDownload(row._id, row.invoiceNumber)}
            disabled={downloadingId === row._id}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-50"
            aria-label="Download invoice" title="Download PDF"
          >
            {downloadingId === row._id ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
          </button>
          <button
            onClick={() => router.push(`/sales/invoices/${row._id}`)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View invoice" title="View"
          >
            <FileText size={15} />
          </button>
        </div>
      ),
    },
  ];

  const statusLabel: Record<string, string> = {
    CONFIRMED: 'Confirm Order',
    DISPATCHED: 'Mark Dispatched',
    CLOSED: 'Close Order',
    CANCELLED: 'Cancel Order',
  };

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`Customer: ${customer?.name ?? '—'}`}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Orders', href: '/sales/orders' }, { label: order.orderNumber }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            {order.status === 'DRAFT' && (
              <button onClick={() => setConfirmStatus('CONFIRMED')} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                Confirm Order
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <>
                <button onClick={() => setInvoiceOpen(true)} className="h-9 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
                  <FileText size={15} aria-hidden="true" /> Create Invoice
                </button>
                <button onClick={() => setConfirmStatus('DISPATCHED')} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                  <Truck size={15} aria-hidden="true" /> Dispatch
                </button>
              </>
            )}
            {order.status === 'DISPATCHED' && (
              <button onClick={() => setConfirmStatus('CLOSED')} className="h-9 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
                Close Order
              </button>
            )}
            {canActOnOrder && (
              <button onClick={() => setConfirmStatus('CANCELLED')} className="h-9 px-3 rounded-md border border-red-200 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                Cancel
              </button>
            )}
          </div>
        }
      />

      {/* Payment summary banner */}

      {/* Info */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Order Number</span>
          <span className="text-sm text-foreground">{order.orderNumber}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Customer</span>
          <span className="text-sm text-foreground">{customer?.name ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Date</span>
          <span className="text-sm text-foreground">{formatDate(order.createdAt)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Status</span>
          <span className="text-sm text-foreground"><StatusBadge status={order.status} /></span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Subtotal</span>
          <span className="text-sm text-foreground">{formatCurrency(order.subtotal)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Tax ({order.taxPercent}%)</span>
          <span className="text-sm text-foreground">{formatCurrency(order.taxAmount)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Total Amount</span>
          <span className="text-sm font-semibold text-emerald-600">{formatCurrency(order.totalAmount)}</span>
        </div>
        {hasPayment && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Amount Received</span>
            <span className="text-sm font-semibold text-foreground">{formatCurrency(totalReceived)}</span>
          </div>
        )}
        {hasPayment && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Applied to Invoice</span>
            <span className="text-sm font-semibold text-emerald-600">{formatCurrency(primaryInvoice?.paidAmount ?? 0)}</span>
          </div>
        )}
        {hasPayment && totalChange > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Change Given</span>
            <span className="text-sm font-semibold text-blue-600">{formatCurrency(totalChange)}</span>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Due Amount</span>
          <span className="text-sm font-medium">
            {!primaryInvoice && <span className="text-muted">—</span>}
            {primaryInvoice && primaryInvoice.dueAmount > 0 && <span className="text-amber-600">{formatCurrency(primaryInvoice.dueAmount)}</span>}
            {primaryInvoice && primaryInvoice.dueAmount <= 0 && <span className="text-emerald-600">Fully Paid</span>}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Payment Status</span>
          <span className="text-sm text-foreground">{primaryInvoice ? <StatusBadge status={primaryInvoice.status} /> : <span className="text-muted">—</span>}</span>
        </div>
        {order.notes && (
          <div className="col-span-full flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Notes</span>
            <span className="text-sm text-foreground">{order.notes}</span>
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
              {order.items.map((line: SalesOrderItem, i: number) => {
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
                <td className="px-4 py-3 font-semibold">{formatCurrency(order.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Invoices</h2>
          {canActOnOrder && (
            <button onClick={() => setInvoiceOpen(true)} className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <FileText size={13} aria-hidden="true" /> Create Invoice
            </button>
          )}
        </div>
        <div className="p-4">
          <DataTable columns={invoiceColumns} data={orderInvoices} keyField="_id" isLoading={invLoading} emptyMessage="No invoices yet." />
        </div>
      </div>

      <CreateInvoiceDialog open={invoiceOpen} orderId={id} onClose={() => setInvoiceOpen(false)} />

      <RecordPaymentDialog
        open={!!paymentInvoice}
        invoice={paymentInvoice}
        customerId={customerId ?? ''}
        onClose={() => setPaymentInvoice(null)}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        title={statusLabel[confirmStatus ?? ''] ?? 'Update Status'}
        description={
          confirmStatus === 'DISPATCHED'
            ? 'This will dispatch the order and deduct stock. This cannot be undone.'
            : confirmStatus === 'CANCELLED'
            ? 'This will cancel the order. This cannot be undone.'
            : `Change order status to ${confirmStatus?.toLowerCase()}.`
        }
        confirmLabel={statusLabel[confirmStatus ?? ''] ?? 'Confirm'}
        variant={confirmStatus === 'CANCELLED' ? 'danger' : 'default'}
        loading={statusLoading}
        onConfirm={handleStatusUpdate}
        onCancel={() => setConfirmStatus(null)}
      />
    </>
  );
}
