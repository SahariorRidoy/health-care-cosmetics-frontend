'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, CreditCard, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetSupplierQuery,
  useGetSupplierDuesQuery,
  useGetSupplierPaymentsQuery,
  useGetPurchaseOrdersQuery,
} from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { SupplierPayment, GoodsReceipt, PurchaseOrder } from '@/features/procurement/types';

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
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1);

  const { data: supplierData, isLoading, isError, refetch } = useGetSupplierQuery(id);
  const { data: duesData } = useGetSupplierDuesQuery(id);
  const { data: paymentsData, isLoading: paymentsLoading } = useGetSupplierPaymentsQuery({ supplierId: id, page: paymentPage });
  const { data: purchaseOrdersData } = useGetPurchaseOrdersQuery({ supplier: id });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !supplierData?.data?.supplier) return <ErrorState onRetry={refetch} />;

  const supplier = supplierData.data.supplier;
  const dues = duesData?.data;
  const receipts: GoodsReceipt[] = (dues?.receipts ?? []) as GoodsReceipt[];
  const purchaseOrders = purchaseOrdersData?.data?.purchaseOrders ?? [];
  const purchaseHistoryLimit = 10;
  const purchaseHistoryPagination = {
    page: purchaseHistoryPage,
    pages: Math.ceil(receipts.length / purchaseHistoryLimit),
    total: receipts.length,
    limit: purchaseHistoryLimit,
  };
  const visibleReceipts = receipts.slice(
    (purchaseHistoryPage - 1) * purchaseHistoryLimit,
    purchaseHistoryPage * purchaseHistoryLimit,
  );

  function getReceiptPurchaseOrder(receipt: GoodsReceipt): PurchaseOrder | undefined {
    const purchaseOrderId = typeof receipt.purchaseOrder === 'string'
      ? receipt.purchaseOrder
      : receipt.purchaseOrder?._id;
    return purchaseOrders.find((purchaseOrder) => purchaseOrder._id === purchaseOrderId)
      ?? (typeof receipt.purchaseOrder === 'string' ? undefined : receipt.purchaseOrder);
  }

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
    {
      key: 'paidAmount', header: 'Paid Amount', priority: 'P1',
      render: (row) => {
        const purchaseOrder = getReceiptPurchaseOrder(row);
        return <span className="text-emerald-600 font-medium">{formatCurrency(purchaseOrder?.paidAmount ?? 0)}</span>;
      },
    },
    {
      key: 'dueAmount', header: 'Due Amount', priority: 'P1',
      render: (row) => {
        const purchaseOrder = getReceiptPurchaseOrder(row);
        const dueAmount = Math.max(0, (purchaseOrder?.totalAmount ?? row.totalAmount) - (purchaseOrder?.paidAmount ?? 0));
        return <span className={dueAmount > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>{formatCurrency(dueAmount)}</span>;
      },
    },
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
            <button onClick={() => window.print()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors print:hidden">
              <Printer size={15} aria-hidden="true" /> Print
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

      {/* Print document, matching the receipt details print layout. */}
      <div className="hidden print:block text-[12px] text-gray-900">
        <div className="flex items-start justify-between pb-4 border-b-2 border-gray-800 mb-4">
          <div>
            <p className="text-[18px] font-bold tracking-tight text-gray-900">Health Care Cosmetics</p>
            <p className="text-[11px] text-gray-500 mt-0.5">HCC ERP — Supplier Statement</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-gray-900">{supplier.name}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Printed {new Date().toLocaleDateString('en-BD')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-2 mb-4 pb-4 border-b border-gray-200">
          {[
            { label: 'Supplier', value: supplier.name },
            { label: 'Contact Person', value: supplier.contactPerson ?? '—' },
            { label: 'Phone', value: supplier.phone ?? '—' },
            { label: 'Email', value: supplier.email ?? '—' },
            { label: 'Status', value: supplier.isActive ? 'ACTIVE' : 'INACTIVE' },
            { label: 'Outstanding Balance', value: formatCurrency(supplier.balance) },
            ...(dues ? [
              { label: 'Total Purchased', value: formatCurrency(dues.totalOrdered) },
              { label: 'Total Paid', value: formatCurrency(dues.totalPaid) },
              { label: 'Outstanding', value: formatCurrency(dues.outstandingBalance) },
            ] : []),
            { label: 'Address', value: supplier.address ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="font-medium text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">Purchase History</p>
        <table className="w-full border-collapse text-[11px] mb-6">
          <thead>
            <tr className="border-b-2 border-gray-800">
              {['Receipt #', 'PO #', 'Item', 'Date', 'Amount', 'Paid', 'Due'].map((header) => (
                <th key={header} className="py-1.5 pr-3 text-left font-semibold text-gray-700 uppercase tracking-wide last:pr-0">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receipts.map((row) => {
              const purchaseOrder = getReceiptPurchaseOrder(row);
              const firstItem = row.items?.[0]?.item;
              const itemName = typeof firstItem === 'string' ? '—' : firstItem?.name ?? '—';
              const dueAmount = Math.max(0, (purchaseOrder?.totalAmount ?? row.totalAmount) - (purchaseOrder?.paidAmount ?? 0));
              return (
                <tr key={row._id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 font-medium">{row.grNumber}</td>
                  <td className="py-1.5 pr-3">{purchaseOrder?.poNumber ?? '—'}</td>
                  <td className="py-1.5 pr-3">{itemName}{row.items.length > 1 ? ` (+${row.items.length - 1})` : ''}</td>
                  <td className="py-1.5 pr-3">{formatDate(row.receivedDate)}</td>
                  <td className="py-1.5 pr-3">{formatCurrency(row.totalAmount)}</td>
                  <td className="py-1.5 pr-3">{formatCurrency(purchaseOrder?.paidAmount ?? 0)}</td>
                  <td className="py-1.5">{formatCurrency(dueAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">Payment History</p>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-gray-800">
              {['Payment #', 'Date', 'Amount', 'Method', 'Reference'].map((header) => (
                <th key={header} className="py-1.5 pr-3 text-left font-semibold text-gray-700 uppercase tracking-wide last:pr-0">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(paymentsData?.data?.payments ?? []).map((payment) => (
              <tr key={payment._id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 font-medium">{payment.paymentNumber}</td>
                <td className="py-1.5 pr-3">{formatDate(payment.paymentDate)}</td>
                <td className="py-1.5 pr-3">{formatCurrency(payment.amount)}</td>
                <td className="py-1.5 pr-3">{payment.method}</td>
                <td className="py-1.5">{payment.reference ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-6 mt-10">
          {['Prepared By', 'Reviewed By', 'Authorized By'].map((label) => (
            <div key={label} className="border-t border-gray-400 pt-1">
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
          Printed on {new Date().toLocaleDateString('en-BD')} — HCC ERP
        </p>
      </div>

      {/* Info */}
      <div className="print:hidden bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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
        <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      <div className="print:hidden bg-white rounded-lg border border-border mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Purchase History</h2>
        </div>
        <div className="p-4">
          <DataTable
            columns={grColumns}
            data={visibleReceipts}
            keyField="_id"
            isLoading={false}
            pagination={purchaseHistoryPagination}
            onPageChange={setPurchaseHistoryPage}
            emptyMessage="No purchases recorded yet."
          />
        </div>
      </div>

      {/* Payment history */}
      <div className="print:hidden bg-white rounded-lg border border-border">
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
