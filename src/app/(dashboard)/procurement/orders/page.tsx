'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2, CreditCard, ChevronDown, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetPurchaseOrdersQuery, useDeletePurchaseOrderMutation, useGetSuppliersQuery } from '@/features/procurement/services/procurementApi';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { PurchaseOrder, Supplier } from '@/features/procurement/types';

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

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payOrder, setPayOrder] = useState<PurchaseOrder | null>(null);

  const { data, isLoading, isError, refetch } = useGetPurchaseOrdersQuery({
    page,
    search: search || undefined,
    status: statusFilter || undefined,
    supplier: supplierFilter || undefined,
  });
  const [deletePO, { isLoading: deleteLoading }] = useDeletePurchaseOrderMutation();

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePO(deleteId).unwrap();
      setDeleteId(null);
    } catch {
      // error handled by RTK
    }
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'poNumber', header: 'PO Number', priority: 'P1',
      render: (row) => <span className="font-medium">{row.poNumber}</span>,
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P1',
      render: (row) => {
        const s = typeof row.supplier === 'string' ? null : row.supplier as Supplier;
        return s?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt) },
    {
      key: 'totalAmount', header: 'Total', priority: 'P2',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'paymentStatus', header: 'Payment', priority: 'P2',
      render: (row) => <StatusBadge status={row.paymentStatus ?? 'UNPAID'} />,
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
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
          <button onClick={() => router.push(`/procurement/orders/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View">
            <Eye size={15} />
          </button>
          {(
            <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete">
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
        description="Manage purchase orders and goods receipts"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Orders' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" placeholder="Search PO number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald" />
        </div>
        <SupplierDropdown value={supplierFilter} onChange={(id) => { setSupplierFilter(id); setPage(1); }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="RECEIVED">Received</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.purchaseOrders?.length === 0 && !isLoading ? (
        <EmptyState title="No purchase orders" description="Purchase orders will appear here once created from materials." />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.purchaseOrders ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          tableHeadAction={
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span>Unpaid Orders:</span>
              <span className="font-semibold text-amber-600">
                {(data?.data?.purchaseOrders ?? []).filter(o => o.paymentStatus !== 'PAID').length}
              </span>
            </div>
          }
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
