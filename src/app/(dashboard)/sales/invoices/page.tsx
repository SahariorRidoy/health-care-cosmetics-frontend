'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, FileDown, Printer, Loader2, Search, X, CreditCard, Trash2, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { FormField, SelectField } from '@/components/forms/FormField';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetInvoicesQuery, useCreateCustomerPaymentMutation, useDeleteInvoiceMutation } from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import type { Invoice, Customer } from '@/features/sales/types';

const STATUS_OPTIONS = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'];
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  method: z.string().min(1, 'Required'),
  reference: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

function QuickPayDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [createPayment, { isLoading }] = useCreateCustomerPaymentMutation();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: invoice?.dueAmount ?? 0, method: 'CASH' },
  });

  const watched = watch('amount');
  const change = Math.max(0, Number(watched) - (invoice?.dueAmount ?? 0));
  const remaining = Math.max(0, (invoice?.dueAmount ?? 0) - Number(watched));

  async function onSubmit(values: PaymentForm) {
    if (!invoice) return;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer._id;
    try {
      await createPayment({ customer: customerId, invoice: invoice._id, amount: values.amount, method: values.method, reference: values.reference }).unwrap();
      toast.success('Payment recorded');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to record payment');
    }
  }

  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Pay Due — {invoice.invoiceNumber}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <div className="flex gap-4 text-sm bg-slate-50 rounded-md px-4 py-3">
            <span className="text-secondary">Total: <span className="font-medium text-foreground">{formatCurrency(invoice.totalAmount)}</span></span>
            <span className="text-secondary">Due: <span className="font-semibold text-red-500">{formatCurrency(invoice.dueAmount)}</span></span>
          </div>
          <FormField label="Amount (৳)" type="number" min={0.01} step="0.01" required error={errors.amount?.message} {...register('amount')} />
          {Number(watched) > 0 && (
            <div className="flex justify-between text-sm px-1">
              {change > 0
                ? <><span className="text-muted">Change</span><span className="font-semibold text-blue-600">{formatCurrency(change)}</span></>
                : <><span className="text-muted">Remaining Due</span><span className="font-semibold text-amber-600">{formatCurrency(remaining)}</span></>}
            </div>
          )}
          <SelectField label="Payment Method" required error={errors.method?.message} {...register('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectField>
          <FormField label="Reference" placeholder="Cheque no. / transaction ID…" error={errors.reference?.message} {...register('reference')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" />} Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const customerFilter = searchParams.get('customer') ?? undefined;
  const token = useAppSelector((s) => s.auth.accessToken);
  const [deleteInvoice, { isLoading: deleting }] = useDeleteInvoiceMutation();

  const hasDateFilter = !!dateFrom || !!dateTo;

  const { data, isLoading, isError, refetch } = useGetInvoicesQuery({
    page,
    status: statusFilter || undefined,
    customer: customerFilter,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  async function handleDownload(invoiceId: string, invoiceNumber: string) {
    if (!token) return;
    setDownloadingId(invoiceId);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
      const res = await fetch(`${base}/sales/invoices/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`${base}/sales/invoices/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      win?.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
    } catch {
      toast.error('Failed to load PDF for printing');
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber', header: 'Invoice #', priority: 'P1',
      render: (row) => <span className="font-medium text-emerald-600 cursor-pointer hover:underline" onClick={() => router.push(`/sales/invoices/${row._id}`)}>{row.invoiceNumber}</span>,
    },
    {
      key: 'customer', header: 'Customer', priority: 'P1',
      render: (row) => {
        const c = typeof row.customer === 'string' ? null : row.customer as Customer;
        return c?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt, 'dd MMM yyyy, hh:mm a') },
    {
      key: 'totalAmount', header: 'Total', priority: 'P2',
      render: (row) => <span className={row.totalAmount > 0 ? 'font-semibold' : ''}>{formatCurrency(row.totalAmount)}</span>,
    },
    {
      key: 'paidAmount', header: 'Paid', priority: 'P2',
      render: (row) => (
        <span className={`${row.paidAmount > 0 ? 'font-semibold' : ''} ${row.paidAmount > 0 && row.paidAmount < row.totalAmount ? 'text-amber-500' : row.paidAmount >= row.totalAmount && row.paidAmount > 0 ? 'text-emerald-600' : ''}`}>
          {formatCurrency(row.paidAmount)}
        </span>
      ),
    },
    {
      key: 'dueAmount', header: 'Due', priority: 'P1',
      render: (row) => (
        <span className={row.dueAmount > 0 ? 'text-red-500 font-semibold' : ''}>
          {formatCurrency(row.dueAmount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[172px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.dueAmount > 0 && row.status !== 'CANCELLED' && (
            <button
              onClick={() => setPayInvoice(row)}
              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Pay Due" aria-label="Pay Due"
            >
              <CreditCard size={15} />
            </button>
          )}
          {row.status !== 'CANCELLED' && (
            <button
              onClick={() => router.push(`/sales/invoices/${row._id}?edit=1`)}
              className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Edit invoice" title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          <button onClick={() => router.push(`/sales/invoices/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View invoice" title="View">
            <Eye size={15} />
          </button>
          <button onClick={() => handlePrint(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" title="Print" aria-label="Print">
            <Printer size={15} />
          </button>
          <button
            onClick={() => handleDownload(row._id, row.invoiceNumber)}
            disabled={downloadingId === row._id}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-50"
            title="Download PDF" aria-label="Download PDF"
          >
            {downloadingId === row._id ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
          </button>
          <button
            onClick={() => setDeleteId(row._id)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Delete" aria-label="Delete invoice"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description={customerFilter ? 'Filtered by customer' : 'View and manage customer invoices'}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Invoices' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by invoice #, customer name or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
            aria-label="Date from"
          />
          <span className="text-muted text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
            aria-label="Date to"
          />
          {hasDateFilter && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="h-9 px-2 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 flex items-center gap-1 transition-colors"
              title="Clear date filter"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
        {customerFilter && (
          <button
            onClick={() => router.push('/sales/invoices')}
            className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.invoices?.length === 0 && !isLoading ? (
        <EmptyState title="No invoices found" description="Invoices are created from sales orders." />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.invoices ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <QuickPayDialog invoice={payInvoice} onClose={() => setPayInvoice(null)} />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Invoice"
        description="This will permanently delete the invoice and reverse the customer balance. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          try {
            await deleteInvoice(deleteId!).unwrap();
            toast.success('Invoice deleted');
          } catch (err: unknown) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to delete invoice');
          } finally {
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
