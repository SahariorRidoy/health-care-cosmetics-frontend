'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X, Play, CheckCircle, Archive } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { FormField, TextareaField } from '@/components/forms/FormField';
import { formatDate } from '@/lib/formatters';
import {
  useGetProductionOrderQuery,
  useUpdateProductionStatusMutation,
  useIssueMaterialsMutation,
  useRecordOutputMutation,
} from '@/features/production/services/productionApi';
import type { MaterialLine, ProductionStatus } from '@/features/production/types';

// ── Material Issue Dialog ─────────────────────────────────────────────────────

const issueSchema = z.object({
  lines: z.array(z.object({
    item: z.string(),
    name: z.string(),
    qty: z.coerce.number().min(0.001, 'Qty > 0'),
  })).min(1),
  notes: z.string().optional(),
});
type IssueForm = z.infer<typeof issueSchema>;

function IssueMaterialsDialog({
  open, orderId, materials, onClose,
}: {
  open: boolean;
  orderId: string;
  materials: MaterialLine[];
  onClose: () => void;
}) {
  const [issueMaterials, { isLoading }] = useIssueMaterialsMutation();

  const { register, control, handleSubmit, formState: { errors } } = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      lines: materials.map((m) => ({
        item: typeof m.item === 'string' ? m.item : (m.item as { _id: string })._id,
        name: typeof m.item === 'string' ? m.item : (m.item as { name: string }).name,
        qty: Math.max(0, m.plannedQty - m.issuedQty),
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: 'lines' });

  async function onSubmit(values: IssueForm) {
    try {
      await issueMaterials({
        id: orderId,
        lines: values.lines.map((l) => ({ item: l.item, qty: l.qty })),
        notes: values.notes,
      }).unwrap();
      toast.success('Materials issued');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to issue materials';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Issue Materials</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 py-4 flex flex-col gap-3">
            {fields.map((field, i) => (
              <div key={field.id} className="p-3 rounded-lg bg-slate-50 border border-border grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 items-end">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted uppercase tracking-wide">Material</span>
                  <span className="text-sm font-medium text-foreground">{field.name}</span>
                  <span className="text-xs text-secondary">
                    Planned: {materials[i]?.plannedQty} · Issued: {materials[i]?.issuedQty}
                  </span>
                </div>
                <FormField
                  label="Issue Qty"
                  type="number" min={0.001} step="0.001"
                  required
                  error={errors.lines?.[i]?.qty?.message}
                  {...register(`lines.${i}.qty`)}
                />
              </div>
            ))}
            <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Issue Materials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record Output Dialog ──────────────────────────────────────────────────────

const outputSchema = z.object({
  actualOutputQty: z.coerce.number().min(0.001, 'Output qty > 0'),
  wastageQty: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
type OutputForm = z.infer<typeof outputSchema>;

function RecordOutputDialog({
  open, orderId, plannedQty, onClose,
}: {
  open: boolean;
  orderId: string;
  plannedQty: number;
  onClose: () => void;
}) {
  const [recordOutput, { isLoading }] = useRecordOutputMutation();

  const { register, handleSubmit, formState: { errors } } = useForm<OutputForm>({
    resolver: zodResolver(outputSchema),
    defaultValues: { actualOutputQty: plannedQty, wastageQty: 0 },
  });

  async function onSubmit(values: OutputForm) {
    try {
      await recordOutput({ id: orderId, ...values }).unwrap();
      toast.success('Output recorded — order completed');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to record output';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Record Production Output</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Actual Output Qty"
              type="number" min={0.001} step="0.001"
              required
              error={errors.actualOutputQty?.message}
              hint={`Planned: ${plannedQty}`}
              {...register('actualOutputQty')}
            />
            <FormField
              label="Wastage Qty"
              type="number" min={0} step="0.001"
              error={errors.wastageQty?.message}
              {...register('wastageQty')}
            />
            <div className="col-span-full">
              <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Record Output
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ConfirmAction = 'IN_PROGRESS' | 'CLOSED';

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [issueOpen, setIssueOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const { data, isLoading, isError, refetch } = useGetProductionOrderQuery(id);
  const [updateStatus, { isLoading: statusLoading }] = useUpdateProductionStatusMutation();

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.productionOrder) return <ErrorState onRetry={refetch} />;

  const wo = data.data.productionOrder;
  const product = typeof wo.product === 'string' ? { name: wo.product, sku: '' } : wo.product as { name: string; sku: string };
  const warehouse = typeof wo.warehouse === 'string' ? wo.warehouse : (wo.warehouse as { name: string }).name;

  async function handleStatusUpdate() {
    if (!confirmAction) return;
    try {
      await updateStatus({ id, status: confirmAction }).unwrap();
      toast.success(`Order ${confirmAction === 'IN_PROGRESS' ? 'started' : 'closed'}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Status update failed';
      toast.error(msg);
    } finally {
      setConfirmAction(null);
    }
  }

  const CONFIRM_LABELS: Record<ConfirmAction, { title: string; description: string; label: string }> = {
    IN_PROGRESS: {
      title: 'Start Production',
      description: 'This will check material availability and start the production order.',
      label: 'Start',
    },
    CLOSED: {
      title: 'Close Production Order',
      description: 'This will close the order. No further changes allowed.',
      label: 'Close Order',
    },
  };

  return (
    <>
      <PageHeader
        title={wo.woNumber}
        description={`Product: ${product.name}`}
        breadcrumbs={[
          { label: 'Production' },
          { label: 'Orders', href: '/production/orders' },
          { label: wo.woNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            {wo.status === 'DRAFT' && (
              <button
                onClick={() => setConfirmAction('IN_PROGRESS')}
                className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Play size={14} aria-hidden="true" /> Start
              </button>
            )}
            {wo.status === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={() => setIssueOpen(true)}
                  className="h-9 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  Issue Materials
                </button>
                <button
                  onClick={() => setOutputOpen(true)}
                  className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <CheckCircle size={14} aria-hidden="true" /> Record Output
                </button>
              </>
            )}
            {wo.status === 'COMPLETED' && (
              <button
                onClick={() => setConfirmAction('CLOSED')}
                className="h-9 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <Archive size={14} aria-hidden="true" /> Close Order
              </button>
            )}
          </div>
        }
      />

      {/* Summary */}
      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {[
          { label: 'WO Number', value: wo.woNumber },
          { label: 'Product', value: `${product.name} (${product.sku})` },
          { label: 'Status', value: <StatusBadge status={wo.status} /> },
          { label: 'Warehouse', value: warehouse },
          { label: 'Planned Qty', value: wo.plannedQty.toString() },
          { label: 'Actual Output', value: wo.actualOutputQty > 0 ? wo.actualOutputQty.toString() : '—' },
          { label: 'Wastage', value: wo.wastageQty > 0 ? wo.wastageQty.toString() : '—' },
          { label: 'Start Date', value: wo.startDate ? formatDate(wo.startDate) : '—' },
          { label: 'Completed', value: wo.completedDate ? formatDate(wo.completedDate) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
            <span className="text-sm text-foreground">{value ?? '—'}</span>
          </div>
        ))}
        {wo.notes && (
          <div className="col-span-full flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Notes</span>
            <span className="text-sm text-foreground">{wo.notes}</span>
          </div>
        )}
      </div>

      {/* Materials table */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Materials</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Material', 'SKU', 'Planned Qty', 'Issued Qty', 'Consumed Qty', 'UOM'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wo.materials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">No materials defined.</td>
                </tr>
              ) : (
                wo.materials.map((mat: MaterialLine, i: number) => {
                  const item = typeof mat.item === 'string' ? { name: mat.item, sku: '' } : mat.item as { name: string; sku: string };
                  const uom = typeof mat.uom === 'string' ? mat.uom : (mat.uom as { symbol: string }).symbol;
                  const isShort = mat.issuedQty < mat.plannedQty && (wo.status as ProductionStatus) === 'IN_PROGRESS';
                  return (
                    <tr key={i} className="border-b border-border hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-secondary">{item.sku}</td>
                      <td className="px-4 py-3">{mat.plannedQty}</td>
                      <td className={`px-4 py-3 ${isShort ? 'text-amber-600 font-medium' : ''}`}>{mat.issuedQty}</td>
                      <td className="px-4 py-3">{mat.actualConsumedQty > 0 ? mat.actualConsumedQty : '—'}</td>
                      <td className="px-4 py-3 text-secondary">{uom}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      <IssueMaterialsDialog
        open={issueOpen}
        orderId={id}
        materials={wo.materials}
        onClose={() => setIssueOpen(false)}
      />
      <RecordOutputDialog
        open={outputOpen}
        orderId={id}
        plannedQty={wo.plannedQty}
        onClose={() => setOutputOpen(false)}
      />
      {confirmAction && (
        <ConfirmDialog
          open
          title={CONFIRM_LABELS[confirmAction].title}
          description={CONFIRM_LABELS[confirmAction].description}
          confirmLabel={CONFIRM_LABELS[confirmAction].label}
          loading={statusLoading}
          onConfirm={handleStatusUpdate}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
