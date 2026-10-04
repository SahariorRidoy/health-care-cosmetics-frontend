'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Pencil, Trash2, Eye, CreditCard, ShoppingCart,
  MoreVertical, Building2, Phone, Mail, MapPin, TrendingDown, TrendingUp, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetSuppliersQuery, useDeleteSupplierMutation,
  useGetSupplierDuesQuery, useGetSupplierPaymentsQuery,
} from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { Supplier, GoodsReceipt, SupplierPayment } from '@/features/procurement/types';

type LedgerEntry =
  | { kind: 'purchase'; date: string; ref: string; id: string; amount: number }
  | { kind: 'payment'; date: string; ref: string; id: string; amount: number };

function buildLedger(receipts: GoodsReceipt[], payments: SupplierPayment[]): (LedgerEntry & { balance: number })[] {
  const entries: LedgerEntry[] = [
    ...receipts.map((r) => ({
      kind: 'purchase' as const,
      date: r.receivedDate,
      ref: r.grNumber,
      id: r._id,
      amount: r.totalAmount,
    })),
    ...payments.map((p) => ({
      kind: 'payment' as const,
      date: p.paymentDate,
      ref: p.paymentNumber,
      id: p._id,
      amount: p.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  const withBalance = entries.map((e) => {
    balance = e.kind === 'purchase' ? balance + e.amount : balance - e.amount;
    return { ...e, balance };
  });
  return withBalance;
}

function ThreeDotMenu({ supplier, onEdit, onDelete, onPay, router }: {
  supplier: Supplier;
  onEdit: () => void;
  onDelete: () => void;
  onPay: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="More actions"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 bg-white rounded-lg border border-border shadow-lg py-1">
          <button onClick={() => { router.push(`/procurement/suppliers/${supplier._id}`); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
            <Eye size={14} className="text-blue-500" /> View Details
          </button>
          <button onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
            <Pencil size={14} className="text-emerald-500" /> Edit
          </button>
          <button onClick={() => { router.push(`/materials/purchase-orders/new?supplier=${supplier._id}`); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
            <ShoppingCart size={14} className="text-violet-500" /> Create Purchase
          </button>
          {supplier.balance > 0 && (
            <button onClick={() => { onPay(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-slate-50">
              <CreditCard size={14} className="text-amber-500" /> Pay Due
            </button>
          )}
          <div className="border-t border-border my-1" />
          <button onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function SupplierLedger({ supplier, onPay }: { supplier: Supplier; onPay: () => void }) {
  const router = useRouter();
  const { data: duesData, isLoading: duesLoading } = useGetSupplierDuesQuery(supplier._id);
  const { data: paymentsData, isLoading: paymentsLoading } = useGetSupplierPaymentsQuery({ supplierId: supplier._id });

  const receipts = (duesData?.data?.receipts ?? []) as GoodsReceipt[];
  const payments = paymentsData?.data?.payments ?? [];
  const dues = duesData?.data;
  const ledger = buildLedger(receipts, payments);
  const isLoading = duesLoading || paymentsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Supplier header */}
      <div className="px-5 py-4 border-b border-border shrink-0 print:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">{supplier.name}</h2>
            {supplier.contactPerson && <p className="text-xs text-muted mt-0.5">{supplier.contactPerson}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {supplier.balance > 0 && (
              <button
                onClick={onPay}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <CreditCard size={12} /> Pay Due
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-slate-50 transition-colors whitespace-nowrap print:hidden"
            >
              <Printer size={12} /> Print
            </button>
            <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${supplier.balance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {supplier.balance > 0 ? `Due: ${formatCurrency(supplier.balance)}` : 'Cleared'}
            </span>
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {supplier.phone && <span className="flex items-center gap-1 text-xs text-muted"><Phone size={11} />{supplier.phone}</span>}
          {supplier.email && <span className="flex items-center gap-1 text-xs text-muted"><Mail size={11} />{supplier.email}</span>}
          {supplier.address && <span className="flex items-center gap-1 text-xs text-muted"><MapPin size={11} />{supplier.address}</span>}
        </div>

        {/* Summary stats */}
        {dues && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Total Purchased', value: formatCurrency(dues.totalOrdered), color: 'text-foreground' },
              { label: 'Total Paid', value: formatCurrency(dues.totalPaid), color: 'text-emerald-600' },
              { label: 'Outstanding', value: formatCurrency(dues.outstandingBalance), color: dues.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg px-3 py-2 border border-border">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">{s.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger table — screen only */}
      <div className="flex-1 overflow-y-auto flex flex-col print:hidden">
        <table className="w-full text-sm flex-1">
          <thead className="sticky top-0 bg-slate-50 border-b border-border z-10">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Reference</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Type</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-red-500 uppercase tracking-wide">Purchase (৳)</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-emerald-600 uppercase tracking-wide">Payment (৳)</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10 text-sm text-muted">Loading…</td></tr>
            ) : ledger.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-sm text-muted">No transactions yet.</td></tr>
            ) : (
              ledger.map((entry, i) => (
                <tr key={i} className="border-b border-border/60 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDate(entry.date, 'dd MMM yyyy, hh:mm a')}</td>
                  <td className="px-4 py-2.5">
                    {entry.kind === 'purchase' ? (
                      <button onClick={() => router.push(`/procurement/receipts/${entry.id}`)}
                        className="text-xs font-medium text-emerald hover:underline">
                        {entry.ref}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-foreground">{entry.ref}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      entry.kind === 'purchase'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {entry.kind === 'purchase'
                        ? <><TrendingDown size={10} /> Purchase</>
                        : <><TrendingUp size={10} /> Payment</>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-red-600">
                    {entry.kind === 'purchase' ? formatCurrency(entry.amount) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-emerald-600">
                    {entry.kind === 'payment' ? formatCurrency(entry.amount) : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right text-xs font-semibold ${entry.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {formatCurrency(entry.balance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!isLoading && ledger.length > 0 && (
            <tfoot className="sticky bottom-0 bg-white border-t-2 border-border">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs font-bold text-foreground uppercase tracking-wide">Outstanding Balance</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-red-600">{formatCurrency(ledger.reduce((s, e) => e.kind === 'purchase' ? s + e.amount : s, 0))}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">{formatCurrency(ledger.reduce((s, e) => e.kind === 'payment' ? s + e.amount : s, 0))}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-bold ${(ledger[ledger.length - 1]?.balance ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {formatCurrency(ledger[ledger.length - 1]?.balance ?? 0)}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
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
              {['Date', 'Reference', 'Type', 'Purchase (৳)', 'Payment (৳)', 'Balance'].map((h, i) => (
                <th key={h} className={`py-1.5 pr-3 font-semibold text-gray-700 uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-500">{formatDate(entry.date, 'dd MMM yyyy, hh:mm a')}</td>
                <td className="py-1.5 pr-3 font-medium">{entry.ref}</td>
                <td className="py-1.5 pr-3">{entry.kind === 'purchase' ? 'Purchase' : 'Payment'}</td>
                <td className="py-1.5 pr-3 text-right">{entry.kind === 'purchase' ? formatCurrency(entry.amount) : '—'}</td>
                <td className="py-1.5 pr-3 text-right">{entry.kind === 'payment' ? formatCurrency(entry.amount) : '—'}</td>
                <td className="py-1.5 text-right font-semibold">{formatCurrency(entry.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td colSpan={3} className="py-2 font-bold text-gray-900 uppercase">Outstanding Balance</td>
              <td className="py-2 text-right font-bold">{formatCurrency(ledger.reduce((s, e) => e.kind === 'purchase' ? s + e.amount : s, 0))}</td>
              <td className="py-2 text-right font-bold">{formatCurrency(ledger.reduce((s, e) => e.kind === 'payment' ? s + e.amount : s, 0))}</td>
              <td className="py-2 text-right font-bold">{formatCurrency(ledger[ledger.length - 1]?.balance ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">Printed on {new Date().toLocaleDateString('en-BD')} — HCC ERP</p>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);

  const { data, isLoading, isError, refetch } = useGetSuppliersQuery({ limit: 200, search: search || undefined });
  const [deleteSupplier, { isLoading: deleting }] = useDeleteSupplierMutation();

  const suppliers = useMemo(() => data?.data?.suppliers ?? [], [data]);
  const selected = suppliers.find((s) => s._id === selectedId) ?? null;

  // Auto-select first supplier
  useEffect(() => {
    if (!selectedId && suppliers.length > 0) setSelectedId(suppliers[0]._id);
  }, [suppliers, selectedId]);

  function openCreate() { setEditSupplier(null); setDialogOpen(true); }
  function openEdit(s: Supplier) { setEditSupplier(s); setDialogOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteSupplier(deleteId).unwrap();
      toast.success('Supplier deactivated');
      if (selectedId === deleteId) setSelectedId(null);
    } catch {
      toast.error('Failed to delete supplier');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="shrink-0">
        <PageHeader
          title="Suppliers"
          // description="Manage supplier profiles and balances"
          breadcrumbs={[{ label: 'Procurement' }, { label: 'Suppliers' }]}
          actions={
            <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} /> New Supplier
            </button>
          }
        />
      </div>
      <div className="flex-1 min-h-0">
      <div className="flex h-full rounded-xl border border-border bg-white shadow-sm overflow-hidden">

        {/* Left — supplier list */}
        <div className="w-64 shrink-0 flex flex-col border-r border-border print:hidden">
          {/* Search */}
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search suppliers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-slate-50 pl-8 pr-3 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
          </div>

          {/* List */}
          <ul className="flex-1 overflow-y-auto">
            {isLoading && (
              <li className="px-4 py-3 text-xs text-muted">Loading…</li>
            )}
            {isError && (
              <li className="px-4 py-3">
                <button onClick={refetch} className="text-xs text-red-500 hover:underline">Retry</button>
              </li>
            )}
            {!isLoading && suppliers.length === 0 && (
              <li className="px-4 py-6">
                <EmptyState title="No suppliers" description="Add your first supplier." />
              </li>
            )}
            {suppliers.map((s) => (
              <li
                key={s._id}
                onClick={() => setSelectedId(s._id)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors ${
                  selectedId === s._id ? 'bg-emerald-50 border-l-2 border-l-emerald' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Building2 size={13} className="text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${selectedId === s._id ? 'text-emerald-800' : 'text-foreground'}`}>{s.name}</p>
                    <p className={`text-[10px] font-medium ${s.balance > 0 ? 'text-amber-600' : 'text-muted'}`}>
                      {s.balance > 0 ? formatCurrency(s.balance) : 'No due'}
                    </p>
                  </div>
                </div>
                <ThreeDotMenu
                  supplier={s}
                  onEdit={() => openEdit(s)}
                  onDelete={() => setDeleteId(s._id)}
                  onPay={() => setPaySupplier(s)}
                  router={router}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Right — ledger */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <SupplierLedger key={selected._id} supplier={selected} onPay={() => setPaySupplier(selected)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
              <Building2 size={32} className="text-slate-300" />
              <p className="text-sm">Select a supplier to view ledger</p>
            </div>
          )}
        </div>
      </div>
      </div>

      <SupplierFormDialog open={dialogOpen} supplier={editSupplier} onClose={() => setDialogOpen(false)} />
      {paySupplier && (
        <SupplierPaymentDialog
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
        title="Deactivate Supplier"
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
