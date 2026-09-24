'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Trash2, CreditCard, ChevronDown, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetGoodsReceiptsQuery, useDeleteGoodsReceiptMutation, useGetSuppliersQuery } from '@/features/procurement/services/procurementApi';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { GoodsReceipt, Supplier, PurchaseOrder } from '@/features/procurement/types';

function SupplierDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useGetSuppliersQuery({ isActive: 'true' });
  const suppliers = (data?.data?.suppliers ?? []).filter((supplier) =>
    supplier.name.toLowerCase().includes(q.toLowerCase())
  );
  const selected = (data?.data?.suppliers ?? []).find((supplier) => supplier._id === value);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-56">
      <button
        type="button"
        onClick={() => { setOpen((isOpen) => !isOpen); setQ(''); }}
        className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald flex items-center justify-between gap-2"
      >
        <span className={selected ? 'truncate' : 'text-muted'}>{selected ? selected.name : 'All Suppliers'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onMouseDown={(event) => { event.stopPropagation(); onChange(''); }} className="text-muted hover:text-foreground cursor-pointer">
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
                onChange={(event) => setQ(event.target.value)}
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
            {suppliers.map((supplier) => (
              <div
                key={supplier._id}
                onMouseDown={() => { onChange(supplier._id); setOpen(false); }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${supplier._id === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-foreground'}`}
              >
                {supplier.name}
              </div>
            ))}
            {suppliers.length === 0 && <p className="px-3 py-2 text-sm text-muted">No suppliers found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payReceipt, setPayReceipt] = useState<GoodsReceipt | null>(null);

  const { data, isLoading, isError, refetch } = useGetGoodsReceiptsQuery({ page, search: search || undefined, supplier: supplierFilter || undefined });
  const [deleteGR, { isLoading: deleteLoading }] = useDeleteGoodsReceiptMutation();

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteGR(deleteId).unwrap();
    } catch {
      // error handled by RTK
    } finally {
      setDeleteId(null);
    }
  }

  const filtered = (data?.data?.goodsReceipts ?? []).filter((gr) => {
    const po = typeof gr.purchaseOrder === 'string' ? null : gr.purchaseOrder as PurchaseOrder;
    const matchStatus = !statusFilter || po?.paymentStatus === statusFilter;
    return matchStatus;
  });

  const columns: Column<GoodsReceipt>[] = [
    {
      key: 'grNumber', header: 'GR Number', priority: 'P1',
      render: (row) => <span className="font-medium">{row.grNumber}</span>,
    },
    {
      key: 'supplier', header: 'Supplier', priority: 'P1',
      render: (row) => (typeof row.supplier === 'string' ? '—' : (row.supplier as Supplier).name),
    },
    {
      key: 'purchaseOrder', header: 'PO Number', priority: 'P2',
      render: (row) => typeof row.purchaseOrder === 'string' ? '—' : (row.purchaseOrder as PurchaseOrder).poNumber,
    },
    {
      key: 'receivedDate', header: 'Received Date', priority: 'P2',
      render: (row) => formatDate(row.receivedDate),
    },
    {
      key: 'totalAmount', header: 'Total', priority: 'P2',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'paymentStatus', header: 'Payment Status', priority: 'P2',
      render: (row) => {
        const po = typeof row.purchaseOrder === 'string' ? null : row.purchaseOrder as PurchaseOrder;
        const status = po?.paymentStatus;
        if (!status) return '—';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
            status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>{status}</span>
        );
      },
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[90px] text-right',
      render: (row) => {
        const hasActivePO = typeof row.purchaseOrder !== 'string' && (row.purchaseOrder as PurchaseOrder).isActive;
        return (
          <div className="flex items-center justify-end gap-1">
            {typeof row.purchaseOrder !== 'string' && (row.purchaseOrder as PurchaseOrder).paymentStatus !== 'PAID' && (
              <button onClick={() => setPayReceipt(row)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Pay Due" title="Pay Due">
                <CreditCard size={15} />
              </button>
            )}
            <button onClick={() => router.push(`/procurement/receipts/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View">
              <Eye size={15} />
            </button>
            {!hasActivePO && (
              <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Goods Receipts"
        description="All received goods from purchase orders"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Receipts' }]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search GR number or supplier…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <SupplierDropdown value={supplierFilter} onChange={(id) => { setSupplierFilter(id); setPage(1); }} />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by payment status"
        >
          <option value="">All Payment Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : filtered.length === 0 && !isLoading ? (
        <EmptyState title="No goods receipts" description="Receipts will appear here once purchases are made." />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          tableHeadAction={
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span>Total Amount:</span>
              <span className="font-semibold text-amber-600">
                {formatCurrency(filtered.reduce((sum, gr) => sum + (gr.totalAmount ?? 0), 0))}
              </span>
            </div>
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Goods Receipt"
        description="This will delete the receipt. Note: receipts linked to an active purchase order cannot be deleted — delete the PO instead."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      {payReceipt && payReceipt._id && (
        <SupplierPaymentDialog
          open={!!payReceipt}
          supplierId={typeof payReceipt.supplier === 'string' ? payReceipt.supplier : (payReceipt.supplier as Supplier)._id}
          supplierName={typeof payReceipt.supplier === 'string' ? '' : (payReceipt.supplier as Supplier).name}
          outstandingBalance={payReceipt.totalAmount}
          purchaseOrderId={typeof payReceipt.purchaseOrder === 'string' ? payReceipt.purchaseOrder : (payReceipt.purchaseOrder as PurchaseOrder)._id}
          onClose={() => setPayReceipt(null)}
        />
      )}
    </>
  );
}
