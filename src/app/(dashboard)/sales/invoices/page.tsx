'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, FileDown, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetInvoicesQuery } from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import type { Invoice, Customer } from '@/features/sales/types';

const STATUS_OPTIONS = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'];

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const customerFilter = searchParams.get('customer') ?? undefined;
  const token = useAppSelector((s) => s.auth.accessToken);

  const { data, isLoading, isError, refetch } = useGetInvoicesQuery({
    page,
    status: statusFilter || undefined,
    customer: customerFilter,
  });

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

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber', header: 'Invoice #', priority: 'P1',
      render: (row) => <span className="font-medium">{row.invoiceNumber}</span>,
    },
    {
      key: 'customer', header: 'Customer', priority: 'P1',
      render: (row) => {
        const c = typeof row.customer === 'string' ? null : row.customer as Customer;
        return c?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    { key: 'dueDate', header: 'Due Date', priority: 'P3', render: (row) => row.dueDate ? formatDate(row.dueDate) : '—' },
    { key: 'totalAmount', header: 'Total', priority: 'P2', render: (row) => formatCurrency(row.totalAmount) },
    {
      key: 'dueAmount', header: 'Due', priority: 'P1',
      render: (row) => (
        <span className={row.dueAmount > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
          {formatCurrency(row.dueAmount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[110px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handlePrint(row._id)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Print" aria-label="Print"
          >
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
            onClick={() => router.push(`/sales/invoices/${row._id}`)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View invoice" title="View"
          >
            <Eye size={15} />
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

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
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
    </>
  );
}
