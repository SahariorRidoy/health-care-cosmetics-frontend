'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/lib/store/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, X, Building2, Lock, Users, Ruler, ArrowRight, Warehouse as WarehouseIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { FormField, TextareaField } from '@/components/forms/FormField';
import { cn, formatNumber } from '@/lib/formatters';
import {
  useGetUOMsQuery,
  useCreateUOMMutation,
  useUpdateUOMMutation,
  useDeleteUOMMutation,
} from '@/features/inventory/services/inventoryApi';
import {
  useGetUOMConversionsQuery,
  useCreateUOMConversionMutation,
  useUpdateUOMConversionMutation,
  useDeleteUOMConversionMutation,
} from '@/features/settings/services/settingsApi';
import type { UOM } from '@/features/inventory/types';
import type { UOMConversion } from '@/features/settings/types';

const SETTINGS_TABS = [
  { id: 'company', label: 'Company Info', icon: Building2, href: '/settings?tab=company' },
  { id: 'uom', label: 'Units of Measure', icon: Ruler, href: '/settings/uom' },
  { id: 'warehouses', label: 'Warehouses', icon: WarehouseIcon, href: '/settings/warehouses' },
  { id: 'users', label: 'User Management', icon: Users, href: '/settings?tab=users' },
  { id: 'password', label: 'Change Password', icon: Lock, href: '/settings?tab=password' },
];

// ── UOM Dialog ────────────────────────────────────────────────────────────────

const uomSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  description: z.string().optional(),
});
type UOMForm = z.infer<typeof uomSchema>;

function UOMDialog({ open, uom, onClose }: { open: boolean; uom?: UOM | null; onClose: () => void }) {
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
      onClose(); reset();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Operation failed');
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit UOM' : 'New UOM'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
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

// ── Conversion Dialog ─────────────────────────────────────────────────────────

const conversionSchema = z.object({
  fromUOM: z.string().min(1, 'From unit is required'),
  toUOM: z.string().min(1, 'To unit is required'),
  factor: z.coerce.number().positive('Factor must be a positive number'),
});
type ConversionForm = z.infer<typeof conversionSchema>;

function ConversionDialog({
  open, conversion, uoms, onClose,
}: { open: boolean; conversion?: UOMConversion | null; uoms: UOM[]; onClose: () => void }) {
  const isEdit = !!conversion;
  const [create, { isLoading: creating }] = useCreateUOMConversionMutation();
  const [update, { isLoading: updating }] = useUpdateUOMConversionMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ConversionForm>({
    resolver: zodResolver(conversionSchema),
    values: conversion
      ? { fromUOM: conversion.fromUOM._id, toUOM: conversion.toUOM._id, factor: conversion.factor }
      : undefined,
  });

  const fromId = watch('fromUOM');
  const toId = watch('toUOM');
  const factor = watch('factor');
  const fromSymbol = uoms.find((u) => u._id === fromId)?.symbol ?? '?';
  const toSymbol = uoms.find((u) => u._id === toId)?.symbol ?? '?';

  async function onSubmit(values: ConversionForm) {
    try {
      if (isEdit) {
        await update({ id: conversion._id, factor: values.factor }).unwrap();
        toast.success('Conversion updated');
      } else {
        await create(values).unwrap();
        toast.success('Conversion created');
      }
      onClose(); reset();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Operation failed');
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Conversion' : 'New Conversion'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">From Unit <span className="text-red-500">*</span></label>
              <select
                {...register('fromUOM')}
                disabled={isEdit}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald disabled:bg-slate-50 disabled:text-secondary"
              >
                <option value="">Select unit</option>
                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
              </select>
              {errors.fromUOM && <p className="text-xs text-red-500">{errors.fromUOM.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">To Unit <span className="text-red-500">*</span></label>
              <select
                {...register('toUOM')}
                disabled={isEdit}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald disabled:bg-slate-50 disabled:text-secondary"
              >
                <option value="">Select unit</option>
                {uoms.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.symbol})</option>)}
              </select>
              {errors.toUOM && <p className="text-xs text-red-500">{errors.toUOM.message}</p>}
            </div>
          </div>

          <FormField
            label="Conversion Factor"
            required
            type="number"
            step="any"
            placeholder="e.g. 1000"
            error={errors.factor?.message}
            {...register('factor')}
          />

          {/* Live preview */}
          {fromId && toId && factor > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md text-sm text-secondary">
              <span className="font-medium text-foreground">1 {fromSymbol}</span>
              <ArrowRight size={14} className="shrink-0" />
              <span className="font-medium text-emerald-700">{formatNumber(factor)} {toSymbol}</span>
            </div>
          )}

          <p className="text-xs text-muted">
            Examples: kg → g = 1000 &nbsp;|&nbsp; L → ml = 1000 &nbsp;|&nbsp; dozen → pcs = 12
          </p>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Conversion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UOMPage() {
  const pathname = usePathname();
  const currentUser = useAppSelector((s) => s.auth.user);
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'units' | 'conversions'>('units');

  // UOM state
  const [uomDialogOpen, setUomDialogOpen] = useState(false);
  const [editUOM, setEditUOM] = useState<UOM | null>(null);
  const [deleteUOMId, setDeleteUOMId] = useState<string | null>(null);

  // Conversion state
  const [convDialogOpen, setConvDialogOpen] = useState(false);
  const [editConversion, setEditConversion] = useState<UOMConversion | null>(null);
  const [deleteConvId, setDeleteConvId] = useState<string | null>(null);

  const { data: uomData, isLoading: uomLoading, isError: uomError, refetch: refetchUOMs } = useGetUOMsQuery();
  const [deleteUOM, { isLoading: deletingUOM }] = useDeleteUOMMutation();

  const { data: convData, isLoading: convLoading, isError: convError, refetch: refetchConv } = useGetUOMConversionsQuery();
  const [deleteConversion, { isLoading: deletingConv }] = useDeleteUOMConversionMutation();

  const uoms = uomData?.data.uoms ?? [];

  async function handleDeleteUOM() {
    if (!deleteUOMId) return;
    try { await deleteUOM(deleteUOMId).unwrap(); toast.success('UOM deleted'); }
    catch { toast.error('Failed to delete UOM'); }
    finally { setDeleteUOMId(null); }
  }

  async function handleDeleteConversion() {
    if (!deleteConvId) return;
    try { await deleteConversion(deleteConvId).unwrap(); toast.success('Conversion deleted'); }
    catch { toast.error('Failed to delete conversion'); }
    finally { setDeleteConvId(null); }
  }

  const uomColumns: Column<UOM>[] = [
    { key: 'name', header: 'Name', priority: 'P1', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'symbol', header: 'Symbol', priority: 'P1' },
    { key: 'description', header: 'Description', priority: 'P2', render: (row) => row.description ?? '—' },
    { key: 'isActive', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => { setEditUOM(row); setUomDialogOpen(true); }} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Edit" title="Edit"><Pencil size={15} /></button>
          <button onClick={() => setDeleteUOMId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  const convColumns: Column<UOMConversion>[] = [
    {
      key: 'fromUOM', header: 'From', priority: 'P1',
      render: (row) => <span className="font-medium">{row.fromUOM.name} <span className="text-muted">({row.fromUOM.symbol})</span></span>,
    },
    {
      key: 'arrow', header: '', priority: 'P1',
      render: () => <ArrowRight size={14} className="text-muted" />,
    },
    {
      key: 'toUOM', header: 'To', priority: 'P1',
      render: (row) => <span className="font-medium">{row.toUOM.name} <span className="text-muted">({row.toUOM.symbol})</span></span>,
    },
    {
      key: 'factor', header: 'Factor', priority: 'P1',
      render: (row) => (
        <span className="font-mono text-sm">
          1 {row.fromUOM.symbol} = <span className="text-emerald-700 font-semibold">{formatNumber(row.factor)}</span> {row.toUOM.symbol}
        </span>
      ),
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => { setEditConversion(row); setConvDialogOpen(true); }} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Edit" title="Edit"><Pencil size={15} /></button>
          <button onClick={() => setDeleteConvId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and system configuration"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      {/* Settings tab bar */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {SETTINGS_TABS.filter(({ id }) => id !== 'users' || isAdmin).map(({ id, label, icon: Icon, href }) => {
          const active = pathname === href && id === 'uom';
          return (
            <Link key={id} href={href} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0', active ? 'border-emerald text-emerald-700' : 'border-transparent text-secondary hover:text-foreground')}>
              <Icon size={16} aria-hidden="true" />{label}
            </Link>
          );
        })}
      </div>

      {/* Units / Conversions sub-tabs */}
      <div className="flex gap-1 mb-5">
        {(['units', 'conversions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-navy text-white'
                : 'text-secondary hover:bg-slate-100',
            )}
          >
            {tab === 'units' ? 'Units' : 'Conversions'}
          </button>
        ))}
      </div>

      {activeTab === 'units' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditUOM(null); setUomDialogOpen(true); }} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" />New UOM
            </button>
          </div>
          {uomError ? (
            <ErrorState onRetry={refetchUOMs} />
          ) : (
            <DataTable columns={uomColumns} data={uoms} keyField="_id" isLoading={uomLoading} emptyMessage="No UOMs found. Add one to get started." />
          )}
        </>
      )}

      {activeTab === 'conversions' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-secondary">
              Define how units convert to each other. Used for automatic cost calculation in production.
            </p>
            <button onClick={() => { setEditConversion(null); setConvDialogOpen(true); }} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors shrink-0 ml-4">
              <Plus size={16} aria-hidden="true" />New Conversion
            </button>
          </div>
          {convError ? (
            <ErrorState onRetry={refetchConv} />
          ) : (
            <DataTable columns={convColumns} data={convData?.data.conversions ?? []} keyField="_id" isLoading={convLoading} emptyMessage="No conversions yet. Add conversions like kg → g = 1000." />
          )}
        </>
      )}

      <UOMDialog open={uomDialogOpen} uom={editUOM} onClose={() => setUomDialogOpen(false)} />
      <ConversionDialog open={convDialogOpen} conversion={editConversion} uoms={uoms} onClose={() => setConvDialogOpen(false)} />

      <ConfirmDialog open={!!deleteUOMId} title="Delete UOM" description="This will soft-delete the UOM." confirmLabel="Delete" variant="danger" loading={deletingUOM} onConfirm={handleDeleteUOM} onCancel={() => setDeleteUOMId(null)} />
      <ConfirmDialog open={!!deleteConvId} title="Delete Conversion" description="This will remove the UOM conversion rule." confirmLabel="Delete" variant="danger" loading={deletingConv} onConfirm={handleDeleteConversion} onCancel={() => setDeleteConvId(null)} />
    </>
  );
}
