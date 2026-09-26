'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, FileDown, Printer, Loader2, Search, X, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetAllPaymentsQuery, useDeletePaymentMutation } from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import type { CustomerPayment, Customer } from '@/features/sales/types';
import { ReceiptEditDialog } from '@/features/sales/components/SalesRecordEditDialogs';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

export default function ReceiptsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editPayment, setEditPayment] = useState<CustomerPayment | null>(null);
  const token = useAppSelector((s) => s.auth.accessToken);
  const [deletePayment, { isLoading: deleting }] = useDeletePaymentMutation();

  const { data, isLoading, isError, refetch } = useGetAllPaymentsQuery({
    page,
    search: search || undefined,
    method: methodFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  async function fetchPDF(receiptId: string) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
    const res = await fetch(`${base}/sales/payments/${receiptId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    return res.blob();
  }

  async function handleDownload(row: CustomerPayment) {
    if (!token) return;
    setDownloadingId(row._id);
    try {
      const blob = await fetchPDF(row._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Receipt-${row.receiptNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePrint(receiptId: string) {
    if (!token) return;
    try {
      const blob = await fetchPDF(receiptId);
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

  const columns: Column<CustomerPayment>[] = [
    {
      key: 'receiptNumber', header: 'Receipt #', priority: 'P1',
      render: (row) => {
        const invoiceId = typeof row.invoice === 'string' ? row.invoice : row.invoice?._id;
        return (
          <span
            className="font-medium text-emerald-600 cursor-pointer hover:underline"
            onClick={() => invoiceId && router.push(`/sales/invoices/${invoiceId}/receipts/${row._id}`)}
          >
            {row.receiptNumber}
          </span>
        );
      },
    },
    {
      key: 'customer', header: 'Customer', priority: 'P1',
      render: (row) => {
        const c = typeof row.customer === 'string' ? null : row.customer as Customer;
        return c?.name ?? '—';
      },
    },
    {
      key: 'invoice', header: 'Invoice #', priority: 'P2',
      render: (row) => {
        const inv = typeof row.invoice === 'string' ? null : row.invoice as { _id: string; invoiceNumber: string };
        return inv ? (
          <span className="cursor-pointer hover:underline text-secondary" onClick={() => router.push(`/sales/invoices/${inv._id}`)}>
            {inv.invoiceNumber}
          </span>
        ) : '—';
      },
    },
    { key: 'paymentDate', header: 'Date', priority: 'P2', render: (row) => formatDate(row.paymentDate, 'dd MMM yyyy, hh:mm a') },
    { key: 'method', header: 'Method', priority: 'P2', render: (row) => row.method.replace('_', ' ') },
    {
      key: 'amount', header: 'Amount', priority: 'P1',
      render: (row) => <span className="font-semibold text-emerald-600">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[152px] text-right',
      render: (row) => {
        const invoiceId = typeof row.invoice === 'string' ? row.invoice : row.invoice?._id;
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setEditPayment(row)}
              className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Edit receipt" title="Edit"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => invoiceId && router.push(`/sales/invoices/${invoiceId}/receipts/${row._id}`)}
              className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="View receipt" title="View"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={() => handlePrint(row._id)}
              className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Print" aria-label="Print"
            >
              <Printer size={15} />
            </button>
            <button
              onClick={() => handleDownload(row)}
              disabled={downloadingId === row._id}
              className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-50"
              title="Download PDF" aria-label="Download PDF"
            >
              {downloadingId === row._id ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            </button>
            <button
              onClick={() => setDeleteId(row._id)}
              className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Delete" aria-label="Delete receipt"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  const hasDateFilter = !!dateFrom || !!dateTo;

  return (
    <>
      <PageHeader
        title="Receipts"
        description="All customer payment receipts"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Receipts' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by receipt #, customer…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by payment method"
        >
          <option value="">All Methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
            aria-label="Date from"
          />
          <span className="text-muted text-sm">—</span>
          <input
            type="date" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
            aria-label="Date to"
          />
          {hasDateFilter && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="h-9 px-2 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 flex items-center gap-1 transition-colors"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.payments?.length === 0 && !isLoading ? (
        <EmptyState title="No receipts found" description="Receipts are generated when payments are recorded on invoices." />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.payments ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Receipt"
        description="This will permanently delete the receipt and reverse the invoice payment. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          try {
            await deletePayment(deleteId!).unwrap();
            toast.success('Receipt deleted');
          } catch (err: unknown) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to delete receipt');
          } finally {
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />

      {editPayment && <ReceiptEditDialog payment={editPayment} open onClose={() => setEditPayment(null)} />}
    </>
  );
}
