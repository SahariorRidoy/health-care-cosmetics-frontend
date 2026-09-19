'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetCustomerQuery,
  useGetCustomerDuesQuery,
  useGetCustomerPaymentsQuery,
} from '@/features/sales/services/salesApi';
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
  const [paymentPage, setPaymentPage] = useState(1);

  const { data: customerData, isLoading, isError, refetch } = useGetCustomerQuery(id);
  const { data: duesData } = useGetCustomerDuesQuery(id);
  const { data: paymentsData, isLoading: paymentsLoading } = useGetCustomerPaymentsQuery({ customerId: id, page: paymentPage });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !customerData?.data?.customer) return <ErrorState onRetry={refetch} />;

  const customer = customerData.data.customer;
  const dues = duesData?.data;

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
  ];

  const paymentColumns: Column<CustomerPayment>[] = [
    { key: 'receiptNumber', header: 'Receipt #', priority: 'P1', render: (row) => <span className="font-medium">{row.receiptNumber}</span> },
    { key: 'paymentDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.paymentDate) },
    { key: 'amount', header: 'Amount', priority: 'P1', render: (row) => formatCurrency(row.amount) },
    { key: 'method', header: 'Method', priority: 'P2' },
    { key: 'reference', header: 'Reference', priority: 'P3', render: (row) => row.reference ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`Code: ${customer.code} · ${customer.category}`}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Customers', href: '/sales/customers' }, { label: customer.name }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button onClick={() => setEditOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </div>
        }
      />

      {/* Profile */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <InfoRow label="Name" value={customer.name} />
        <InfoRow label="Code" value={customer.code} />
        <InfoRow label="Category" value={customer.category} />
        <InfoRow label="Contact Person" value={customer.contactPerson} />
        <InfoRow label="Phone" value={customer.phone} />
        <InfoRow label="Email" value={customer.email} />
        <InfoRow label="Status" value={<StatusBadge status={customer.isActive ? 'ACTIVE' : 'INACTIVE'} />} />
        <InfoRow label="Credit Limit" value={formatCurrency(customer.creditLimit)} />
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

      {/* Dues summary */}
      {dues && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Outstanding', value: formatCurrency(dues.outstandingBalance) },
              { label: 'Credit Limit', value: formatCurrency(dues.customer.creditLimit) },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-semibold text-foreground mt-1">{stat.value}</p>
              </div>
            ))}
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
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
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

      <CustomerFormDialog open={editOpen} customer={customer} onClose={() => setEditOpen(false)} />
    </>
  );
}
