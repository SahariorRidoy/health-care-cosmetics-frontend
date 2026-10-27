'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, X, Truck, Factory, PackageCheck, PackagePlus, Undo2, Pencil, XCircle, Trash2,
  ArrowLeft, ArrowUpRight, CalendarDays, Warehouse, Boxes, ChevronLeft, ChevronRight, Check,
  Inbox, AlertTriangle, PackageOpen, StickyNote, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/feedback';
import { cn, formatCurrency, formatDate } from '@/lib/formatters';
import { FactoryBatchFormDialog } from '@/features/factory-production/components/FactoryBatchFormDialog';
import { AddReceiptDialog } from '@/features/factory-production/components/AddReceiptDialog';
import { RestockMaterialDialog } from '@/features/factory-production/components/RestockMaterialDialog';
import { ReturnMaterialDialog } from '@/features/factory-production/components/ReturnMaterialDialog';
import {
  useGetFactoryBatchesQuery, useGetFactoryBatchQuery, useDeleteFactoryBatchMutation,
  useDispatchFactoryBatchMutation, useCancelFactoryBatchMutation, useUpdateFactoryBatchStatusMutation,
} from '@/features/factory-production/services/factoryProductionApi';
import type { FactoryBatch, FactoryBatchStatus } from '@/features/factory-production/types';

/* ───────────────────────── Shared styles ───────────────────────── */

const btnBase =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 h-11 sm2:h-9 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-1 disabled:opacity-50';
const btnPrimary = `${btnBase} bg-emerald text-white shadow-sm hover:bg-emerald-600`;
const btnSecondary = `${btnBase} border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900`;
const btnBlue = `${btnBase} bg-blue-600 text-white shadow-sm hover:bg-blue-700`;
const btnViolet = `${btnBase} bg-violet-600 text-white shadow-sm hover:bg-violet-700`;
const btnEmeraldSoft = `${btnBase} border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100`;
const btnDanger =`${btnBase} bg-red-600 text-white shadow-sm hover:bg-red-700`;
const card = 'rounded-xl border border-slate-200 bg-white shadow-sm';

/* ───────────────────────── Status ───────────────────────── */

const STATUS: Record<FactoryBatchStatus, { label: string; dot: string; badge: string }> = {
  DRAFT:              { label: 'Draft',         dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  DISPATCHED:         { label: 'Dispatched',    dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  IN_PRODUCTION:      { label: 'In production', dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  PARTIALLY_RECEIVED: { label: 'Receiving',     dot: 'bg-orange-500',  badge: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
  COMPLETED:          { label: 'Completed',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  CANCELLED:          { label: 'Cancelled',     dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};
const STATUS_ORDER = Object.keys(STATUS) as FactoryBatchStatus[];
const STEPS: FactoryBatchStatus[] = ['DRAFT', 'DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED', 'COMPLETED'];

function StatusBadge({ status }: { status: FactoryBatchStatus }) {
  const s = STATUS[status] ?? STATUS.DRAFT;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', s.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

/* ───────────────────────── Derived numbers ───────────────────────── */

type Ref = { _id?: string; name?: string; sku?: string; symbol?: string } | string | null | undefined;
const idOf = (r: Ref) => (!r ? '' : typeof r === 'string' ? r : r._id ?? '');
const nameOf = (r: Ref, fallback = '—') => (r && typeof r === 'object' && r.name ? r.name : fallback);
const uomOf = (r: Ref) => (r && typeof r === 'object' ? r.symbol ?? '' : '');
const qty = (n: number, uom?: string) => `${n.toLocaleString('en-BD', { maximumFractionDigits: 3 })}${uom ? ` ${uom}` : ''}`;
const title = (b: FactoryBatch) => b.batchName.charAt(0).toUpperCase() + b.batchName.slice(1);
const errMsg = (e: unknown, f: string) => (e as { data?: { message?: string } })?.data?.message ?? f;

function metrics(b: FactoryBatch) {
  const used = new Map<string, number>();
  const returned = new Map<string, number>();
  for (const r of b.receipts ?? []) for (const p of r.products ?? []) for (const mu of p.materialsUsed ?? [])
    used.set(idOf(mu.item), (used.get(idOf(mu.item)) ?? 0) + mu.usedQty);
  for (const r of b.materialReturns ?? []) for (const m of r.materials ?? [])
    returned.set(idOf(m.item), (returned.get(idOf(m.item)) ?? 0) + m.returnedQty);

  const lines = (b.dispatch?.materials ?? []).map((m, i) => {
    const id = idOf(m.item);
    const u = used.get(id) ?? 0;
    const r = returned.get(id) ?? 0;
    const atFactory = b.status === 'CANCELLED' ? 0 : Math.max(0, Math.round((m.dispatchedQty - u - r) * 1000) / 1000);
    return {
      key: `${id}-${i}`, name: nameOf(m.item, 'Unknown material'),
      sku: m.item && typeof m.item === 'object' ? m.item.sku : '', uom: uomOf(m.uom),
      planned: m.qty, sent: m.dispatchedQty, used: u, returned: r, atFactory, unitCost: m.unitCost ?? 0,
    };
  });

  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0);
  const sent = sum(lines, (l) => l.sent * l.unitCost);
  const usedValue = sum(b.receipts ?? [], (r) => sum(r.products ?? [], (p) => p.materialCost));
  const charges = sum(b.receipts ?? [], (r) => r.deliveryCost + r.productionCost + r.otherCost);
  const pct = (f: (l: typeof lines[number]) => number) => {
    const w = sent > 0 ? (l: typeof lines[number]) => l.sent * l.unitCost : () => 1;
    const total = sum(lines.filter((l) => l.sent > 0), w);
    return total > 0 ? (sum(lines.filter((l) => l.sent > 0), (l) => w(l) * Math.min(1, f(l) / l.sent)) / total) * 100 : 0;
  };
  const usedPct = pct((l) => l.used);
  const returnedPct = Math.min(100 - usedPct, pct((l) => l.returned));
  return {
    lines,
    planned: sum(lines, (l) => l.planned * l.unitCost),
    sent, usedValue,
    atFactory: sum(lines, (l) => l.atFactory * l.unitCost),
    received: usedValue + charges,
    receivedQty: sum(b.receipts ?? [], (r) => sum(r.products ?? [], (p) => p.receivedQty)),
    usedPct, returnedPct,
    atFactoryPct: lines.some((l) => l.sent > 0) && b.status !== 'CANCELLED' ? Math.max(0, 100 - usedPct - returnedPct) : 0,
  };
}

function UsageBar({ used, returned, atFactory, className }: { used: number; returned: number; atFactory: number; className?: string }) {
  const label = `${Math.round(used)}% used, ${Math.round(returned)}% returned, ${Math.round(atFactory)}% at factory`;
  return (
    <div role="img" aria-label={label} title={label} className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <span className="h-full bg-emerald-500" style={{ width: `${used}%` }} />
      <span className="h-full bg-slate-400" style={{ width: `${returned}%` }} />
      <span className="h-full bg-amber-400" style={{ width: `${atFactory}%` }} />
    </div>
  );
}

/* ───────────────────────── List item ───────────────────────── */

function BatchItem({ batch, selected, onSelect }: { batch: FactoryBatch; selected: boolean; onSelect: () => void }) {
  const m = metrics(batch);
  const overdue = !!batch.expectedDeliveryDate && ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED'].includes(batch.status)
    && new Date(batch.expectedDeliveryDate) < new Date(new Date().toDateString());
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald',
        'xl:rounded-none xl:border-0 xl:border-b xl:border-l-[3px] xl:border-slate-100 xl:border-l-transparent xl:shadow-none',
        selected && 'xl:border-l-emerald xl:bg-emerald-50/70 xl:hover:bg-emerald-50/70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('truncate text-sm font-semibold', selected ? 'text-emerald-900' : 'text-slate-900')}>{title(batch)}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{batch.fbNumber}</p>
        </div>
        <StatusBadge status={batch.status} />
      </div>
      {batch.status === 'DRAFT' ? (
        <p className="mt-3 text-xs text-slate-500">Not dispatched · <span className="font-medium tabular-nums text-slate-700">{formatCurrency(m.planned)}</span> planned</p>
      ) : batch.status === 'CANCELLED' ? (
        <p className="mt-3 text-xs text-slate-500">{batch.dispatch?.dispatchedDate ? 'Cancelled after dispatch' : 'Cancelled before dispatch'}</p>
      ) : (
        <div className="mt-3">
          <UsageBar used={m.usedPct} returned={m.returnedPct} atFactory={m.atFactoryPct} />
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600"><span className="font-semibold tabular-nums text-slate-900">{Math.round(m.usedPct)}%</span> used</span>
            <span className={cn('truncate tabular-nums', m.atFactory > 0 ? 'font-medium text-amber-700' : 'text-slate-500')}>
              {m.atFactory > 0 ? `${formatCurrency(m.atFactory)} at factory` : 'Nothing at factory'}
            </span>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden="true" />{formatDate(batch.dispatch?.dispatchedDate ?? batch.createdAt)}</span>
        <span className="inline-flex items-center gap-1"><Boxes size={12} aria-hidden="true" />{m.lines.length} material{m.lines.length === 1 ? '' : 's'}</span>
        {batch.receipts.length > 0 && (
          <span className="inline-flex items-center gap-1"><PackageCheck size={12} aria-hidden="true" />{batch.receipts.length} receipt{batch.receipts.length === 1 ? '' : 's'}</span>
        )}
        {overdue && <span className="inline-flex items-center gap-1 font-semibold text-red-600"><AlertTriangle size={12} aria-hidden="true" />Overdue</span>}
      </div>
    </button>
  );
}

/* ───────────────────────── Detail ───────────────────────── */

type Confirm = 'dispatch' | 'inProduction' | 'complete' | 'cancel' | 'delete';
type DialogKey = 'edit' | 'receipt' | 'restock' | 'return';

function Section({ heading, sub, aside, children }: { heading: string; sub?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={card}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function BatchDetail({ batchId, onBack, onDeleted }: { batchId: string; onBack: () => void; onDeleted: () => void }) {
  const { currentData, isError, refetch } = useGetFactoryBatchQuery(batchId);
  const [dialog, setDialog] = useState<DialogKey | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [dispatchBatch, d1] = useDispatchFactoryBatchMutation();
  const [updateStatus, d2] = useUpdateFactoryBatchStatusMutation();
  const [cancelBatch, d3] = useCancelFactoryBatchMutation();
  const [deleteBatch, d4] = useDeleteFactoryBatchMutation();
  const batch = currentData?.data?.factoryBatch;
  const m = useMemo(() => (batch ? metrics(batch) : null), [batch]);

  const back = (
    <button type="button" onClick={onBack} className="mb-3 inline-flex h-11 items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 xl:hidden">
      <ArrowLeft size={16} aria-hidden="true" /> All batches
    </button>
  );

  if (!batch || !m) {
    return (
      <div>
        {back}
        {isError ? (
          <div className={cn(card, 'flex flex-col items-center px-6 py-16 text-center')}>
            <AlertTriangle size={28} className="text-red-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-slate-900">Couldn&apos;t load this batch</p>
            <button type="button" onClick={refetch} className={cn(btnSecondary, 'mt-4')}>Try again</button>
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true" aria-label="Loading batch">
            <div className={cn(card, 'h-56 animate-pulse')} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div>
            <div className={cn(card, 'h-64 animate-pulse')} />
          </div>
        )}
      </div>
    );
  }

  const s = batch.status;
  const warehouse = nameOf(batch.warehouse as Ref, 'the warehouse');
  const active = s === 'DISPATCHED' || s === 'IN_PRODUCTION' || s === 'PARTIALLY_RECEIVED';
  const leftovers = m.lines.some((l) => l.atFactory > 0);
  const tracking = s !== 'DRAFT' && s !== 'CANCELLED';

  // One clear primary action per state; secondary actions stay quiet.
  const primary = s === 'DRAFT'
    ? { label: 'Dispatch materials', icon: Truck, run: () => setConfirm('dispatch'), className: btnBlue }
    : active ? { label: 'Add receipt', icon: PackageCheck, run: () => setDialog('receipt'), className: btnPrimary } : null;
  // Status-changing steps take the color of the status they lead to.
  const secondary = [
    s === 'DRAFT' && { label: 'Edit', icon: Pencil, run: () => setDialog('edit') },
    s === 'DISPATCHED' && { label: 'Mark in production', icon: Factory, run: () => setConfirm('inProduction'), className: btnViolet },
    s === 'PARTIALLY_RECEIVED' && { label: 'Mark complete', icon: Check, run: () => setConfirm('complete'), className: btnEmeraldSoft },
    active && { label: 'Send more', icon: PackagePlus, run: () => setDialog('restock') },
    (active || s === 'COMPLETED') && leftovers && { label: 'Return', icon: Undo2, run: () => setDialog('return') },
  ].filter(Boolean) as { label: string; icon: typeof Truck; run: () => void; className?: string }[];
  const canCancel = (s === 'DRAFT' || s === 'DISPATCHED') && batch.receipts.length === 0;

  const confirmCopy: Record<Confirm, { title: string; description: string; label: string; danger?: boolean }> = {
    dispatch: { title: 'Dispatch materials?', label: 'Dispatch', description: `${m.lines.length} materials worth ${formatCurrency(m.planned)} will be deducted from ${warehouse}. This can't be undone.` },
    inProduction: { title: 'Mark as in production?', label: 'Confirm', description: 'Use this once the factory has started working on the materials.' },
    complete: { title: 'Mark this batch complete?', label: 'Mark complete', description: leftovers ? `No more receipts can be added. ${formatCurrency(m.atFactory)} of material is still at the factory — you can still record its return.` : 'All material is accounted for. No more receipts can be added afterwards.' },
    cancel: { title: 'Cancel this batch?', label: 'Cancel batch', danger: true, description: s === 'DISPATCHED' ? `Dispatched materials will be returned to ${warehouse}.` : 'Nothing was dispatched, so stock is not affected.' },
    delete: { title: 'Delete this batch?', label: 'Delete', danger: true, description: leftovers ? `Materials still at the factory will be restocked to ${warehouse}. Received goods stay in stock.` : 'The batch will be removed.' },
  };

  async function runConfirm() {
    if (!confirm || !batch) return;
    try {
      if (confirm === 'dispatch') { await dispatchBatch(batch._id).unwrap(); toast.success('Materials dispatched — stock deducted'); }
      if (confirm === 'inProduction') { await updateStatus({ id: batch._id, status: 'IN_PRODUCTION' }).unwrap(); toast.success('Batch marked as in production'); }
      if (confirm === 'complete') { await updateStatus({ id: batch._id, status: 'COMPLETED' }).unwrap(); toast.success('Batch marked complete'); }
      if (confirm === 'cancel') { await cancelBatch(batch._id).unwrap(); toast.success('Batch cancelled'); }
      if (confirm === 'delete') { await deleteBatch(batch._id).unwrap(); toast.success('Batch deleted'); setConfirm(null); onDeleted(); return; }
    } catch (err) {
      toast.error(errMsg(err, 'Action failed'));
    }
    setConfirm(null);
  }

  const current = STEPS.indexOf(s);
  const stepDates: Partial<Record<FactoryBatchStatus, string | undefined>> = {
    DRAFT: batch.createdAt, DISPATCHED: batch.dispatch?.dispatchedDate, PARTIALLY_RECEIVED: batch.receipts[0]?.receiptDate,
  };
  const hint: Record<FactoryBatchStatus, string> = {
    DRAFT: `Next: dispatch materials. Stock is deducted from ${warehouse} when you dispatch.`,
    DISPATCHED: 'Materials are at the factory. Mark in production when work starts, or add a receipt when goods arrive.',
    IN_PRODUCTION: 'The factory is producing. Add a receipt each time finished goods arrive.',
    PARTIALLY_RECEIVED: leftovers ? `${formatCurrency(m.atFactory)} of material is still at the factory. Add receipts as goods arrive or return leftovers.` : 'All dispatched material is accounted for.',
    COMPLETED: leftovers ? `${formatCurrency(m.atFactory)} of leftover material is still at the factory.` : 'This batch is complete.',
    CANCELLED: '',
  };

  const stats = s === 'DRAFT'
    ? [
        { label: 'Planned value', value: formatCurrency(m.planned), hint: `${m.lines.length} materials to send` },
        { label: 'Source warehouse', value: warehouse, hint: 'Deducted on dispatch' },
        { label: 'Expected delivery', value: batch.expectedDeliveryDate ? formatDate(batch.expectedDeliveryDate) : 'Not set', hint: 'From the factory' },
      ]
    : [
        { label: 'Material sent', value: formatCurrency(m.sent), hint: `${m.lines.length} materials at cost`, tone: 'text-blue-700' },
        { label: 'Used in production', value: formatCurrency(m.usedValue), hint: `${Math.round(m.usedPct)}% of material sent`, tone: 'text-emerald-700' },
        { label: 'Still at factory', value: formatCurrency(m.atFactory), hint: leftovers ? 'Not yet used or returned' : 'All accounted for', tone: m.atFactory > 0 ? 'text-amber-700' : '' },
        { label: 'Goods received', value: qty(m.receivedQty, 'units'), hint: batch.receipts.length ? `Cost ${formatCurrency(m.received)}` : 'No receipts yet' },
      ];

  const activity = [
    ...(batch.restockHistory ?? []).map((r) => ({ id: r._id, at: r.createdAt, date: r.restockDate, icon: PackagePlus, tone: 'bg-blue-50 text-blue-600', title: 'Sent more materials', notes: r.notes,
      chips: r.materials.map((x) => `${nameOf(x.item as Ref)} +${qty(x.qty, uomOf(x.uom as Ref))}`) })),
    ...(batch.materialReturns ?? []).map((r) => ({ id: r._id, at: r.createdAt, date: r.returnDate, icon: Undo2, tone: 'bg-slate-100 text-slate-600', title: 'Materials returned to warehouse', notes: r.notes,
      chips: r.materials.map((x) => `${nameOf(x.item as Ref)} ${qty(x.returnedQty, uomOf(x.uom as Ref))}`) })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div>
      {back}
      <div className="space-y-4">
        {/* Header */}
        <section className={card}>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={s} />
                  <span className="font-mono text-xs text-slate-500">{batch.fbNumber}</span>
                </div>
                <h2 className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-xl">{title(batch)}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><Warehouse size={14} aria-hidden="true" />{warehouse}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />Created {formatDate(batch.createdAt)}</span>
                  {batch.expectedDeliveryDate && <span>Due {formatDate(batch.expectedDeliveryDate)}</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <Link href={`/factory-production/${batch._id}`} className={btnSecondary} title="Open full page">
                  View details <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                {canCancel && <button type="button" onClick={() => setConfirm('cancel')} className={cn(btnDanger, 'ml-1')}><XCircle size={15} aria-hidden="true" />Cancel</button>}
                <button type="button" onClick={() => setConfirm('delete')} className={cn(btnDanger, canCancel ? '' : 'ml-1')}><Trash2 size={15} aria-hidden="true" />Delete</button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {primary && (
                <button type="button" onClick={primary.run} className={cn(primary.className, 'flex-1 sm:flex-none')}>
                  <primary.icon size={16} aria-hidden="true" />{primary.label}
                </button>
              )}
              {secondary.map((a) => (
                <button key={a.label} type="button" onClick={a.run} className={a.className ?? btnSecondary}>
                  <a.icon size={15} aria-hidden="true" />{a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
            {s === 'CANCELLED' ? (
              <p className="text-sm text-slate-600">This batch was cancelled{batch.dispatch?.dispatchedDate ? ' — dispatched materials were returned to stock.' : ' before dispatch.'}</p>
            ) : (
              <>
                <p className="mb-2.5 text-xs font-medium text-slate-500 sm:hidden">
                  Step {current + 1} of {STEPS.length} · <span className="font-semibold text-slate-900">{STATUS[s].label}</span>
                </p>
                <ol className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Batch progress">
                  {STEPS.map((step, i) => {
                    const done = i < current || s === 'COMPLETED';
                    const isCurrent = i === current;
                    const date = stepDates[step];
                    return (
                      <li key={step} className="min-w-0" aria-current={isCurrent ? 'step' : undefined}>
                        <span className={cn('block h-1.5 rounded-full', done || isCurrent ? 'bg-emerald-500' : 'bg-slate-200')} />
                        <span className="sr-only sm:not-sr-only sm:mt-2 sm:block">
                          <span className={cn('flex items-center gap-1 truncate text-xs font-semibold', done || isCurrent ? 'text-slate-900' : 'text-slate-400')}>
                            {done && <Check size={12} strokeWidth={3} className="shrink-0 text-emerald-600" aria-hidden="true" />}
                            <span className="truncate">{STATUS[step].label}</span>
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">{date ? formatDate(date) : isCurrent ? 'Current' : ' '}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {hint[s] && (
                  <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600">
                    <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />{hint[s]}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Key numbers */}
        {s !== 'CANCELLED' && (
          <div className={cn('grid grid-cols-2 gap-3', stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
            {stats.map((st, i) => (
              <div key={st.label} className={cn('min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm', stats.length === 3 && i === 2 && 'col-span-2 md:col-span-1')}>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{st.label}</p>
                <p className={cn('truncate text-base font-bold tabular-nums text-slate-900', 'tone' in st && st.tone)} title={st.value}>{st.value}</p>
                <p className="truncate text-xs text-slate-500">{st.hint}</p>
              </div>
            ))}
          </div>
        )}

        {/* Materials */}
        <Section
          heading={`Materials (${m.lines.length})`}
          sub={tracking ? 'Where everything sent to the factory went' : 'Planned — stock is deducted on dispatch'}
          aside={tracking && (
            <ul className="flex flex-wrap gap-x-3 text-[11px] text-slate-500">
              <li className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Used</li>
              <li className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />Returned</li>
              <li className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />At factory</li>
            </ul>
          )}
        >
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-5 py-2.5">Material</th>
                  {tracking
                    ? ['Sent', 'Used', 'Returned', 'At factory'].map((h) => <th key={h} scope="col" className="px-3 py-2.5 text-right">{h}</th>)
                    : <><th scope="col" className="px-3 py-2.5 text-right">Quantity</th><th scope="col" className="px-3 py-2.5 text-right">Unit cost</th></>}
                  <th scope="col" className="px-5 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m.lines.map((l) => (
                  <tr key={l.key} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{l.name}</p>
                      {l.sku && <p className="font-mono text-[11px] text-slate-500">{l.sku}</p>}
                      {tracking && l.sent > 0 && (
                        <UsageBar className="mt-2 max-w-[200px]" used={(Math.min(l.used, l.sent) / l.sent) * 100} returned={(Math.min(l.returned, l.sent) / l.sent) * 100} atFactory={(l.atFactory / l.sent) * 100} />
                      )}
                    </td>
                    {tracking ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{qty(l.sent, l.uom)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{qty(l.used, l.uom)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{qty(l.returned, l.uom)}</td>
                        <td className={cn('whitespace-nowrap px-3 py-3 text-right tabular-nums', l.atFactory > 0 ? 'font-semibold text-amber-700' : 'text-slate-400')}>{qty(l.atFactory, l.uom)}</td>
                      </>
                    ) : (
                      <>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{qty(l.planned, l.uom)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{formatCurrency(l.unitCost)}</td>
                      </>
                    )}
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency((tracking ? l.sent : l.planned) * l.unitCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {m.lines.map((l) => (
              <li key={l.key} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
                    <p className="truncate text-[11px] text-slate-500">@ {formatCurrency(l.unitCost)}{l.uom && ` / ${l.uom}`}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency((tracking ? l.sent : l.planned) * l.unitCost)}</p>
                </div>
                {tracking && l.sent > 0 ? (
                  <>
                    <UsageBar className="mt-2.5" used={(Math.min(l.used, l.sent) / l.sent) * 100} returned={(Math.min(l.returned, l.sent) / l.sent) * 100} atFactory={(l.atFactory / l.sent) * 100} />
                    <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {[['Sent', l.sent], ['Used', l.used], ['Returned', l.returned], ['At factory', l.atFactory]].map(([label, v]) => (
                        <div key={label} className="flex justify-between gap-2">
                          <dt className="text-slate-500">{label}</dt>
                          <dd className={cn('tabular-nums', label === 'At factory' && (v as number) > 0 ? 'font-semibold text-amber-700' : 'text-slate-700')}>{qty(v as number, l.uom)}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">Quantity {qty(l.planned, l.uom)}</p>
                )}
              </li>
            ))}
          </ul>
          {!tracking && (
            <div className="flex justify-between rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm sm:px-5">
              <span className="font-medium text-slate-600">Total planned</span>
              <span className="font-bold tabular-nums text-slate-900">{formatCurrency(m.planned)}</span>
            </div>
          )}
          {batch.dispatch?.notes && <p className="border-t border-slate-100 px-4 py-3 text-[13px] text-slate-600 sm:px-5"><span className="font-medium text-slate-900">Dispatch note:</span> {batch.dispatch.notes}</p>}
        </Section>

        {/* Receipts */}
        {tracking && (
          <Section heading={`Production receipts (${batch.receipts.length})`} sub="Finished goods delivered by the factory">
            {batch.receipts.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><PackageOpen size={22} aria-hidden="true" /></span>
                <p className="mt-3 text-sm font-semibold text-slate-900">No receipts yet</p>
                <p className="mt-1 max-w-xs text-[13px] text-slate-500">Record a receipt each time the factory delivers finished goods.</p>
                {active && <button type="button" onClick={() => setDialog('receipt')} className={cn(btnSecondary, 'mt-4')}><PackageCheck size={15} aria-hidden="true" />Add receipt</button>}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...batch.receipts].reverse().map((r, i) => {
                  const total = r.products.reduce((t, p) => t + p.materialCost, 0) + r.deliveryCost + r.productionCost + r.otherCost;
                  return (
                    <li key={r._id}>
                      <details className="group" open={i === 0}>
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-slate-50 sm:px-5 [&::-webkit-details-marker]:hidden">
                          <ChevronRight size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[13px] font-semibold text-slate-900">{r.receiptNumber}</p>
                            <p className="truncate text-xs text-slate-500">{formatDate(r.receiptDate)} · {r.products.length} product{r.products.length === 1 ? '' : 's'}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</p>
                            <p className="text-[11px] text-slate-500">total cost</p>
                          </div>
                        </summary>
                        <div className="space-y-3 px-4 pb-4 sm:px-5">
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {[['Production', r.productionCost], ['Delivery', r.deliveryCost], ['Other', r.otherCost]].filter(([, v]) => (v as number) > 0).map(([label, v]) => (
                              <span key={label} className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{label} {formatCurrency(v as number)}</span>
                            ))}
                          </div>
                          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {r.products.map((p, pi) => {
                              const margin = p.salePrice ? ((p.salePrice - p.totalUnitCost) / p.salePrice) * 100 : null;
                              return (
                                <li key={pi} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-[13px]">
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900">{p.productName}</p>
                                    <p className="text-xs text-slate-500">{qty(p.receivedQty, uomOf(p.uom as Ref))} · materials {formatCurrency(p.materialCost)} · shared {formatCurrency(p.allocatedSharedCost)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.totalUnitCost)} <span className="text-xs font-normal text-slate-500">/ unit</span></p>
                                    {p.salePrice ? (
                                      <p className={cn('text-xs tabular-nums', margin !== null && margin < 0 ? 'text-red-600' : 'text-emerald-700')}>
                                        Sells {formatCurrency(p.salePrice)}{margin !== null && ` · ${margin.toFixed(1)}% margin`}
                                      </p>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        )}

        {/* Notes + activity */}
        {batch.notes && (
          <section className={cn(card, 'px-4 py-3.5 sm:px-5')}>
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><StickyNote size={13} aria-hidden="true" />Notes</h3>
            <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{batch.notes}</p>
          </section>
        )}
        {activity.length > 0 && (
          <Section heading="Restocks & returns">
            <ol className="space-y-4 px-4 py-4 sm:px-5">
              {activity.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', e.tone)}><e.icon size={15} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{e.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(e.date)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {e.chips.map((c, ci) => <span key={ci} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{c}</span>)}
                    </div>
                    {e.notes && <p className="mt-1.5 text-xs italic text-slate-500">“{e.notes}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>

      {dialog === 'edit' && <FactoryBatchFormDialog open onClose={() => setDialog(null)} batch={batch} />}
      {dialog === 'receipt' && <AddReceiptDialog open onClose={() => setDialog(null)} batch={batch} />}
      {dialog === 'restock' && <RestockMaterialDialog open onClose={() => setDialog(null)} batch={batch} />}
      {dialog === 'return' && <ReturnMaterialDialog open onClose={() => setDialog(null)} batch={batch} />}
      <ConfirmDialog
        open={!!confirm}
        title={confirm ? confirmCopy[confirm].title : ''}
        description={confirm ? confirmCopy[confirm].description : ''}
        confirmLabel={confirm ? confirmCopy[confirm].label : 'Confirm'}
        variant={confirm && confirmCopy[confirm].danger ? 'danger' : 'default'}
        loading={d1.isLoading || d2.isLoading || d3.isLoading || d4.isLoading}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function FactoryProductionPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FactoryBatchStatus | ''>('');

  const { data, isLoading, isFetching, isError, refetch } = useGetFactoryBatchesQuery({
    page, search: search.trim() || undefined, status: status || undefined,
  });
  const batches = data?.data?.factoryBatches ?? [];
  const pagination = data?.pagination;
  const stats = data?.data?.stats;
  const effectiveId = selectedId && batches.some((b) => b._id === selectedId) ? selectedId : batches[0]?._id ?? null;
  const hasFilters = !!(search || status);

  function select(id: string) {
    setSelectedId(id);
    setShowDetail(true);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <header className="page-header mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 shrink-0">
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted">
            Production <ChevronRight size={12} aria-hidden="true" /> <span className="text-secondary">Factory Production</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-foreground md:text-2xl">Factory Production</h1>
            <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimary}>
              <Plus size={16} aria-hidden="true" /> New batch
            </button>
          </div>
          <p className="mt-1 text-sm text-secondary">Send materials to the factory and receive finished goods.</p>
        </div>

        <div
          aria-label="Factory production totals"
          aria-busy={isLoading}
          className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 xl:max-w-[760px] xl:flex-1"
        >
          {!stats
            ? [0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-xl border border-slate-200 bg-white" />)
            : [
                { label: 'Active batches', value: stats.active.toLocaleString('en-BD'), hint: stats.drafts ? `${stats.drafts} draft${stats.drafts === 1 ? '' : 's'} to dispatch` : 'No drafts waiting', tone: 'text-slate-900' },
                { label: 'At factory', value: formatCurrency(stats.atFactoryValue), hint: 'Material not yet used', tone: stats.atFactoryValue > 0 ? 'text-amber-700' : 'text-slate-900' },
                { label: 'Material sent', value: formatCurrency(stats.sentValue), hint: 'All batches, at cost', tone: 'text-blue-700' },
                { label: 'Goods received', value: formatCurrency(stats.receivedValue), hint: `${stats.completed} batch${stats.completed === 1 ? '' : 'es'} completed`, tone: 'text-emerald-700' },
              ].map((c) => (
                <div key={c.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                  <p className={cn('truncate text-base font-bold tabular-nums', c.tone)} title={c.value}>{c.value}</p>
                  <p className="truncate text-xs text-slate-500" title={c.hint}>{c.hint}</p>
                </div>
              ))}
        </div>
      </header>

      <div className={cn('xl:grid xl:items-start xl:gap-5', listCollapsed ? 'xl:grid-cols-[56px_minmax(0,1fr)]' : 'xl:grid-cols-[360px_minmax(0,1fr)]')}>
        {/* List */}
        <section
          aria-label="Factory batches"
          className={cn(
            'min-w-0 xl:sticky xl:top-20 xl:flex xl:max-h-[calc(100dvh-6rem)] xl:flex-col xl:overflow-hidden xl:rounded-xl xl:border xl:border-slate-200 xl:bg-white xl:shadow-sm',
            showDetail && 'hidden xl:flex',
          )}
        >
          {/* Collapsed rail — desktop only */}
          {listCollapsed && (
            <div className="hidden flex-col items-center gap-3 py-3 xl:flex">
              <button
                type="button"
                onClick={() => setListCollapsed(false)}
                aria-label="Expand batch list"
                aria-expanded={false}
                title="Expand batch list"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald text-white shadow-sm transition-colors hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2"
              >
                <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 [writing-mode:vertical-rl] rotate-180">
                Batches{pagination ? ` · ${pagination.total}` : ''}
              </span>
            </div>
          )}

          <div className={cn('mb-3 space-y-3 xl:mb-0 xl:border-b xl:border-slate-200 xl:p-3', listCollapsed && 'xl:hidden')}>
            <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search batch name or FB number…"
                aria-label="Search factory batches"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/25 sm2:h-9"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search" className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setListCollapsed(true)}
              aria-label="Collapse batch list"
              aria-expanded
              title="Collapse batch list"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald text-white shadow-sm transition-colors hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 xl:inline-flex"
            >
              <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
            </div>
            <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 xl:gap-1.5 xl:pb-0">
              {(['', ...STATUS_ORDER] as const).map((v) => {
                const on = status === v;
                return (
                  <button
                    key={v || 'all'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setStatus(v); setPage(1); }}
                    className={cn(
                      'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors sm2:h-8 xl:px-2.5 xl:text-xs',
                      on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                    )}
                  >
                    {v && <span className={cn('h-1.5 w-1.5 rounded-full', STATUS[v].dot)} aria-hidden="true" />}
                    {v ? STATUS[v].label : 'All'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn('grid gap-3 lg:grid-cols-2 xl:block xl:min-h-0 xl:flex-1 xl:overflow-y-auto', isFetching && !isLoading && 'opacity-60 transition-opacity', listCollapsed && 'xl:hidden')} aria-busy={isFetching}>
            {isError ? (
              <div className="col-span-full flex flex-col items-center px-4 py-12 text-center">
                <AlertTriangle size={24} className="text-red-400" aria-hidden="true" />
                <p className="mt-2 text-sm text-slate-600">Couldn&apos;t load batches</p>
                <button type="button" onClick={refetch} className={cn(btnSecondary, 'mt-3')}>Try again</button>
              </div>
            ) : isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 xl:rounded-none xl:border-0 xl:border-b xl:border-slate-100" aria-hidden="true">
                  <div className="flex justify-between gap-3"><div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-100" /><div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" /></div>
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
                </div>
              ))
            ) : batches.length === 0 ? (
              <div className="col-span-full flex flex-col items-center px-4 py-14 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Inbox size={22} aria-hidden="true" /></span>
                <p className="mt-3 text-sm font-semibold text-slate-900">{hasFilters ? 'No batches match' : 'No factory batches yet'}</p>
                <p className="mt-1 max-w-xs text-[13px] text-slate-500">{hasFilters ? 'Try a different search or status.' : 'Create a batch to send materials to the factory.'}</p>
                {hasFilters ? (
                  <button type="button" onClick={() => { setSearch(''); setStatus(''); setPage(1); }} className={cn(btnSecondary, 'mt-4')}>Clear filters</button>
                ) : (
                  <button type="button" onClick={() => setCreateOpen(true)} className={cn(btnPrimary, 'mt-4')}><Plus size={16} aria-hidden="true" />New batch</button>
                )}
              </div>
            ) : (
              batches.map((b) => <BatchItem key={b._id} batch={b} selected={b._id === effectiveId} onSelect={() => select(b._id)} />)
            )}
          </div>

          {pagination && pagination.total > 0 && (
            <nav aria-label="Pagination" className={cn('mt-4 flex items-center justify-between gap-3 xl:mt-0 xl:shrink-0 xl:border-t xl:border-slate-200 xl:px-3 xl:py-2', listCollapsed && 'xl:hidden')}>
              <p className="text-xs tabular-nums text-slate-500">
                {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              {pagination.pages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setPage((p) => p - 1)} disabled={pagination.page <= 1} aria-label="Previous page" className={cn(btnSecondary, 'w-11 px-0 sm2:w-9')}><ChevronLeft size={16} aria-hidden="true" /></button>
                  <span className="min-w-[48px] text-center text-xs font-medium tabular-nums text-slate-600">{pagination.page} / {pagination.pages}</span>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={pagination.page >= pagination.pages} aria-label="Next page" className={cn(btnSecondary, 'w-11 px-0 sm2:w-9')}><ChevronRight size={16} aria-hidden="true" /></button>
                </div>
              )}
            </nav>
          )}
        </section>

        {/* Detail */}
        <div className={cn('min-w-0', showDetail ? 'block' : 'hidden xl:block')}>
          {effectiveId ? (
            <BatchDetail
              key={effectiveId}
              batchId={effectiveId}
              onBack={() => setShowDetail(false)}
              onDeleted={() => { setSelectedId(null); setShowDetail(false); }}
            />
          ) : !isLoading && (
            <div className={cn(card, 'flex flex-col items-center px-6 py-20 text-center')}>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Factory size={26} aria-hidden="true" /></span>
              <p className="mt-3 text-sm font-semibold text-slate-900">No batch selected</p>
              <p className="mt-0.5 text-sm text-slate-500">Pick a batch from the list to see its details.</p>
            </div>
          )}
        </div>
      </div>

      {createOpen && <FactoryBatchFormDialog open onClose={() => setCreateOpen(false)} />}
    </>
  );
}
