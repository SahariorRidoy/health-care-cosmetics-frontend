'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Eye, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import { useGetCustomersQuery } from '@/features/sales/services/salesApi';
import { CustomerFormDialog } from '@/features/sales/components/CustomerFormDialog';
import type { Customer } from '@/features/sales/types';

export default function CustomersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  const { data, isLoading, isError, refetch } = useGetCustomersQuery({
    page,
    search: search || undefined,
  });

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'phone', header: 'Phone', priority: 'P3', render: (row) => row.phone ?? '—' },
    {
      key: 'balance', header: 'Outstanding', priority: 'P2',
      render: (row) => (
        <span className={row.balance > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
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
          <button
            onClick={() => setEditCustomer(row)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit customer"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => router.push(`/sales/customers/${row._id}`)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View customer"
            title="View"
          >
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage customer accounts and credit"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Customers' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Customer
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.customers?.length === 0 && !isLoading ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to get started."
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New Customer
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.customers ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <CustomerFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CustomerFormDialog open={!!editCustomer} customer={editCustomer} onClose={() => setEditCustomer(null)} />
    </>
  );
}
