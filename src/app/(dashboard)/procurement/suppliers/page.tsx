'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Eye, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import { useGetSuppliersQuery, useDeleteSupplierMutation } from '@/features/procurement/services/procurementApi';
import { SupplierFormDialog } from '@/features/procurement/components/SupplierFormDialog';
import { SupplierPaymentDialog } from '@/features/procurement/components/SupplierPaymentDialog';
import type { Supplier } from '@/features/procurement/types';

export default function SuppliersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);

  const { data, isLoading, isError, refetch } = useGetSuppliersQuery({ page, search: search || undefined });
  const [deleteSupplier, { isLoading: deleting }] = useDeleteSupplierMutation();

  function openCreate() { setEditSupplier(null); setDialogOpen(true); }
  function openEdit(s: Supplier) { setEditSupplier(s); setDialogOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteSupplier(deleteId).unwrap();
      toast.success('Supplier deactivated');
    } catch {
      toast.error('Failed to delete supplier');
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => <span className="font-bold text-foreground">{row.name}</span>,
    },
    { key: 'contactPerson', header: 'Contact', priority: 'P2', render: (row) => row.contactPerson ?? '—' },
    { key: 'phone', header: 'Phone', priority: 'P3', render: (row) => row.phone ?? '—' },
    {
      key: 'balance', header: 'Balance', priority: 'P2',
      render: (row) => (
        <span className={row.balance > 0 ? 'text-amber-600 font-medium' : ''}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      key: 'isActive', header: 'Status', priority: 'P2',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
              {row.balance > 0 && (
              <button onClick={() => setPaySupplier(row)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Pay Due" title="Pay Due"><CreditCard size={15} /></button>
              )}
          <button onClick={() => router.push(`/procurement/suppliers/${row._id}`)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="View" title="View"><Eye size={15} /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Edit" title="Edit"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(row._id)} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Delete" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Manage supplier profiles and balances"
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Suppliers' }]}
        actions={
          <button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} aria-hidden="true" /> New Supplier
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search suppliers…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.suppliers?.length === 0 && !isLoading ? (
        <EmptyState title="No suppliers found" description="Add your first supplier to get started."
          action={<button onClick={openCreate} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"><Plus size={16} aria-hidden="true" />New Supplier</button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.suppliers ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
          tableHeadAction={
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span>Total Outstanding:</span>
              <span className="font-semibold text-amber-600">
                {formatCurrency((data?.data?.suppliers ?? []).reduce((sum, s) => sum + (s.balance ?? 0), 0))}
              </span>
            </div>
          }
        />
      )}

      <SupplierFormDialog open={dialogOpen} supplier={editSupplier} onClose={() => setDialogOpen(false)} />
      {paySupplier && paySupplier._id && (
        <SupplierPaymentDialog
          open={!!paySupplier}
          supplierId={paySupplier._id}
          supplierName={paySupplier.name}
          outstandingBalance={paySupplier.balance}
          onClose={() => setPaySupplier(null)}
        />
      )}
      <ConfirmDialog open={!!deleteId} title="Deactivate Supplier" description="This will deactivate the supplier. Existing records will not be affected." confirmLabel="Deactivate" variant="danger" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </>
  );
}
