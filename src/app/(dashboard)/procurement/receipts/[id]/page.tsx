'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetGoodsReceiptQuery, useGetPurchaseOrderQuery, useGetSupplierDuesQuery } from '@/features/procurement/services/procurementApi';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { PurchaseOrder } from '@/features/procurement/types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

export default function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetGoodsReceiptQuery(id, { skip: !id });

  const supplierId = (() => {
    const s = data?.data?.goodsReceipt?.supplier;
    return s && typeof s !== 'string' ? s._id : typeof s === 'string' ? s : '';
  })();
  const poId = (() => {
    const p = data?.data?.goodsReceipt?.purchaseOrder;
    return p && typeof p !== 'string' ? p._id : typeof p === 'string' ? p : '';
  })();

  const { data: poData } = useGetPurchaseOrderQuery(poId, { skip: !poId });
  const { data: duesData } = useGetSupplierDuesQuery(supplierId, { skip: !supplierId });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.goodsReceipt) return <ErrorState onRetry={refetch} />;

  const gr = data.data.goodsReceipt;
  const supplier = typeof gr.supplier === 'string' ? null : gr.supplier as { _id: string; name: string };
  const poRef = typeof gr.purchaseOrder === 'string' ? null : gr.purchaseOrder as PurchaseOrder;
  const po = poData?.data?.purchaseOrder ?? poRef;
  const warehouse = typeof gr.warehouse === 'string' ? null : gr.warehouse as { _id: string; name: string; code: string };
  const outstandingBalance = duesData?.data?.outstandingBalance ?? 0;
  const paidAmount = po?.paidAmount ?? 0;
  const paymentStatus = po?.paymentStatus;
  const dueAmount = Math.max(0, (po?.totalAmount ?? gr.totalAmount) - paidAmount);

  return (
    <>
      <PageHeader
        title={gr.grNumber}
        description={`Received: ${formatDate(gr.receivedDate)}`}
        breadcrumbs={[
          { label: 'Suppliers', href: '/procurement/suppliers' },
          { label: 'Goods Receipt' },
          { label: gr.grNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors print:hidden">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button onClick={() => window.print()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors print:hidden">
              <Printer size={15} aria-hidden="true" /> Print
            </button>
            {(paymentStatus === 'UNPAID' || paymentStatus === 'PARTIAL') && (
              <button onClick={() => setPaymentOpen(true)} className="h-9 px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-colors print:hidden">
                <CreditCard size={15} aria-hidden="true" /> Pay Due
              </button>
            )}
          </div>
        }
      />

      {/* ── PRINT DOCUMENT (hidden on screen) ─────────────────────────────── */}
      <div className="hidden print:block text-[12px] text-gray-900">

        {/* Company header */}
        <div className="flex items-start justify-between pb-4 border-b-2 border-gray-800 mb-4">
          <div>
            <p className="text-[18px] font-bold tracking-tight text-gray-900">Health Care Cosmetics</p>
            <p className="text-[11px] text-gray-500 mt-0.5">HCC ERP — Goods Receipt Voucher</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-gray-900">{gr.grNumber}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(gr.receivedDate)}</p>
          </div>
        </div>

        {/* Compact info grid */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 mb-4 pb-4 border-b border-gray-200">
          {[
            { label: 'Supplier',        value: supplier?.name ?? '—' },
            { label: 'Purchase Order',  value: po?.poNumber ?? '—' },
            { label: 'Warehouse',       value: warehouse ? `${warehouse.name} (${warehouse.code})` : '—' },
            { label: 'Received Date',   value: formatDate(gr.receivedDate) },
            { label: 'Total Amount',    value: formatCurrency(gr.totalAmount) },
            { label: 'Paid Amount',      value: formatCurrency(paidAmount) },
            { label: 'Payment Status',   value: paymentStatus ?? '—' },
            ...(paymentStatus && paymentStatus !== 'PAID' ? [{ label: 'Due Amount', value: formatCurrency(dueAmount) }] : []),
            ...(gr.notes ? [{ label: 'Notes', value: gr.notes }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="font-medium text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-gray-800">
              {['#', 'Item', 'SKU', 'Ord. Qty', 'Rcv. Qty', 'Unit Price', 'Total', 'Batch', 'Expiry'].map((h) => (
                <th key={h} className="py-1.5 pr-3 text-left font-semibold text-gray-700 uppercase tracking-wide last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gr.items.map((line, i) => {
              const item = typeof line.item === 'string' ? null : line.item as { _id: string; name: string; sku: string };
              const uom = typeof line.uom === 'string' ? line.uom : (line.uom as { symbol: string } | undefined)?.symbol ?? '';
              return (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{item?.name ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-gray-500">{item?.sku ?? '—'}</td>
                  <td className="py-1.5 pr-3">{line.orderedQty} {uom}</td>
                  <td className="py-1.5 pr-3">{line.receivedQty} {uom}</td>
                  <td className="py-1.5 pr-3">{formatCurrency(line.unitPrice)}</td>
                  <td className="py-1.5 pr-3 font-semibold">{formatCurrency(line.totalPrice)}</td>
                  <td className="py-1.5 pr-3">{line.batchNumber ?? '—'}</td>
                  <td className="py-1.5">{line.expiryDate ? formatDate(line.expiryDate) : '—'}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-800">
              <td colSpan={6} className="py-2 text-right font-semibold text-gray-700 pr-3">Grand Total</td>
              <td className="py-2 font-bold text-gray-900">{formatCurrency(gr.totalAmount)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>

        {/* Signature row */}
        <div className="grid grid-cols-3 gap-6 mt-10">
          {['Prepared By', 'Received By', 'Authorized By'].map((label) => (
            <div key={label} className="border-t border-gray-400 pt-1">
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
          Printed on {new Date().toLocaleDateString('en-BD')} — HCC ERP
        </p>
      </div>

      {/* ── SCREEN VIEW (hidden when printing) ────────────────────────────── */}

      {/* Summary */}
      <div className="print:hidden bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <InfoRow label="GR Number" value={gr.grNumber} />
        <InfoRow label="Supplier" value={
          supplier ? (
            <button onClick={() => router.push(`/procurement/suppliers/${supplier._id}`)} className="text-emerald hover:underline">
              {supplier.name}
            </button>
          ) : '—'
        } />
        <InfoRow label="Purchase Order" value={
          po ? (
            <button onClick={() => router.push(`/procurement/orders/${po._id}`)} className="text-emerald hover:underline">
              {po.poNumber}
            </button>
          ) : '—'
        } />
        <InfoRow label="Warehouse" value={warehouse ? `${warehouse.name} (${warehouse.code})` : '—'} />
        <InfoRow label="Received Date" value={formatDate(gr.receivedDate)} />
        <InfoRow label="Total Amount" value={<span className="font-semibold">{formatCurrency(gr.totalAmount)}</span>} />
        <InfoRow label="Paid Amount" value={<span className="font-semibold">{formatCurrency(paidAmount)}</span>} />
        {paymentStatus && (
          <InfoRow label="Payment Status" value={
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
              paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
              paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>{paymentStatus}</span>
          } />
        )}
        {paymentStatus && paymentStatus !== 'PAID' && (
          <InfoRow label="Due Amount" value={
            <span className="text-red-600 font-semibold">{formatCurrency(dueAmount)}</span>
          } />
        )}
        {gr.notes && <InfoRow label="Notes" value={gr.notes} />}
      </div>

      {/* Line items */}
      <div className="print:hidden bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Received Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Item', 'SKU', 'Ordered Qty', 'Received Qty', 'Unit Price', 'Total', 'Batch', 'Expiry'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gr.items.map((line, i) => {
                const item = typeof line.item === 'string' ? null : line.item as { _id: string; name: string; sku: string };
                const uom = typeof line.uom === 'string' ? line.uom : (line.uom as { symbol: string } | undefined)?.symbol ?? '';
                return (
                  <tr key={i} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {item ? (
                        <button onClick={() => router.push(`/inventory/${item._id}`)} className="text-emerald hover:underline">
                          {item.name}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-secondary">{item?.sku ?? '—'}</td>
                    <td className="px-4 py-3">{line.orderedQty} {uom}</td>
                    <td className="px-4 py-3">{line.receivedQty} {uom}</td>
                    <td className="px-4 py-3">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(line.totalPrice)}</td>
                    <td className="px-4 py-3">{line.batchNumber ?? '—'}</td>
                    <td className="px-4 py-3">{line.expiryDate ? formatDate(line.expiryDate) : '—'}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50">
                <td colSpan={5} className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase">Total</td>
                <td className="px-4 py-3 font-semibold text-sm">{formatCurrency(gr.totalAmount)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {supplier && (
        <SupplierPaymentDialog
          open={paymentOpen}
          supplierId={supplier._id}
          supplierName={supplier.name}
          outstandingBalance={outstandingBalance}
          onClose={() => setPaymentOpen(false)}
        />
      )}
    </>
  );
}
