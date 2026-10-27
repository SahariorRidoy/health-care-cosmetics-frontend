'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2, CreditCard, ChevronDown, X, ShoppingCart, Receipt, Wallet, Scale } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetPurchaseOrdersQuery, useDeletePurchaseOrderMutation, useGetSuppliersQuery } from '@/features/procurement/services/procurementApi';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import { DateRangeFilter, useDateRangeFilter } from '@/features/procurement/components/DateRangeFilter';
import { StatCards, type StatCardItem } from '@/features/procurement/components/StatCards';
import type { PaymentStatus, PurchaseOrder, Supplier, POStats } from '@/features/procurement/types';

function SupplierDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useGetSuppliersQuery({ isActive: 'true' });
  const suppliers = (data?.data?.suppliers ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase())
  );
  const selected = (data?.data?.suppliers ?? []).find((s) => s._id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-56">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQ(''); }}
        className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald flex items-center justify-between gap-2"
      >
        <span className={selected ? 'truncate' : 'text-muted'}>{selected ? selected.name : 'All Suppliers'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onMouseDown={(e) => { e.stopPropagation(); onChange(''); }} className="text-muted hover:text-foreground cursor-pointer">
              <X size={13} />
            </span>
          )}
          <ChevronDown size={13} className="text-secondary" />
        </div>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-white shadow-lg">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                type="text"
                placeholder="Search supplier…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-full rounded border border-border pl-7 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <div
              onMouseDown={() => { onChange(''); setOpen(false); }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${!value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-muted'}`}
            >
              All Suppliers
            </div>
            {suppliers.map((s) => (
              <div
                key={s._id}
                onMouseDown={() => { onChange(s._id); setOpen(false); }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${s._id === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-foreground'}`}
              >
                {s.name}
              </div>
            ))}
            {suppliers.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">No suppliers found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ordersStatItems(stats: POStats, rangeLabel: string): StatCardItem[] {
  return [
    {
      label: 'Purchase orders', value: stats.totalOrders.toLocaleString('en-BD'), icon: ShoppingCart,
      hint: `${stats.unpaidCount} unpaid · ${stats.partialCount} partial · ${stats.paidCount} paid`,
      valueTone: 'text-slate-900', chip: 'bg-slate-100 text-slate-600',
    },
    {
      label: 'Total purchase', value: formatCurrency(stats.totalAmount), icon: Receipt,
      hint: rangeLabel, valueTone: 'text-slate-900', chip: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total paid', value: formatCurrency(stats.totalPaid), icon: Wallet,
      hint: stats.totalAmount > 0 ? `${Math.round((stats.totalPaid / stats.totalAmount) * 100)}% of purchase` : 'No purchases',
      valueTone: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Total due', value: formatCurrency(stats.totalDue), icon: Scale,
      hint: stats.totalDue > 0 ? `${stats.unpaidCount + stats.partialCount} orders pending` : 'All settled',
      valueTone: stats.totalDue > 0 ? 'text-amber-700' : 'text-emerald-700',
      chip: stats.totalDue > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
    },
  ];
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const styles = {
    PAID: 'bg-emerald-100 text-emerald-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    UNPAID: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | ''>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payOrder, setPayOrder] = useState<PurchaseOrder | null>(null);
  const dateRange = useDateRangeFilter(() => setPage(1));

  const { data, isLoading, isFetching, isError, refetch } = useGetPurchaseOrdersQuery({
    page,
    limit: 10,
    search: search || undefined,
    paymentStatus: paymentStatusFilter || undefined,
    supplier: supplierFilter || undefined,
    from: dateRange.from,
    to: dateRange.to,
  });
  const stats = data?.data?.stats;
  const [deletePO, { isLoading: deleteLoading }] = useDeletePurchaseOrderMutation();

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePO(deleteId).unwrap();
      setDeleteId(null);
      if (page > 1 && (data?.data?.purchaseOrders.length ?? 0) === 1) {
        setPage(page - 1);
      } else {
        refetch();
      }
    } catch {
      // error handled by RTK
    }
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'sl', header: 'SL No.', priority: 'P1', className: 'w-[72px]',
      render: (_row, index = 0) => (page - 1) * 10 + index + 1,
    },
    {
      key: 'poNumber', header: 'PO Number', priority: 'P1',
      render: (row) => (
        <button
          type="button"
          onClick={() => router.push(`/procurement/orders/${row._id}`)}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.poNumber}
        </button>
      ),
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P1',
      render: (row) => {
        const s = typeof row.supplier === 'string' ? null : row.supplier as Supplier;
        if (!s) return '—';
        return (
          <button
            type="button"
            onClick={() => router.push(`/procurement/suppliers/${s._id}`)}
            className="font-medium text-blue-600 hover:underline"
          >
            {s.name}
          </button>
        );
      },
    },
    {
      key: 'products', header: 'Products', priority: 'P2', className: 'min-w-[200px]',
      render: (row) => {
        if (!row.items?.length) return <span className="text-muted">—</span>;
        return (
          <div className="space-y-0.5">
            {row.items.map((line, i) => (
              <p key={i} className="flex items-baseline gap-2 leading-6">
                <span className="font-medium text-foreground">
                  {typeof line.item === 'string' ? '—' : line.item?.name ?? '—'}
                </span>
                <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-violet-600">
                  {formatCurrency(line.unitPrice)}
                </span>
              </p>
            ))}
          </div>
        );
      },
    },
    { key: 'createdAt', header: 'Date & Time', priority: 'P2', render: (row) => formatDate(row.createdAt, 'dd/MM/yy, hh:mm a') },
    {
      key: 'totalAmount', header: 'Total', priority: 'P2',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'paidAmount', header: 'Paid Amount', priority: 'P2',
      render: (row) => (
        <span className={
          row.paymentStatus === 'PAID' ? 'font-medium text-emerald-700' :
          row.paymentStatus === 'PARTIAL' ? 'font-medium text-amber-700' :
          'font-medium text-red-700'
        }>
          {formatCurrency(row.paidAmount)}
        </span>
      ),
    },
    {
      key: 'dueBalance', header: 'Due Balance', priority: 'P2',
      render: (row) => {
        const due = row.totalAmount - (row.paidAmount ?? 0);
        return due > 0 ? <span className="text-amber-600 font-extrabold">{formatCurrency(due)}</span> : <span className="text-muted">—</span>;
      },
    },
    {
      key: 'paymentStatus', header: 'Payment', priority: 'P2',
      render: (row) => <PaymentStatusBadge status={row.paymentStatus ?? 'UNPAID'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[90px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.paymentStatus !== 'PAID' && (
            <button onClick={() => setPayOrder(row)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Pay Due" title="Pay Due">
              <CreditCard size={15} />
            </button>
          )}
          <button onClick={() => router.push(`/procurement/orders/${row._id}`)} className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View">
            <Eye size={15} />
          </button>
          {(
            <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Orders' }]}
        className="!mb-4"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search by PO number or supplier…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-11 w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
            <DateRangeFilter {...dateRange.filterProps} />
            <SupplierDropdown value={supplierFilter} onChange={(id) => { setSupplierFilter(id); setPage(1); }} />
            <select
              value={paymentStatusFilter}
              onChange={(e) => { setPaymentStatusFilter(e.target.value as PaymentStatus | ''); setPage(1); }}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald sm:w-auto"
              aria-label="Filter by payment status"
            >
              <option value="">All Payment Statuses</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>
        }
      />

      <StatCards
        label="Purchase order totals"
        items={stats ? ordersStatItems(stats, dateRange.label) : null}
        isLoading={isLoading}
        isFetching={isFetching}
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.purchaseOrders?.length === 0 && !isLoading ? (
        <EmptyState
          title="No purchase orders"
          description={search || supplierFilter || paymentStatusFilter || dateRange.isActive
            ? 'No purchase orders match the selected filters.'
            : 'Purchase orders will appear here once created from materials.'}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.purchaseOrders ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          headerClassName="text-emerald-800"
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Purchase Order"
        description="This will permanently delete the purchase order. Only DRAFT orders can be deleted."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      {payOrder && payOrder._id && (
        <SupplierPaymentDialog
          open={!!payOrder}
          supplierId={typeof payOrder.supplier === 'string' ? payOrder.supplier : (payOrder.supplier as Supplier)._id}
          supplierName={typeof payOrder.supplier === 'string' ? '' : (payOrder.supplier as Supplier).name}
          outstandingBalance={payOrder.totalAmount - (payOrder.paidAmount ?? 0)}
          purchaseOrderId={payOrder._id}
          onClose={() => setPayOrder(null)}
        />
      )}
    </>
  );
}
