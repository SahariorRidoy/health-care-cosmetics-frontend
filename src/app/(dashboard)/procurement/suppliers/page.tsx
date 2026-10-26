'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Pencil, Trash2, Eye, CreditCard, ShoppingCart, MoreVertical, Building2,
  Phone, Mail, MapPin, Printer, ChevronLeft, ChevronRight, ArrowLeft, Wallet, Receipt, Scale, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetSuppliersQuery, useDeleteSupplierMutation,
  useGetSupplierDuesQuery, useGetSupplierPaymentsQuery, useGetPurchaseOrdersQuery,
  useLazyGetPurchaseOrdersQuery, useLazyGetSupplierPaymentsQuery,
} from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { SupplierFIFOPaymentDialog } from '@/features/procurement/components/SupplierFIFOPaymentDialog';
import type { Supplier, PurchaseOrder, SupplierPayment, POItem } from '@/features/procurement/types';

interface LedgerPayment { id: string; ref: string; amount: number }
interface LedgerEntry {
  kind: 'purchase' | 'payment';
  date: string;
  ref: string;
  id: string;
  purchaseAmount: number;
  paidAmount: number;
  items: POItem[];
  payments: LedgerPayment[];
}

function poItemName(line: POItem): string {
  return typeof line.item === 'string' ? '—' : line.item?.name ?? '—';
}

function poItemUom(line: POItem): string {
  return typeof line.uom === 'string' ? '' : line.uom?.symbol ?? '';
}

function refId(value: unknown): string {
  if (typeof value === 'string') return value;
  return (value as { _id?: string } | null | undefined)?._id ?? '';
}

function buildLedger(pos: PurchaseOrder[], payments: SupplierPayment[]): (LedgerEntry & { balance: number })[] {
  const byPo = new Map<string, LedgerPayment[]>();
  const standalone: LedgerEntry[] = [];

  for (const pay of payments) {
    const allocations = pay.purchaseOrders?.length
      ? pay.purchaseOrders.map((a) => ({ poId: refId(a.purchaseOrder), applied: a.appliedAmount }))
      : pay.purchaseOrder
        ? [{ poId: refId(pay.purchaseOrder), applied: pay.amount }]
        : [];

    let attached = 0;
    for (const a of allocations) {
      if (!pos.some((po) => po._id === a.poId)) continue;
      attached += a.applied;
      byPo.set(a.poId, [...(byPo.get(a.poId) ?? []), { id: pay._id, ref: pay.paymentNumber, amount: a.applied }]);
    }

    const remainder = pay.amount - attached;
    if (remainder > 0.005) {
      standalone.push({
        kind: 'payment', date: pay.paymentDate, ref: pay.paymentNumber, id: pay._id,
        purchaseAmount: 0, paidAmount: remainder, items: [],
        payments: [{ id: pay._id, ref: pay.paymentNumber, amount: remainder }],
      });
    }
  }

  const entries: LedgerEntry[] = [
    ...pos.map((po) => {
      const linked = byPo.get(po._id) ?? [];
      return {
        kind: 'purchase' as const,
        date: po.createdAt,
        ref: po.poNumber,
        id: po._id,
        purchaseAmount: po.totalAmount,
        paidAmount: linked.reduce((sum, l) => sum + l.amount, 0),
        items: po.items ?? [],
        payments: linked,
      };
    }),
    ...standalone,
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  return entries.map((e) => {
    balance += e.purchaseAmount - e.paidAmount;
    return { ...e, balance };
  });
}


/* ───────────────────────── UI primitives ───────────────────────── */

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 h-11 sm2:h-9 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-1 print:hidden';
const btnSecondary = `${btnBase} border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900`;
const btnPrimary = `${btnBase} bg-emerald text-white shadow-sm hover:bg-emerald-600`;
const btnWarn = `${btnBase} bg-amber-500 text-white shadow-sm hover:bg-amber-600`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function SupplierAvatar({ name, due, active, large }: { name: string; due: boolean; active?: boolean; large?: boolean }) {
  const tone = active
    ? 'bg-emerald text-white'
    : due
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${tone} ${
        large ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs'
      }`}
    >
      {initials(name)}
    </span>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'blue'; children: React.ReactNode }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  }[tone];
  const dot = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function SettlementBadge({ entry }: { entry: LedgerEntry }) {
  if (entry.kind === 'payment') return <Badge tone="blue">On account</Badge>;
  if (entry.purchaseAmount > 0 && entry.paidAmount >= entry.purchaseAmount - 0.005) return <Badge tone="green">Paid</Badge>;
  if (entry.paidAmount > 0) return <Badge tone="amber">Partial</Badge>;
  return <Badge tone="red">Unpaid</Badge>;
}

function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-4">
              <div className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${55 + ((r + c) % 4) * 12}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ───────────────────────── Row action menu ───────────────────────── */

function ThreeDotMenu({ supplier, onEdit, onDelete, onPay, router }: {
  supplier: Supplier;
  onEdit: () => void;
  onDelete: () => void;
  onPay: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos, close]);

  function toggle() {
    if (pos) return close();
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const menuHeight = 240;
    const top = r.bottom + 6 + menuHeight > window.innerHeight ? Math.max(8, r.top - menuHeight - 6) : r.bottom + 6;
    setPos({ top, left: Math.max(8, r.right - 208) });
  }

  const item = 'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none';

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={`Actions for ${supplier.name}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button role="menuitem" className={item} onClick={() => { close(); router.push(`/procurement/suppliers/${supplier._id}`); }}>
            <Eye size={15} className="text-slate-400" aria-hidden="true" /> View details
          </button>
          <button role="menuitem" className={item} onClick={() => { close(); onEdit(); }}>
            <Pencil size={15} className="text-slate-400" aria-hidden="true" /> Edit supplier
          </button>
          <button role="menuitem" className={item} onClick={() => { close(); router.push(`/materials/purchase-orders/new?supplier=${supplier._id}`); }}>
            <ShoppingCart size={15} className="text-slate-400" aria-hidden="true" /> Create purchase
          </button>
          {supplier.balance > 0 && (
            <button role="menuitem" className={item} onClick={() => { close(); onPay(); }}>
              <CreditCard size={15} className="text-amber-500" aria-hidden="true" /> Pay due
            </button>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button role="menuitem" className={`${item} !text-red-600 hover:!bg-red-50`} onClick={() => { close(); onDelete(); }}>
            <Trash2 size={15} aria-hidden="true" /> Deactivate
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ───────────────────────── Ledger (right side) ───────────────────────── */

const PAGE_SIZE = 100;

function useRemainingPages<T>(pages: number | undefined, source: unknown, load: (page: number) => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!pages || pages < 2) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const out: T[] = [];
        for (let page = 2; page <= pages; page++) {
          out.push(...(await load(page)));
          if (cancelled) return;
        }
        setItems(out);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pages, source, load, attempt]);

  return { items, loading, failed, retry: () => setAttempt((n) => n + 1) };
}

const TH = 'border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

function SupplierLedger({ supplier, onPay, onEdit }: { supplier: Supplier; onPay: () => void; onEdit: () => void }) {
  const router = useRouter();
  const duesQ = useGetSupplierDuesQuery(supplier._id);
  const paymentsQ = useGetSupplierPaymentsQuery({ supplierId: supplier._id, limit: PAGE_SIZE, page: 1 });
  const posQ = useGetPurchaseOrdersQuery({ supplier: supplier._id, limit: PAGE_SIZE, page: 1 });
  const [fetchPosPage] = useLazyGetPurchaseOrdersQuery();
  const [fetchPaymentsPage] = useLazyGetSupplierPaymentsQuery();

  const loadPoPage = useCallback(
    async (page: number) => (await fetchPosPage({ supplier: supplier._id, limit: PAGE_SIZE, page }, false).unwrap()).data.purchaseOrders,
    [fetchPosPage, supplier._id],
  );
  const loadPaymentPage = useCallback(
    async (page: number) => (await fetchPaymentsPage({ supplierId: supplier._id, limit: PAGE_SIZE, page }, false).unwrap()).data.payments,
    [fetchPaymentsPage, supplier._id],
  );
  const morePos = useRemainingPages<PurchaseOrder>(posQ.data?.pagination?.pages, posQ.data, loadPoPage);
  const morePayments = useRemainingPages<SupplierPayment>(paymentsQ.data?.pagination?.pages, paymentsQ.data, loadPaymentPage);

  const pos = useMemo(() => [...(posQ.data?.data?.purchaseOrders ?? []), ...morePos.items], [posQ.data, morePos.items]);
  const payments = useMemo(() => [...(paymentsQ.data?.data?.payments ?? []), ...morePayments.items], [paymentsQ.data, morePayments.items]);
  const dues = duesQ.data?.data;
  const ledger = useMemo(() => buildLedger(pos, payments), [pos, payments]);
  const isLoading = duesQ.isLoading || paymentsQ.isLoading || posQ.isLoading;
  const isError = duesQ.isError || paymentsQ.isError || posQ.isError;
  const loadingOlder = morePos.loading || morePayments.loading;
  const olderFailed = morePos.failed || morePayments.failed;

  const endRef = useRef<HTMLDivElement>(null);

  function retry() {
    duesQ.refetch(); paymentsQ.refetch(); posQ.refetch();
    morePos.retry(); morePayments.retry();
  }

  function jumpToLatest() {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  const totalCost = ledger.reduce((s, e) => s + e.purchaseAmount, 0);
  const totalPaid = ledger.reduce((s, e) => s + e.paidAmount, 0);
  const closing = ledger[ledger.length - 1]?.balance ?? 0;
  const hasDue = supplier.balance > 0;

  const stats = dues
    ? [
        { label: 'Total cost', value: dues.totalOrdered, icon: Receipt, hint: 'All purchases', valueTone: 'text-slate-900', chip: 'bg-slate-100 text-slate-600' },
        { label: 'Total paid', value: dues.totalPaid, icon: Wallet, hint: 'Payments received by supplier', valueTone: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-600' },
        {
          label: 'Outstanding', value: dues.outstandingBalance, icon: Scale,
          hint: dues.outstandingBalance > 0 ? 'Payment pending' : 'All settled',
          valueTone: dues.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700',
          chip: dues.outstandingBalance > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
        },
      ]
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Supplier header */}
      <header className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-4 sm2:px-6 print:hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <SupplierAvatar name={supplier.name} due={hasDue} large />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">{supplier.name}</h2>
                {hasDue ? <Badge tone="amber">Due {formatCurrency(supplier.balance)}</Badge> : <Badge tone="green">Settled</Badge>}
              </div>
              {supplier.contactPerson && <p className="mt-0.5 text-sm font-medium text-slate-600">{supplier.contactPerson}</p>}
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
                {supplier.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400" aria-hidden="true" />{supplier.phone}</span>}
                {supplier.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" aria-hidden="true" />{supplier.email}</span>}
                {supplier.address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" aria-hidden="true" />{supplier.address}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onEdit} className={btnSecondary}><Pencil size={15} aria-hidden="true" /> Edit</button>
            <button onClick={() => router.push(`/procurement/suppliers/${supplier._id}`)} className={btnSecondary}><Eye size={15} aria-hidden="true" /> View details</button>
            <button onClick={() => window.print()} className={btnSecondary}><Printer size={15} aria-hidden="true" /> Print</button>
            <button onClick={() => router.push(`/materials/purchase-orders/new?supplier=${supplier._id}`)} className={btnPrimary}><ShoppingCart size={15} aria-hidden="true" /> Repurchase</button>
            {hasDue && <button onClick={onPay} className={btnWarn}><CreditCard size={15} aria-hidden="true" /> Pay due</button>}
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {duesQ.isLoading
            ? [0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-xl border border-slate-200 bg-white" />)
            : stats.map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.chip}`}>
                    <s.icon size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                    <p className={`truncate text-lg font-bold tabular-nums ${s.valueTone}`}>{formatCurrency(s.value)}</p>
                    <p className="truncate text-xs text-slate-500">{s.hint}</p>
                  </div>
                </div>
              ))}
        </div>
      </header>

      {/* Ledger toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm2:px-6 print:hidden">
        <h3 className="text-sm font-semibold text-slate-900">
          Transactions
          {!isLoading && !isError && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{ledger.length}</span>}
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {loadingOlder && (
            <span className="inline-flex items-center gap-2" role="status">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-emerald" aria-hidden="true" />
              Loading older transactions…
            </span>
          )}
          {olderFailed && !loadingOlder && (
            <button onClick={retry} className="font-semibold text-red-600 hover:underline">Some transactions failed to load · Retry</button>
          )}
          {!loadingOlder && !olderFailed && <span className="hidden sm:inline">Oldest to latest · latest at the bottom</span>}
          {ledger.length > 8 && (
            <button onClick={jumpToLatest} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Jump to latest ↓
            </button>
          )}
        </div>
      </div>

      {/* Ledger table — screen only */}
      <div className="overflow-x-auto bg-white print:hidden">
        {isError ? (
          <div className="py-12"><ErrorState onRetry={retry} /></div>
        ) : (
          <>
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-[1%] whitespace-nowrap pl-6 text-left`}>SL</th>
                <th className={`${TH} w-[1%] whitespace-nowrap text-left`}>Date</th>
                <th className={`${TH} w-[1%] whitespace-nowrap text-left`}>Reference</th>
                <th className={`${TH} text-left`}>Products</th>
                <th className={`${TH} w-[1%] whitespace-nowrap text-right`}>Quantity</th>
                <th className={`${TH} w-[1%] whitespace-nowrap text-right`}>Total cost</th>
                <th className={`${TH} min-w-[150px] text-left`}>Payment receipts</th>
                <th className={`${TH} w-[1%] whitespace-nowrap text-right`}>Payment</th>
                <th className={`${TH} w-[1%] whitespace-nowrap pr-6 text-right`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={9} />
              ) : ledger.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14">
                    <EmptyState title="No transactions yet" description="Purchases and payments for this supplier will appear here." />
                  </td>
                </tr>
              ) : (
                ledger.map((entry, i) => (
                  <tr key={`${entry.kind}-${entry.id}-${i}`} className="group transition-colors hover:bg-slate-50/80">
                    <td className="border-b border-slate-100 py-3.5 pl-6 pr-4 align-top text-xs font-medium tabular-nums text-slate-400">{i + 1}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3.5 align-top">
                      <span className="block text-sm font-semibold text-slate-800">{formatDate(entry.date, 'dd MMM yyyy')}</span>
                      <span className="block text-xs text-slate-400">{formatDate(entry.date, 'hh:mm a')}</span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3.5 align-top">
                      <button
                        onClick={() => router.push(entry.kind === 'purchase' ? `/procurement/orders/${entry.id}` : `/procurement/payments/${entry.id}`)}
                        className={`text-sm font-semibold underline-offset-2 hover:underline ${entry.kind === 'purchase' ? 'text-slate-900 hover:text-emerald-700' : 'text-emerald-700'}`}
                      >
                        {entry.ref}
                      </button>
                      <div className="mt-1.5"><SettlementBadge entry={entry} /></div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      {entry.kind === 'purchase' && entry.items.length > 0 ? (
                        entry.items.map((line, li) => (
                          <p key={li} className="flex items-baseline gap-2 text-sm leading-6">
                            <span className="font-medium text-slate-800">{poItemName(line)}</span>
                            <span className="text-xs font-semibold tabular-nums text-violet-600">{formatCurrency(line.unitPrice)}</span>
                          </p>
                        ))
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3.5 text-right align-top">
                      {entry.kind === 'purchase' && entry.items.length > 0 ? (
                        entry.items.map((line, li) => (
                          <p key={li} className="text-sm font-medium leading-6 tabular-nums text-blue-600">
                            {line.orderedQty} <span className="text-xs font-normal text-blue-400">{poItemUom(line)}</span>
                          </p>
                        ))
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3.5 text-right align-top text-sm font-semibold tabular-nums text-slate-900">
                      {entry.kind === 'purchase' ? formatCurrency(entry.purchaseAmount) : <span className="font-normal text-slate-300">—</span>}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      {entry.kind === 'purchase' && entry.payments.length > 0 ? (
                        entry.payments.map((pay, pi) => (
                          <p key={`${pay.id}-${pi}`} className="flex flex-wrap items-baseline gap-x-2 text-sm leading-6">
                            <button
                              onClick={() => router.push(`/procurement/payments/${pay.id}`)}
                              className="break-all text-left font-medium text-emerald-700 underline-offset-2 hover:underline"
                            >
                              {pay.ref}
                            </button>
                            <span className="text-xs font-semibold tabular-nums text-slate-600">{formatCurrency(pay.amount)}</span>
                          </p>
                        ))
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3.5 text-right align-top text-sm font-bold tabular-nums text-emerald-700">
                      {entry.paidAmount > 0 ? formatCurrency(entry.paidAmount) : <span className="font-normal text-slate-300">—</span>}
                    </td>
                    <td className={`whitespace-nowrap border-b border-slate-100 py-3.5 pl-4 pr-6 text-right align-top text-sm font-bold tabular-nums ${entry.balance > 0.005 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatCurrency(entry.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && ledger.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="bg-slate-900 py-3.5 pl-6 pr-4 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    Totals · {ledger.length} {ledger.length === 1 ? 'entry' : 'entries'}
                  </td>
                  <td className="whitespace-nowrap bg-slate-900 px-4 py-3.5 text-right text-sm font-bold tabular-nums text-white">{formatCurrency(totalCost)}</td>
                  <td className="bg-slate-900" />
                  <td className="whitespace-nowrap bg-slate-900 px-4 py-3.5 text-right text-sm font-bold tabular-nums text-emerald-300">{formatCurrency(totalPaid)}</td>
                  <td className={`whitespace-nowrap bg-slate-900 py-3.5 pl-4 pr-6 text-right text-sm font-bold tabular-nums ${closing > 0.005 ? 'text-amber-300' : 'text-emerald-300'}`}>{formatCurrency(closing)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </>
        )}
      </div>
      <div ref={endRef} className="print:hidden" />

      {/* Print-only document */}
      <div className="hidden print:block text-[12px] text-gray-900 p-8">
        <div className="flex items-start justify-between pb-4 border-b-2 border-gray-800 mb-4">
          <div>
            <p className="text-[18px] font-bold text-gray-900">Health Care Cosmetics</p>
            <p className="text-[11px] text-gray-500 mt-0.5">HCC ERP — Supplier Ledger</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-gray-900">{supplier.name}</p>
            {supplier.contactPerson && <p className="text-[11px] text-gray-500">{supplier.contactPerson}</p>}
            {supplier.phone && <p className="text-[11px] text-gray-500">{supplier.phone}</p>}
            <p className="text-[11px] text-gray-400 mt-1">Printed: {new Date().toLocaleString('en-BD')}</p>
          </div>
        </div>
        {dues && (
          <div className="grid grid-cols-3 gap-4 mb-5 pb-4 border-b border-gray-200">
            {[
              { label: 'Total Purchased', value: formatCurrency(dues.totalOrdered) },
              { label: 'Total Paid', value: formatCurrency(dues.totalPaid) },
              { label: 'Outstanding Balance', value: formatCurrency(dues.outstandingBalance) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                <p className="font-bold text-gray-900 mt-0.5 text-[13px]">{value}</p>
              </div>
            ))}
          </div>
        )}
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-gray-800">
              {['Date', 'Reference', 'Type', 'Total Cost (৳)', 'Payment (৳)', 'Balance'].map((h, i) => (
                <th key={h} className={`py-1.5 pr-3 font-semibold text-gray-700 uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-500">{formatDate(entry.date, 'dd MMM yyyy, hh:mm a')}</td>
                <td className="py-1.5 pr-3 font-medium">
                  {entry.ref}
                  {entry.kind === 'purchase' && entry.payments.length > 0 && (
                    <span className="block text-[10px] font-normal text-gray-500">
                      {entry.payments.map((pay) => `${pay.ref} (${formatCurrency(pay.amount)})`).join(', ')}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{entry.kind === 'purchase' ? 'Purchase' : 'Payment'}</td>
                <td className="py-1.5 pr-3 text-right">{entry.kind === 'purchase' ? formatCurrency(entry.purchaseAmount) : '—'}</td>
                <td className="py-1.5 pr-3 text-right">{entry.paidAmount > 0 ? formatCurrency(entry.paidAmount) : '—'}</td>
                <td className="py-1.5 text-right font-semibold">{formatCurrency(entry.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td colSpan={3} className="py-2 font-bold text-gray-900 uppercase">Outstanding Balance</td>
              <td className="py-2 text-right font-bold">{formatCurrency(ledger.reduce((s, e) => s + e.purchaseAmount, 0))}</td>
              <td className="py-2 text-right font-bold">{formatCurrency(ledger.reduce((s, e) => s + e.paidAmount, 0))}</td>
              <td className="py-2 text-right font-bold">{formatCurrency(ledger[ledger.length - 1]?.balance ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">Printed on {new Date().toLocaleDateString('en-BD')} — HCC ERP</p>
      </div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function SuppliersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);

  const { data, isLoading, isError, refetch } = useGetSuppliersQuery({ limit: 200 });
  const [deleteSupplier, { isLoading: deleting }] = useDeleteSupplierMutation();

  const suppliers = useMemo(() => data?.data?.suppliers ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (dueOnly && s.balance <= 0) return false;
      if (!q) return true;
      return [s.name, s.contactPerson, s.phone].some((v) => v?.toLowerCase().includes(q));
    });
  }, [suppliers, search, dueOnly]);
  const dueCount = useMemo(() => suppliers.filter((s) => s.balance > 0).length, [suppliers]);
  const selected = suppliers.find((s) => s._id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && suppliers.length > 0) setSelectedId(suppliers[0]._id);
  }, [suppliers, selectedId]);

  function openCreate() { setEditSupplier(null); setDialogOpen(true); }
  function openEdit(s: Supplier) { setEditSupplier(s); setDialogOpen(true); }
  function selectSupplier(id: string) { setSelectedId(id); setShowLedger(true); }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteSupplier(deleteId).unwrap();
      toast.success('Supplier deactivated');
      if (selectedId === deleteId) { setSelectedId(null); setShowLedger(false); }
    } catch {
      toast.error('Failed to deactivate supplier');
    } finally {
      setDeleteId(null);
    }
  }

  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="flex flex-col">
      <div className="shrink-0">
        <PageHeader
          className="!mb-4"
          title="Suppliers"
          description="Supplier ledger, purchases and payment history"
          breadcrumbs={[{ label: 'Procurement' }, { label: 'Suppliers' }]}
          actions={
            <button onClick={openCreate} className={btnPrimary}>
              <Plus size={16} aria-hidden="true" /> New supplier
            </button>
          }
        />
      </div>

      <div>
        <div className="flex rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Left — supplier list */}
          <aside
            className={`flex-col border-r border-slate-200 bg-white transition-[width] duration-200 print:hidden sm2:shrink-0 ${
              showLedger ? 'hidden sm2:flex' : 'flex'
            } w-full ${collapsed ? 'sm2:w-[76px]' : 'sm2:w-80'}`}
          >
            <div className="flex min-h-0 flex-1 flex-col sm2:sticky sm2:top-20 sm2:max-h-[calc(100vh-6rem)]">
            {collapsed ? (
              <div className="flex min-h-0 flex-1 flex-col items-center gap-2 py-3">
                <button
                  onClick={() => setCollapsed(false)}
                  aria-label="Expand supplier list"
                  aria-expanded={false}
                  title="Expand supplier list"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
                >
                  <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <div className="h-px w-8 bg-slate-200" />
                <ul className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
                  {filtered.map((s) => {
                    const active = selectedId === s._id;
                    return (
                      <li key={s._id} className="relative">
                        <button
                          onClick={() => selectSupplier(s._id)}
                          title={`${s.name}${s.balance > 0 ? ` · Due ${formatCurrency(s.balance)}` : ''}`}
                          aria-label={s.name}
                          aria-current={active ? 'true' : undefined}
                          className={`rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 ${active ? 'ring-2 ring-emerald ring-offset-2' : ''}`}
                        >
                          <SupplierAvatar name={s.name} due={s.balance > 0} active={active} />
                        </button>
                        {s.balance > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <>
                <div className="shrink-0 space-y-3 border-b border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      All suppliers
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{suppliers.length}</span>
                    </h2>
                    <button
                      onClick={() => setCollapsed(true)}
                      aria-label="Collapse supplier list"
                      aria-expanded
                      title="Collapse supplier list"
                      className="hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald sm2:inline-flex"
                    >
                      <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search suppliers…"
                      aria-label="Search suppliers"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/25 sm2:h-9"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Filter suppliers">
                    <button role="tab" aria-selected={!dueOnly} onClick={() => setDueOnly(false)} className={tab(!dueOnly)}>All</button>
                    <button role="tab" aria-selected={dueOnly} onClick={() => setDueOnly(true)} className={tab(dueOnly)}>
                      With due{dueCount > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-700">{dueCount}</span>}
                    </button>
                  </div>
                </div>

                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {isLoading &&
                    [0, 1, 2, 3, 4, 5].map((i) => (
                      <li key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                        <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                          <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
                        </div>
                      </li>
                    ))}
                  {isError && <li className="py-8"><ErrorState onRetry={refetch} /></li>}
                  {!isLoading && !isError && suppliers.length === 0 && (
                    <li className="px-4 py-8"><EmptyState title="No suppliers yet" description="Add your first supplier to start tracking purchases." /></li>
                  )}
                  {!isLoading && !isError && suppliers.length > 0 && filtered.length === 0 && (
                    <li className="px-4 py-10 text-center text-sm text-slate-500">No suppliers match your search.</li>
                  )}
                  {filtered.map((s) => {
                    const active = selectedId === s._id;
                    const due = s.balance > 0;
                    return (
                      <li key={s._id} className="relative border-b border-slate-100">
                        <button
                          onClick={() => selectSupplier(s._id)}
                          aria-current={active ? 'true' : undefined}
                          className={`flex min-h-[64px] w-full items-center gap-3 border-l-[3px] py-3 pl-4 pr-14 text-left transition-colors focus:outline-none focus-visible:bg-slate-50 ${
                            active ? 'border-l-emerald bg-emerald-50/70' : 'border-l-transparent hover:bg-slate-50'
                          }`}
                        >
                          <SupplierAvatar name={s.name} due={due} active={active} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-semibold ${active ? 'text-emerald-900' : 'text-slate-900'}`}>{s.name}</span>
                            <span className={`block truncate text-xs ${due ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                              {due ? `Due ${formatCurrency(s.balance)}` : 'Settled'}
                            </span>
                          </span>
                        </button>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <ThreeDotMenu
                            supplier={s}
                            onEdit={() => openEdit(s)}
                            onDelete={() => setDeleteId(s._id)}
                            onPay={() => setPaySupplier(s)}
                            router={router}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            </div>
          </aside>

          {/* Right — ledger */}
          <section className={`min-w-0 flex-1 flex-col overflow-hidden rounded-r-xl ${showLedger ? 'flex' : 'hidden sm2:flex'}`}>
            {showLedger && (
              <button
                onClick={() => setShowLedger(false)}
                className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm2:hidden print:hidden"
              >
                <ArrowLeft size={16} aria-hidden="true" /> All suppliers
              </button>
            )}
            {selected ? (
              <SupplierLedger key={selected._id} supplier={selected} onPay={() => setPaySupplier(selected)} onEdit={() => openEdit(selected)} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Building2 size={26} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Select a supplier</p>
                  <p className="mt-0.5 text-sm text-slate-500">Choose a supplier on the left to view their ledger.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <SupplierFormDialog open={dialogOpen} supplier={editSupplier} onClose={() => setDialogOpen(false)} />
      {paySupplier && (
        <SupplierFIFOPaymentDialog
          open={!!paySupplier}
          supplierId={paySupplier._id}
          supplierName={paySupplier.name}
          outstandingBalance={paySupplier.balance}
          onClose={() => setPaySupplier(null)}
          onSuccess={() => refetch()}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Deactivate supplier"
        description="This will deactivate the supplier. Existing records will not be affected."
        confirmLabel="Deactivate"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
