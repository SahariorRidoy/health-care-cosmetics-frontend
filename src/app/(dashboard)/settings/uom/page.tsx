'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { FormField, TextareaField } from '@/components/forms/FormField';
import {
  useGetUOMsQuery,
  useCreateUOMMutation,
  useUpdateUOMMutation,
  useDeleteUOMMutation,
} from '@/features/inventory/services/inventoryApi';
import type { UOM } from '@/features/inventory/types';

const uomSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  description: z.string().optional(),
});
type UOMForm = z.infer<typeof uomSchema>;

function UOMDialog({
  open, uom, onClose,
}: { open: boolean; uom?: UOM | null; onClose: () => void }) {
  const isEdit = !!uom;
  const [create, { isLoading: creating }] = useCreateUOMMutation();
  const [update, { isLoading: updating }] = useUpdateUOMMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UOMForm>({
    resolver: zodResolver(uomSchema),
    values: uom ? { name: uom.name, symbol: uom.symbol, description: uom.description ?? '' } : undefined,
  });

  async function onSubmit(values: UOMForm) {
    try {
      if (isEdit) {
        await update({ id: uom._id, body: values }).unwrap();
        toast.success('UOM updated');
      } else {
        await create(values).unwrap();
        toast.success('UOM created');
      }
      onClose();
      reset();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Operation failed';
      toast.error(msg);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit UOM' : 'New UOM'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <FormField label="Name" required placeholder="e.g. Kilogram" error={errors.name?.message} {...register('name')} />
          <FormField label="Symbol" required placeholder="e.g. kg" error={errors.symbol?.message} {...register('symbol')} />
          <TextareaField label="Description" placeholder="Optional" {...register('description')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create UOM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UOMPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUOM, setEditUOM] = useState<UOM | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useGetUOMsQuery();
  const [deleteUOM, { isLoading: deleting }] = useDeleteUOMMutation();

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteUOM(deleteId).unwrap();
      toast.success('UOM deleted');
    } catch {
      toast.error('Failed to delete UOM');
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<UOM>[] = [
    { key: 'name', header: 'Name', priority: 'P1', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'symbol', header: 'Symbol', priority: 'P1' },
    { key: 'description', header: 'Description', priority: 'P2', render: (row) => row.description ?? '—' },
    { key: 'isActive', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions',
      header: '',
      priority: 'P1',
      className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => { setEditUOM(row); setDialogOpen(true); }} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Edit" title="Edit">
            <Pencil size={15} />
          </button>
          <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Units of Measure"
        description="Manage UOMs used across inventory"
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'UOM' }]}
        actions={
          <button
            onClick={() => { setEditUOM(null); setDialogOpen(true); }}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            New UOM
          </button>
        }
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          keyField="_id"
          isLoading={isLoading}
          emptyMessage="No UOMs found. Add one to get started."
        />
      )}

      <UOMDialog open={dialogOpen} uom={editUOM} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete UOM"
        description="This will soft-delete the UOM. Items using it will not be affected."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
