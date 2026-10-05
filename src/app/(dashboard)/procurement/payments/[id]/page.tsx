'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetSupplierPaymentQuery, useDeleteSupplierPaymentMutation } from '@/features/procurement/services/procurementApi';
import type { Supplier } from '@/features/procurement/types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

type PORef = { _id: string; poNumber: string; totalAmount: number; paidAmount: number; paymentStatus: string; createdAt: string };
type FIFOLine = { purchaseOrder: PORef | string; appliedAmount: number };

function paymentStatusClass(status: string) {
  if (status === 'PAID') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PARTIAL') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export default function SupplierPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, isError, refetch } = useGetSupplierPaymentQuery(id, { skip: !id });
  const [deletePayment, { isLoading: deleting }] = useDeleteSupplierPaymentMutation();

  async function handleDelete() {
    try {
      await deletePayment(id).unwrap();
      toast.success('Payment deleted');
      router.push('/procurement/payments');
    } catch {
      toast.error('Failed to delete payment');
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.payment) return <ErrorState onRetry={refetch} />;

  const payment = data.data.payment;
  const supplier = typeof payment.supplier === 'string' ? null : payment.supplier as Supplier;

  // Single PO (regular payment)
  const singlePO = payment.purchaseOrder && typeof payment.purchaseOrder !== 'string'
    ? payment.purchaseOrder as PORef
    : null;

  // FIFO breakdown
  const fifoLines: FIFOLine[] = (payment.purchaseOrders ?? []).filter(
    (l) => l.purchaseOrder && typeof l.purchaseOrder !== 'string',
  );
  const isFIFO = fifoLines.length > 0;

  return (
    <>
      <PageHeader
        title={payment.paymentNumber}
        description={`Payment — ${supplier?.name ?? '—'}`}
        breadcrumbs={[
          { label: 'Procurement' },
          { label: 'Payments', href: '/procurement/payments' },
          { label: payment.paymentNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors print:hidden">
              <ArrowLeft size={15} /> Back
            </button>
            <button onClick={() => window.print()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors print:hidden">
              <Printer size={15} /> Print
            </button>
            <button onClick={() => setConfirmDelete(true)} className="h-9 px-3 rounded-md border border-red-200 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors print:hidden">
              <Trash2 size={15} /> Delete
            </button>
          </div>
        }
      />

      {/* ── PRINT DOCUMENT ─────────────────────────────────────────────────── */}
      <div className="hidden print:block text-[12px] text-gray-900 p-8">
        <div className="flex items-start justify-between pb-4 border-b-2 border-gray-800 mb-6">
          <div>
            <p className="text-[20px] font-bold text-gray-900">Health Care Cosmetics</p>
            <p className="text-[11px] text-gray-500 mt-0.5">HCC ERP — Payment Receipt</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-gray-900">{payment.paymentNumber}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(payment.paymentDate, 'dd MMM yyyy')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-8 gap-y-3 mb-6 pb-6 border-b border-gray-200">
          {[
            { label: 'Supplier', value: supplier?.name ?? '—' },
            { label: 'Contact Person', value: supplier?.contactPerson ?? '—' },
            { label: 'Phone', value: supplier?.phone ?? '—' },
            { label: 'Payment Date', value: formatDate(payment.paymentDate, 'dd MMM yyyy') },
            { label: 'Payment Method', value: payment.method },
            { label: 'Reference', value: payment.reference ?? '—' },
            ...(payment.notes ? [{ label: 'Notes', value: payment.notes }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="font-medium text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* FIFO breakdown table in print */}
        {isFIFO && (
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">Payment Distribution (FIFO)</p>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  {['PO Number', 'PO Date', 'PO Total', 'Applied Amount', 'Remaining Due', 'Status'].map((h) => (
                    <th key={h} className="py-1.5 pr-3 text-left font-semibold text-gray-700 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fifoLines.map((line, i) => {
                  const po = line.purchaseOrder as PORef;
                  const remainingDue = Math.max(0, po.totalAmount - po.paidAmount);
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 pr-3 font-medium">{po.poNumber}</td>
                      <td className="py-1.5 pr-3">{formatDate(po.createdAt)}</td>
                      <td className="py-1.5 pr-3">{formatCurrency(po.totalAmount)}</td>
                      <td className="py-1.5 pr-3 font-semibold">{formatCurrency(line.appliedAmount)}</td>
                      <td className="py-1.5 pr-3">{remainingDue > 0 ? formatCurrency(remainingDue) : '—'}</td>
                      <td className="py-1.5">{po.paymentStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800">
                  <td colSpan={3} className="py-2 font-bold text-gray-900">Total Applied</td>
                  <td className="py-2 font-bold text-gray-900">{formatCurrency(payment.amount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Single PO in print */}
        {!isFIFO && singlePO && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">Purchase Order</p>
            <div className="grid grid-cols-3 gap-x-8 gap-y-2">
              {[
                { label: 'PO Number', value: singlePO.poNumber },
                { label: 'PO Total', value: formatCurrency(singlePO.totalAmount) },
                { label: 'Status', value: singlePO.paymentStatus },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end mb-8">
          <div className="border-2 border-gray-800 rounded-lg px-8 py-4 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Total Amount Paid</p>
            <p className="text-[28px] font-bold text-gray-900">{formatCurrency(payment.amount)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{payment.method}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mt-12">
          {['Prepared By', 'Received By', 'Authorized By'].map((label) => (
            <div key={label} className="border-t border-gray-400 pt-2">
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
          Printed on {new Date().toLocaleDateString('en-BD')} — HCC ERP
        </p>
      </div>

      {/* ── SCREEN VIEW ────────────────────────────────────────────────────── */}

      {/* Amount highlight */}
      <div className="print:hidden mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
            {isFIFO ? 'Total Amount Paid (FIFO)' : 'Amount Paid'}
          </p>
          <p className="text-3xl font-bold text-emerald-800 mt-1">{formatCurrency(payment.amount)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{formatDate(payment.paymentDate, 'dd MMM yyyy')}</p>
          <span className="inline-flex items-center mt-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            {payment.method}
          </span>
          {isFIFO && (
            <p className="text-xs text-blue-600 font-medium mt-1">Auto-distributed across {fifoLines.length} PO{fifoLines.length > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="print:hidden bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <InfoRow label="Payment Number" value={<span className="font-semibold">{payment.paymentNumber}</span>} />
        <InfoRow label="Supplier" value={
          supplier ? (
            <button onClick={() => router.push(`/procurement/suppliers/${supplier._id}`)} className="text-emerald hover:underline font-medium">
              {supplier.name}
            </button>
          ) : '—'
        } />
        <InfoRow label="Payment Date" value={formatDate(payment.paymentDate, 'dd MMM yyyy, hh:mm a')} />
        <InfoRow label="Method" value={
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {payment.method}
          </span>
        } />
        <InfoRow label="Reference" value={payment.reference} />
        <InfoRow label="Notes" value={payment.notes} />
        {supplier?.contactPerson && <InfoRow label="Contact Person" value={supplier.contactPerson} />}
        {supplier?.phone && <InfoRow label="Phone" value={supplier.phone} />}
      </div>

      {/* FIFO breakdown table */}
      {isFIFO && (
        <div className="print:hidden bg-white rounded-lg border border-border mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Payment Distribution (FIFO)</h2>
            <span className="text-xs text-muted">{fifoLines.length} purchase order{fifoLines.length > 1 ? 's' : ''} affected</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">PO Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">PO Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">PO Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide">Applied</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Remaining Due</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {fifoLines.map((line, i) => {
                  const po = line.purchaseOrder as PORef;
                  const remainingDue = Math.max(0, po.totalAmount - po.paidAmount);
                  return (
                    <tr key={i} className="border-b border-border/60 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <button onClick={() => router.push(`/procurement/orders/${po._id}`)} className="font-medium text-emerald hover:underline">
                          {po.poNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(po.createdAt)}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatCurrency(po.totalAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(line.appliedAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        {remainingDue > 0
                          ? <span className="text-amber-600 font-medium">{formatCurrency(remainingDue)}</span>
                          : <span className="text-emerald-600 font-medium">Cleared</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${paymentStatusClass(po.paymentStatus)}`}>
                          {po.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-foreground uppercase">Total Applied</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(payment.amount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Single PO (regular payment) */}
      {!isFIFO && singlePO && (
        <div className="print:hidden bg-white rounded-lg border border-border p-6">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Linked Purchase Order</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InfoRow label="PO Number" value={
              <button onClick={() => router.push(`/procurement/orders/${singlePO._id}`)} className="text-emerald hover:underline font-medium">
                {singlePO.poNumber}
              </button>
            } />
            <InfoRow label="PO Total" value={formatCurrency(singlePO.totalAmount)} />
            <InfoRow label="Payment Status" value={
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${paymentStatusClass(singlePO.paymentStatus)}`}>
                {singlePO.paymentStatus}
              </span>
            } />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Payment"
        description="This will reverse all PO paid amounts and supplier balance. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
