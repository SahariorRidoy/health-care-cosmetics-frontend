'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetAllSupplierPaymentsQuery, useGetSuppliersQuery, useDeleteSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import type { SupplierPayment, Supplier } from '@/features/procurement/types';

const METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'];

export default function SupplierPaymentsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePayment, { isLoading: deleting }] = useDeleteSupplierPaymentMutation();

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deletePayment(deleteTarget).unwrap();
      toast.success('Payment deleted');
    } catch {
      toast.error('Failed to delete payment');
    } finally {
      setDeleteTarget(null);
    }
  }

  const { data, isLoading, isError, refetch } = useGetAllSupplierPaymentsQuery({
    page,
    limit: 20,
    search: search || undefined,
    supplier: supplierFilter || undefined,
    method: methodFilter || undefined,
  });

  const { data: suppliersData } = useGetSuppliersQuery({ isActive: 'true', limit: 200 });
  const suppliers = suppliersData?.data?.suppliers ?? [];
  const payments = data?.data?.payments ?? [];

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const columns: Column<SupplierPayment>[] = [
    {
      key: 'paymentNumber', header: 'Payment #', priority: 'P1',
      render: (row) => (
        <button
          onClick={() => router.push(`/procurement/payments/${row._id}`)}
          className="font-medium text-emerald hover:underline"
        >
          {row.paymentNumber}
        </button>
      ),
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P1',
      render: (row) => {
        const s = typeof row.supplier === 'string' ? null : row.supplier as Supplier;
        return s ? (
          <button onClick={() => router.push(`/procurement/suppliers/${s._id}`)} className="text-foreground hover:text-emerald hover:underline">
            {s.name}
          </button>
        ) : '—';
      },
    },
    {
      key: 'paymentDate', header: 'Date', priority: 'P1',
      render: (row) => formatDate(row.paymentDate, 'dd MMM yyyy'),
    },
    {
      key: 'amount', header: 'Amount', priority: 'P1',
      render: (row) => <span className="font-semibold text-emerald-700">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'method', header: 'Method', priority: 'P2',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {row.method}
        </span>
      ),
    },
    {
      key: 'purchaseOrder', header: 'PO #', priority: 'P2',
      render: (row) => {
        const pos = (row.purchaseOrders ?? []).map((p) => p.purchaseOrder).filter((p) => p && typeof p !== 'string') as { _id: string; poNumber: string }[];
        if (pos.length > 0) {
          const [first, ...rest] = pos;
          return (
            <div className="flex items-center gap-1">
              <button onClick={() => router.push(`/procurement/orders/${first._id}`)} className="text-emerald hover:underline text-xs">
                {first.poNumber}
              </button>
              {rest.length > 0 && (
                <span
                  title={rest.map((p) => p.poNumber).join(', ')}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold cursor-default"
                >
                  +{rest.length}
                </span>
              )}
            </div>
          );
        }
        const po = row.purchaseOrder as { _id?: string; poNumber?: string } | string | undefined;
        if (!po || typeof po === 'string') return '\u2014';
        return po.poNumber ? (
          <button onClick={() => router.push(`/procurement/orders/${po._id}`)} className="text-emerald hover:underline text-xs">
            {po.poNumber}
          </button>
        ) : '\u2014';
      },
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => router.push(`/procurement/payments/${row._id}`)}
            className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="View"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row._id)}
            className="p-1.5 rounded-md bg-red-50 text-red-500 hover:bg-red-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Delete"
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
        title="Supplier Payments"
        description="All recorded payments to suppliers"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Payments' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search payment number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={supplierFilter}
          onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-48 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-44 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
        >
          <option value="">All Methods</option>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-secondary">
        <div className="flex items-center gap-2">
          <span>Total Payments:</span>
          <span className="text-lg font-bold text-foreground">{data?.pagination?.total ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Page Total:</span>
          <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : payments.length === 0 && !isLoading ? (
        <EmptyState title="No payments found" description="Payments will appear here once recorded." />
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          headerClassName="text-emerald-800"
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Payment"
        description="This will reverse all PO paid amounts and supplier balance. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
