'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X, Plus, Truck, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetPurchaseOrderQuery,
  useUpdatePOStatusMutation,
  useCreateGoodsReceiptMutation,
  useGetGoodsReceiptsQuery,
  useGetSupplierDuesQuery,
} from '@/features/procurement/services/procurementApi';
import { useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { POItem, GoodsReceipt } from '@/features/procurement/types';

// ── GR Form ───────────────────────────────────────────────────────────────────

const grLineSchema = z.object({
  item: z.string(),
  uom: z.string(),
  receivedQty: z.coerce.number().int('Quantity must be a whole number').min(1, 'Qty must be at least 1'),
  unitPrice: z.coerce.number().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const grSchema = z.object({
  warehouse: z.string().min(1, 'Warehouse required'),
  receivedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(grLineSchema).min(1),
});

type GRForm = z.infer<typeof grSchema>;

function GRDialog({ open, poId, poItems, onClose }: {
  open: boolean;
  poId: string;
  poItems: POItem[];
  onClose: () => void;
}) {
  const { data: warehouseData } = useGetWarehousesQuery();
  const [createGR, { isLoading }] = useCreateGoodsReceiptMutation();

  const { register, handleSubmit, formState: { errors } } = useForm<GRForm>({
    resolver: zodResolver(grSchema),
    defaultValues: {
      items: poItems.map((pi) => ({
        item: typeof pi.item === 'string' ? pi.item : pi.item._id,
        uom: typeof pi.uom === 'string' ? pi.uom : pi.uom._id,
        receivedQty: pi.orderedQty - pi.receivedQty,
        unitPrice: pi.unitPrice,
      })),
    },
  });

  async function onSubmit(values: GRForm) {
    try {
      await createGR({
        purchaseOrder: poId,
        warehouse: values.warehouse,
        notes: values.notes,
        receivedDate: values.receivedDate ? new Date(values.receivedDate).toISOString() : undefined,
        items: values.items.map((it) => ({
          item: it.item,
          uom: it.uom,
          receivedQty: it.receivedQty,
          unitPrice: it.unitPrice,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString() : undefined,
        })),
      }).unwrap();
      toast.success('Goods receipt created');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to create GR';
      toast.error(msg);
    }
  }

  if (!open) return null;
  const warehouses = warehouseData?.data?.warehouses.filter((w) => w.isActive) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-2xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Record Goods Receipt</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </SelectField>
            <FormField label="Received Date" type="date" {...register('receivedDate')} />
            <div className="col-span-full"><TextareaField label="Notes" {...register('notes')} /></div>
          </div>

          <div className="px-6 pb-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Items</p>
            {poItems.map((pi, i) => {
              const itemName = typeof pi.item === 'string' ? pi.item : pi.item.name;
              return (
                <div key={i} className="p-3 rounded-lg bg-slate-50 border border-border grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3 text-sm font-medium text-foreground">{itemName}</div>
                  <FormField label="Received Qty" type="number" min={1} step="1" required error={errors.items?.[i]?.receivedQty?.message} {...register(`items.${i}.receivedQty`)} />
                  <FormField label="Unit Price (৳)" type="number" min={0} step="0.01" {...register(`items.${i}.unitPrice`)} />
                  <FormField label="Batch Number" placeholder="Optional" {...register(`items.${i}.batchNumber`)} />
                  <FormField label="Expiry Date" type="date" {...register(`items.${i}.expiryDate`)} />
                </div>
              );
            })}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Post Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [grOpen, setGrOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<'CONFIRMED' | 'CLOSED' | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetPurchaseOrderQuery(id, { skip: !id });
  const { data: grData, isLoading: grLoading } = useGetGoodsReceiptsQuery({ purchaseOrder: id }, { skip: !id });
  const { data: duesData, isLoading: duesLoading } = useGetSupplierDuesQuery(
    typeof data?.data?.purchaseOrder?.supplier === 'string' ? data.data.purchaseOrder.supplier : (data?.data?.purchaseOrder?.supplier?._id ?? ''),
    { skip: !data?.data?.purchaseOrder?.supplier },
  );
  const [updateStatus, { isLoading: statusLoading }] = useUpdatePOStatusMutation();

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.purchaseOrder) return <ErrorState onRetry={refetch} />;

  const po = data.data.purchaseOrder;
  const supplier = typeof po.supplier === 'string' ? null : po.supplier;

  async function handleStatusUpdate() {
    if (!confirmStatus) return;
    try {
      await updateStatus({ id, status: confirmStatus }).unwrap();
      toast.success(`PO ${confirmStatus.toLowerCase()}`);
    } catch {
      toast.error('Status update failed');
    } finally {
      setConfirmStatus(null);
    }
  }

  const grColumns: Column<GoodsReceipt>[] = [
    { key: 'grNumber', header: 'GR Number', priority: 'P1', render: (row) => (
      <button onClick={() => router.push(`/procurement/receipts/${row._id}`)} className="font-medium text-emerald hover:underline">{row.grNumber}</button>
    )},
    { key: 'receivedDate', header: 'Date', priority: 'P1', render: (row) => formatDate(row.receivedDate) },
    { key: 'totalAmount', header: 'Total', priority: 'P1', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'notes', header: 'Notes', priority: 'P3', render: (row) => row.notes ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title={po.poNumber}
        description={`Supplier: ${supplier?.name ?? '—'}`}
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Orders', href: '/procurement/orders' }, { label: po.poNumber }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            {po.status === 'DRAFT' && (
              <button onClick={() => setConfirmStatus('CONFIRMED')} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                Confirm PO
              </button>
            )}
            {po.status === 'CONFIRMED' && (
              <button onClick={() => setGrOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <Truck size={15} aria-hidden="true" /> Receive Goods
              </button>
            )}
            {po.status === 'RECEIVED' && (
              <button onClick={() => setConfirmStatus('CLOSED')} className="h-9 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
                Close PO
              </button>
            )}
            {supplier && (duesData?.data?.outstandingBalance ?? 0) > 0 && (
              <button onClick={() => setPaymentOpen(true)} disabled={duesLoading} className="h-9 px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-60">
                {duesLoading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CreditCard size={15} aria-hidden="true" />} Pay Due
              </button>
            )}
          </div>
        }
      />

      {/* Info */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {[
          { label: 'PO Number', value: po.poNumber },
          { label: 'Supplier', value: supplier?.name },
          { label: 'Status', value: <StatusBadge status={po.status} /> },
          { label: 'Date', value: formatDate(po.createdAt) },
          { label: 'Expected Delivery', value: po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—' },
          { label: 'Total Amount', value: formatCurrency(po.totalAmount) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
            <span className="text-sm text-foreground">{value ?? '—'}</span>
          </div>
        ))}
        {po.notes && (
          <div className="col-span-full flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Notes</span>
            <span className="text-sm text-foreground">{po.notes}</span>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-lg border border-border mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Item', 'Ordered Qty', 'Received Qty', 'Unit Price', 'Total'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.items.map((line, i) => {
                const itemName = typeof line.item === 'string' ? line.item : line.item.name;
                return (
                  <tr key={i} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{itemName}</td>
                    <td className="px-4 py-3">{line.orderedQty}</td>
                    <td className="px-4 py-3">{line.receivedQty}</td>
                    <td className="px-4 py-3">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-3">{formatCurrency(line.totalPrice)}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50">
                <td colSpan={4} className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase">Total</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(po.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods receipts */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Goods Receipts</h2>
          {po.status === 'CONFIRMED' && (
            <button onClick={() => setGrOpen(true)} className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <Plus size={13} aria-hidden="true" /> Add Receipt
            </button>
          )}
        </div>
        <div className="p-4">
          <DataTable columns={grColumns} data={grData?.data?.goodsReceipts ?? []} keyField="_id" isLoading={grLoading} emptyMessage="No goods receipts yet." />
        </div>
      </div>

      <GRDialog open={grOpen} poId={id} poItems={po.items} onClose={() => setGrOpen(false)} />

      {supplier && (
        <SupplierPaymentDialog
          open={paymentOpen}
          supplierId={supplier._id}
          supplierName={supplier.name}
          outstandingBalance={duesData?.data?.outstandingBalance ?? 0}
          purchaseOrderId={id}
          onClose={() => setPaymentOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!confirmStatus}
        title={confirmStatus === 'CONFIRMED' ? 'Confirm Purchase Order' : 'Close Purchase Order'}
        description={confirmStatus === 'CONFIRMED' ? 'This will confirm the PO and allow goods receipt.' : 'This will close the PO. No further changes allowed.'}
        confirmLabel={confirmStatus === 'CONFIRMED' ? 'Confirm' : 'Close PO'}
        loading={statusLoading}
        onConfirm={handleStatusUpdate}
        onCancel={() => setConfirmStatus(null)}
      />
    </>
  );
}
