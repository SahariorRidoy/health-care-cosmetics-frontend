'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2, Receipt, Wallet, Building2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetAllSupplierPaymentsQuery, useGetSuppliersQuery, useDeleteSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import { DateRangeFilter, useDateRangeFilter } from '@/features/procurement/components/DateRangeFilter';
import { StatCards, type StatCardItem } from '@/features/procurement/components/StatCards';
import type { SupplierPayment, Supplier, SupplierPaymentStats } from '@/features/procurement/types';

const METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Banking', 'Other'];

function paymentStatItems(stats: SupplierPaymentStats, rangeLabel: string): StatCardItem[] {
  const top = stats.byMethod[0];
  return [
    {
      label: 'Total paid', value: formatCurrency(stats.totalAmount), icon: Wallet,
      hint: rangeLabel, valueTone: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Payments', value: stats.totalPayments.toLocaleString('en-BD'), icon: Receipt,
      hint: stats.totalPayments > 0 ? `Avg ${formatCurrency(stats.averageAmount)} · Max ${formatCurrency(stats.largestAmount)}` : 'No payments',
      valueTone: 'text-slate-900', chip: 'bg-slate-100 text-slate-600',
    },
    {
      label: 'Suppliers paid', value: stats.suppliersPaid.toLocaleString('en-BD'), icon: Building2,
      hint: stats.suppliersPaid === 1 ? '1 supplier received payment' : `${stats.suppliersPaid} suppliers received payment`,
      valueTone: 'text-slate-900', chip: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Top method', value: top ? top.method : '—', icon: CreditCard,
      hint: top ? `${formatCurrency(top.amount)} · ${top.count} ${top.count === 1 ? 'payment' : 'payments'}` : 'No payments',
      valueTone: 'text-slate-900', chip: 'bg-violet-50 text-violet-600',
    },
  ];
}

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

  const dateRange = useDateRangeFilter(() => setPage(1));

  const { data, isLoading, isFetching, isError, refetch } = useGetAllSupplierPaymentsQuery({
    page,
    limit: 20,
    search: search || undefined,
    supplier: supplierFilter || undefined,
    method: methodFilter || undefined,
    from: dateRange.from,
    to: dateRange.to,
  });

  const { data: suppliersData } = useGetSuppliersQuery({ isActive: 'true', limit: 200 });
  const suppliers = suppliersData?.data?.suppliers ?? [];
  const payments = data?.data?.payments ?? [];
  const stats = data?.data?.stats;
  const hasFilters = !!(search || supplierFilter || methodFilter || dateRange.isActive);

  const columns: Column<SupplierPayment>[] = [
    {
      key: 'sl', header: 'SL No.', priority: 'P1', className: 'w-[72px]',
      render: (_row, index = 0) => (page - 1) * 20 + index + 1,
    },
    {
      key: 'paymentDate', header: 'Date', priority: 'P1',
      render: (row) => (
        <div className="whitespace-nowrap">
          <span className="block font-medium text-foreground">{formatDate(row.paymentDate, 'dd MMM yyyy')}</span>
          <span className="block text-xs text-muted">{formatDate(row.paymentDate, 'hh:mm a')}</span>
        </div>
      ),
    },
    {
      key: 'paymentNumber', header: 'Payment #', priority: 'P1',
      render: (row) => (
        <button
          onClick={() => router.push(`/procurement/payments/${row._id}`)}
          className="font-medium text-blue-600 hover:underline"
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
          <button onClick={() => router.push(`/procurement/suppliers/${s._id}`)} className="text-blue-600 hover:underline">
            {s.name}
          </button>
        ) : '—';
      },
    },
    {
      key: 'amount', header: 'Amount', priority: 'P1',
      render: (row) => formatCurrency(row.amount),
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
        const allocations = (row.purchaseOrders ?? [])
          .filter((a) => a.purchaseOrder && typeof a.purchaseOrder !== 'string')
          .map((a) => ({ po: a.purchaseOrder as { _id: string; poNumber: string }, amount: a.appliedAmount }));
        if (allocations.length === 0) {
          const legacy = row.purchaseOrder as { _id?: string; poNumber?: string } | string | undefined;
          if (legacy && typeof legacy !== 'string' && legacy._id && legacy.poNumber) {
            allocations.push({ po: { _id: legacy._id, poNumber: legacy.poNumber }, amount: row.amount });
          }
        }
        if (allocations.length === 0) return <span className="text-muted">On account</span>;
        return (
          <div className="space-y-0.5">
            {allocations.map(({ po, amount }) => (
              <p key={po._id} className="flex items-baseline gap-2 whitespace-nowrap leading-6">
                <button
                  onClick={() => router.push(`/procurement/orders/${po._id}`)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {po.poNumber}
                </button>
                <span className="text-xs font-semibold tabular-nums text-emerald-700">{formatCurrency(amount)}</span>
              </p>
            ))}
          </div>
        );
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
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Payments' }]}
        className="!mb-4"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search by payment number or supplier…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-11 w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
            <DateRangeFilter {...dateRange.filterProps} />
            <select
              value={supplierFilter}
              aria-label="Filter by supplier"
              onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald sm:w-48"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <select
              value={methodFilter}
              aria-label="Filter by payment method"
              onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald sm:w-44"
            >
              <option value="">All Methods</option>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        }
      />

      <StatCards
        label="Supplier payment totals"
        items={stats ? paymentStatItems(stats, dateRange.label) : null}
        isLoading={isLoading}
        isFetching={isFetching}
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : payments.length === 0 && !isLoading ? (
        <EmptyState title="No payments found" description={hasFilters ? 'No payments match the selected filters.' : 'Payments will appear here once recorded.'} />
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
