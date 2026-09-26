'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Eye, CreditCard, Loader2, X, Trash2, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { FormField, SelectField } from '@/components/forms/FormField';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetSalesOrdersQuery, useCreateCustomerPaymentMutation, useDeleteSalesOrderMutation } from '@/features/sales/services/salesApi';
import type { SalesOrder, Customer } from '@/features/sales/types';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  method: z.string().min(1, 'Required'),
  reference: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

function QuickPayDialog({
  order, onClose,
}: {
  order: SalesOrder | null;
  onClose: () => void;
}) {
  const [createPayment, { isLoading }] = useCreateCustomerPaymentMutation();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: order?.dueAmount ?? 0, method: 'CASH' },
  });

  const watched = watch('amount');
  const change = Math.max(0, Number(watched) - (order?.dueAmount ?? 0));
  const remaining = Math.max(0, (order?.dueAmount ?? 0) - Number(watched));

  async function onSubmit(values: PaymentForm) {
    if (!order?.invoiceId) return;
    const customerId = typeof order.customer === 'string' ? order.customer : order.customer._id;
    try {
      await createPayment({ customer: customerId, invoice: order.invoiceId, amount: values.amount, method: values.method, reference: values.reference }).unwrap();
      toast.success('Payment recorded');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to record payment');
    }
  }

  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Pay Due — {order.orderNumber}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <div className="flex gap-4 text-sm bg-slate-50 rounded-md px-4 py-3">
            <span className="text-secondary">Total: <span className="font-medium text-foreground">{formatCurrency(order.totalAmount)}</span></span>
            <span className="text-secondary">Due: <span className="font-semibold text-red-500">{formatCurrency(order.dueAmount)}</span></span>
          </div>
          <FormField label="Amount (৳)" type="number" min={0.01} step="0.01" required error={errors.amount?.message} {...register('amount')} />
          {Number(watched) > 0 && (
            <div className="flex justify-between text-sm px-1">
              {change > 0
                ? <><span className="text-muted">Change</span><span className="font-semibold text-blue-600">{formatCurrency(change)}</span></>
                : <><span className="text-muted">Remaining Due</span><span className="font-semibold text-amber-600">{formatCurrency(remaining)}</span></>}
            </div>
          )}
          <SelectField label="Payment Method" required error={errors.method?.message} {...register('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectField>
          <FormField label="Reference" placeholder="Cheque no. / transaction ID…" error={errors.reference?.message} {...register('reference')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" />} Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PAYMENT_STATUS_OPTIONS = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'] as const;
type PaymentStatusFilter = typeof PAYMENT_STATUS_OPTIONS[number] | '';

export default function SalesOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>('');
  const [payOrder, setPayOrder] = useState<SalesOrder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const customerFilter = searchParams.get('customer') ?? undefined;
  const [deleteSalesOrder, { isLoading: deleting }] = useDeleteSalesOrderMutation();

  const { data, isLoading, isError, refetch } = useGetSalesOrdersQuery({
    page,
    search: search || undefined,
    status: paymentFilter || undefined,
    customer: customerFilter,
  });

  const orders = data?.data?.salesOrders ?? [];

  const columns: Column<SalesOrder>[] = [
    {
      key: 'orderNumber', header: 'Order #', priority: 'P1',
      render: (row) => <span className="font-medium">{row.orderNumber}</span>,
    },
    {
      key: 'customer', header: 'Customer', priority: 'P1',
      render: (row) => {
        const c = typeof row.customer === 'string' ? null : row.customer as Customer;
        return c?.name ?? '—';
      },
    },
    { key: 'createdAt', header: 'Date', priority: 'P2', render: (row) => formatDate(row.createdAt, 'dd MMM yyyy, hh:mm a') },

    { key: 'totalAmount', header: 'Total', priority: 'P2', render: (row) => <span className={row.totalAmount > 0 ? 'font-semibold' : ''}>{formatCurrency(row.totalAmount)}</span> },
    { key: 'paidAmount', header: 'Paid', priority: 'P2', render: (row) => <span className={`${row.paidAmount > 0 && row.paidAmount < row.totalAmount ? 'text-amber-500' : row.paidAmount >= row.totalAmount && row.paidAmount > 0 ? 'text-emerald-600' : ''} ${row.paidAmount > 0 ? 'font-semibold' : ''}`}>{formatCurrency(row.paidAmount)}</span> },
    { key: 'dueAmount', header: 'Due', priority: 'P2', render: (row) => <span className={`${row.dueAmount > 0 ? 'text-red-500 font-semibold' : ''}`}>{formatCurrency(row.dueAmount)}</span> },
    {
      key: 'paymentStatus', header: 'Payment', priority: 'P1',
      render: (row) => {
        if (row.status === 'CANCELLED') return <StatusBadge status="CANCELLED" />;
        if (!row.invoiceId) return <StatusBadge status="UNPAID" />;
        if (row.dueAmount <= 0) return <StatusBadge status="PAID" />;
        if (row.paidAmount > 0) return <StatusBadge status="PARTIAL" />;
        return <StatusBadge status="UNPAID" />;
      },
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[132px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.dueAmount > 0 && row.invoiceId && (
            <button
              onClick={() => setPayOrder(row)}
              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Pay due" title="Pay Due"
            >
              <CreditCard size={15} />
            </button>
          )}
          {row.status === 'ACTIVE' && (
            <button
              onClick={() => router.push(`/sales/orders/${row._id}?edit=1`)}
              className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Edit order" title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={() => router.push(`/sales/orders/${row._id}`)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View order" title="View"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => setDeleteId(row._id)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Delete order" title="Delete"
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
        title="Sales Orders"
        description={customerFilter ? 'Filtered by customer' : 'Manage customer orders and dispatch'}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Orders' }]}
        actions={
          <button
            onClick={() => router.push('/sales/orders/new')}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Order
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by order #, customer name or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) => { setPaymentFilter(e.target.value as PaymentStatusFilter); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by payment status"
        >
          <option value="">All</option>
          {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        {customerFilter && (
          <button
            onClick={() => router.push('/sales/orders')}
            className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : orders.length === 0 && !isLoading ? (
        <EmptyState
          title="No sales orders"
          description="Create your first sales order."
          action={
            <button onClick={() => router.push('/sales/orders/new')} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Order
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <QuickPayDialog order={payOrder} onClose={() => setPayOrder(null)} />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Sales Order"
        description="This will permanently delete the cancelled order."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          try {
            await deleteSalesOrder(deleteId!).unwrap();
            toast.success('Order deleted');
          } catch (err: unknown) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to delete order');
          } finally {
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
