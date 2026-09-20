'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetSupplierQuery,
  useGetSupplierDuesQuery,
  useGetSupplierPaymentsQuery,
} from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { SupplierPayment, GoodsReceipt } from '@/features/procurement/types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPage, setPaymentPage] = useState(1);

  const { data: supplierData, isLoading, isError, refetch } = useGetSupplierQuery(id);
  const { data: duesData } = useGetSupplierDuesQuery(id);
  const { data: paymentsData, isLoading: paymentsLoading } = useGetSupplierPaymentsQuery({ supplierId: id, page: paymentPage });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !supplierData?.data?.supplier) return <ErrorState onRetry={refetch} />;

  const supplier = supplierData.data.supplier;
  const dues = duesData?.data;
  const receipts: GoodsReceipt[] = (dues?.receipts ?? []) as GoodsReceipt[];

  const grColumns: Column<GoodsReceipt>[] = [
    {
      key: 'grNumber', header: 'Receipt #', priority: 'P1',
      render: (row) => (
        <button
          onClick={() => router.push(`/procurement/receipts/${row._id}`)}
          className="font-medium text-emerald hover:underline"
        >
          {row.grNumber}
        </button>
      ),
    },
    {
      key: 'purchaseOrder', header: 'PO #', priority: 'P1',
      render: (row) => {
        const po = row.purchaseOrder as { _id: string; poNumber: string } | string | undefined;
        if (!po || typeof po === 'string') return '—';
        return (
          <button onClick={() => router.push(`/procurement/orders/${po._id}`)} className="text-emerald hover:underline">
            {po.poNumber}
          </button>
        );
      },
    },
    {
      key: 'items', header: 'Item', priority: 'P1',
      render: (row) => {
        const firstItem = row.items?.[0]?.item as { _id: string; name: string } | string | undefined;
        if (!firstItem || typeof firstItem === 'string') return '—';
        return (
          <button onClick={() => router.push(`/inventory/${firstItem._id}`)} className="text-emerald hover:underline">
            {firstItem.name}
            {row.items.length > 1 && <span className="text-muted ml-1">(+{row.items.length - 1})</span>}
          </button>
        );
      },
    },
    { key: 'receivedDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.receivedDate) },
    { key: 'totalAmount', header: 'Amount', priority: 'P1', render: (row) => formatCurrency(row.totalAmount) },
  ];

  const paymentColumns: Column<SupplierPayment>[] = [
    { key: 'paymentNumber', header: 'Payment #', priority: 'P1', render: (row) => <span className="font-medium">{row.paymentNumber}</span> },
    { key: 'paymentDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.paymentDate) },
    { key: 'amount', header: 'Amount', priority: 'P1', render: (row) => formatCurrency(row.amount) },
    { key: 'method', header: 'Method', priority: 'P2' },
    { key: 'reference', header: 'Reference', priority: 'P3', render: (row) => row.reference ?? '—' },
    { key: 'notes', header: 'Notes', priority: 'P3', render: (row) => row.notes ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={supplier.contactPerson ?? 'Supplier details'}
        breadcrumbs={[{ label: 'Suppliers', href: '/procurement/suppliers' }, { label: supplier.name }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            {supplier.balance > 0 && (
              <button onClick={() => setPaymentOpen(true)} className="h-9 px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <CreditCard size={15} aria-hidden="true" /> Pay Due
              </button>
            )}
            <button onClick={() => setEditOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </div>
        }
      />

      {/* Info */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <InfoRow label="Name" value={supplier.name} />
        <InfoRow label="Contact Person" value={supplier.contactPerson} />
        <InfoRow label="Phone" value={supplier.phone} />
        <InfoRow label="Email" value={supplier.email} />
        <InfoRow label="Status" value={<StatusBadge status={supplier.isActive ? 'ACTIVE' : 'INACTIVE'} />} />
        <InfoRow label="Outstanding Balance" value={
          <span className={supplier.balance > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
            {formatCurrency(supplier.balance)}
          </span>
        } />
        <InfoRow label="Address" value={supplier.address} />
      </div>

      {/* Dues summary */}
      {dues && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Purchased', value: formatCurrency(dues.totalOrdered) },
            { label: 'Total Paid', value: formatCurrency(dues.totalPaid) },
            { label: 'Outstanding', value: formatCurrency(dues.outstandingBalance) },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Purchase history */}
      <div className="bg-white rounded-lg border border-border mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Purchase History</h2>
        </div>
        <div className="p-4">
          <DataTable
            columns={grColumns}
            data={receipts}
            keyField="_id"
            isLoading={false}
            emptyMessage="No purchases recorded yet."
          />
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
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

      <SupplierFormDialog open={editOpen} supplier={supplier} onClose={() => setEditOpen(false)} />
      <SupplierPaymentDialog
        open={paymentOpen}
        supplierId={supplier._id}
        supplierName={supplier.name}
        outstandingBalance={supplier.balance}
        onClose={() => setPaymentOpen(false)}
      />
    </>
  );
}
