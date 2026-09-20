'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, FileText, FileDown, Printer, Loader2, ClipboardList, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import {
  useGetCustomerQuery,
  useGetCustomerDuesQuery,
  useGetCustomerPaymentsQuery,
  useDeleteCustomerMutation,
} from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import { CustomerFormDialog } from '@/features/sales/components/CustomerFormDialog';
import type { CustomerPayment, InvoiceSummary } from '@/features/sales/types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [paymentPage, setPaymentPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const token = useAppSelector((s) => s.auth.accessToken);

  const { data: customerData, isLoading, isError, refetch } = useGetCustomerQuery(id);
  const { data: duesData } = useGetCustomerDuesQuery(id);
  const { data: paymentsData, isLoading: paymentsLoading } = useGetCustomerPaymentsQuery({ customerId: id, page: paymentPage });
  const [deleteCustomer, { isLoading: deleting }] = useDeleteCustomerMutation();

  if (isLoading) return <LoadingSpinner />;
  if (isError || !customerData?.data?.customer) return <ErrorState onRetry={refetch} />;

  const customer = customerData.data.customer;
  const dues = duesData?.data;

  async function handleDeactivate() {
    try {
      await deleteCustomer(id).unwrap();
      toast.success('Customer deactivated');
      router.push('/sales/customers');
    } catch {
      toast.error('Failed to deactivate customer');
    } finally {
      setDeactivateOpen(false);
    }
  }

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

  const invoiceColumns: Column<InvoiceSummary>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', priority: 'P1', render: (row) => <span className="font-medium">{row.invoiceNumber}</span> },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    { key: 'totalAmount', header: 'Total', priority: 'P1', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'paidAmount', header: 'Paid', priority: 'P2', render: (row) => formatCurrency(row.paidAmount) },
    {
      key: 'dueAmount', header: 'Due', priority: 'P1',
      render: (row) => (
        <span className={row.dueAmount > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
          {formatCurrency(row.dueAmount)}
        </span>
      ),
    },
    { key: 'dueDate', header: 'Due Date', priority: 'P3', render: (row) => row.dueDate ? formatDate(row.dueDate) : '—' },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[130px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handlePrint(row._id)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Print" aria-label="Print invoice"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={() => handleDownload(row._id, row.invoiceNumber)}
            disabled={downloadingId === row._id}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-50"
            title="Download PDF" aria-label="Download invoice PDF"
          >
            {downloadingId === row._id
              ? <Loader2 size={15} className="animate-spin" />
              : <FileDown size={15} />}
          </button>
          <button
            onClick={() => router.push(`/sales/invoices/${row._id}`)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="View invoice" aria-label="View invoice"
          >
            <FileText size={15} />
          </button>
        </div>
      ),
    },
  ];

  const paymentColumns: Column<CustomerPayment>[] = [
    { key: 'receiptNumber', header: 'Receipt #', priority: 'P1', render: (row) => <span className="font-medium">{row.receiptNumber}</span> },
    { key: 'paymentDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.paymentDate) },
    { key: 'amount', header: 'Amount', priority: 'P1', render: (row) => formatCurrency(row.amount) },
    { key: 'method', header: 'Method', priority: 'P2' },
    { key: 'reference', header: 'Reference', priority: 'P3', render: (row) => row.reference ?? '—' },
    {
      key: 'invoice', header: 'Invoice', priority: 'P2',
      render: (row) => {
        const invId = typeof row.invoice === 'string' ? row.invoice : (row.invoice as { _id: string })?._id;
        const invNum = typeof row.invoice === 'string' ? null : (row.invoice as { invoiceNumber?: string })?.invoiceNumber;
        if (!invId) return <span className="text-muted">—</span>;
        return (
          <button
            onClick={() => router.push(`/sales/invoices/${invId}`)}
            className="text-emerald-600 hover:underline text-sm font-medium flex items-center gap-1"
          >
            <CreditCard size={13} />
            {invNum ?? 'View'}
          </button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.email ?? customer.phone ?? ''}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Customers', href: '/sales/customers' }, { label: customer.name }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button
              onClick={() => router.push(`/sales/orders?customer=${id}`)}
              className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <ClipboardList size={15} aria-hidden="true" /> Orders
            </button>
            <button
              onClick={() => router.push(`/sales/invoices?customer=${id}`)}
              className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <FileText size={15} aria-hidden="true" /> Invoices
            </button>
            {customer.isActive && (
              <button onClick={() => setDeactivateOpen(true)} className="h-9 px-3 rounded-md border border-red-200 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                <Trash2 size={15} aria-hidden="true" /> Deactivate
              </button>
            )}
            <button onClick={() => setEditOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </div>
        }
      />

      {/* Profile */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <InfoRow label="Name" value={customer.name} />
        <InfoRow label="Phone" value={customer.phone} />
        <InfoRow label="Email" value={customer.email} />
        <InfoRow label="Status" value={<StatusBadge status={customer.isActive ? 'ACTIVE' : 'INACTIVE'} />} />
        <InfoRow label="Outstanding Balance" value={
          <span className={customer.balance > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
            {formatCurrency(customer.balance)}
          </span>
        } />
        {customer.address && (
          <div className="col-span-full flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Address</span>
            <span className="text-sm text-foreground">{customer.address}</span>
          </div>
        )}
      </div>

      {dues && (
        <>
          {/* Dues summary */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Outstanding</p>
              <p className="text-lg font-semibold text-foreground mt-1">{formatCurrency(dues.outstandingBalance)}</p>
            </div>
          </div>

          {/* Aging */}
          <div className="bg-white rounded-lg border border-border mb-6">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Receivables Aging</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    {['Current', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[dues.aging.current, dues.aging.days1_30, dues.aging.days31_60, dues.aging.days61_90, dues.aging.over90].map((v, i) => (
                      <td key={i} className={`px-4 py-3 font-medium ${v > 0 ? (i >= 3 ? 'text-red-600' : 'text-amber-600') : 'text-foreground'}`}>
                        {formatCurrency(v)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-lg border border-border mb-6">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
              <button
                onClick={() => router.push(`/sales/invoices?customer=${id}`)}
                className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                <FileText size={13} /> View All
              </button>
            </div>
            <div className="p-4">
              <DataTable
                columns={invoiceColumns}
                data={dues.invoices}
                keyField="_id"
                isLoading={false}
                emptyMessage="No invoices found."
              />
            </div>
          </div>
        </>
      )}

      {/* Payment history */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
          <button
            onClick={() => router.push(`/sales/invoices?customer=${id}`)}
            className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <FileText size={13} /> View Invoices
          </button>
        </div>
        <div className="p-4">
          <DataTable
            columns={paymentColumns}
            data={paymentsData?.data?.payments ?? []}
            keyField="_id"
            isLoading={paymentsLoading}
            pagination={paymentsData?.pagination}
            onPageChange={setPaymentPage}
            emptyMessage="No payments recorded yet."
          />
        </div>
      </div>

      <CustomerFormDialog open={editOpen} customer={customer} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={deactivateOpen}
        title="Deactivate Customer"
        description={`"${customer.name}" will be hidden from new transactions. This can be reversed later.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateOpen(false)}
      />
    </>
  );
}
