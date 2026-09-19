'use client';

import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetExpensesQuery,
  useGetExpenseCategoriesQuery,
  useDeleteExpenseMutation,
  useUpdateExpenseStatusMutation,
} from '@/features/finance/services/financeApi';
import { ExpenseFormDialog } from '@/features/finance/components/ExpenseFormDialog';
import type { Expense } from '@/features/finance/types';

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<Expense | null>(null);

  const { data, isLoading, isError, refetch } = useGetExpensesQuery({
    page,
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: catData } = useGetExpenseCategoriesQuery();
  const [deleteExpense, { isLoading: deleting }] = useDeleteExpenseMutation();
  const [updateStatus, { isLoading: markingPaid }] = useUpdateExpenseStatusMutation();

  const categories = catData?.data?.categories ?? [];

  const columns: Column<Expense>[] = [
    {
      key: 'expenseNumber', header: 'Ref #', priority: 'P2',
      render: (row) => <span className="font-mono text-[13px]">{row.expenseNumber}</span>,
    },
    {
      key: 'description', header: 'Description', priority: 'P1',
      render: (row) => <span className="font-medium">{row.description}</span>,
    },
    {
      key: 'category', header: 'Category', priority: 'P2',
      render: (row) => (typeof row.category === 'object' ? row.category.name : '—'),
    },
    {
      key: 'amount', header: 'Amount', priority: 'P1',
      render: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'expenseDate', header: 'Date', priority: 'P2',
      render: (row) => formatDate(row.expenseDate),
    },
    {
      key: 'paidBy', header: 'Paid By', priority: 'P3',
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status === 'PENDING' && (
            <button
              onClick={() => setMarkPaidTarget(row)}
              className="p-1.5 rounded-md text-emerald hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Mark as paid"
              title="Mark Paid"
            >
              <CheckCircle size={15} />
            </button>
          )}
          <button
            onClick={() => setEditTarget(row)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit expense"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Delete expense"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track and manage business expenses"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Expenses' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Expense
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.expenses?.length === 0 && !isLoading ? (
        <EmptyState
          title="No expenses yet"
          description="Record your first expense to get started."
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New Expense
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.expenses ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <ExpenseFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ExpenseFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} expense={editTarget} />

      <ConfirmDialog
        open={!!markPaidTarget}
        title="Mark as Paid"
        description={`Mark "${markPaidTarget?.description}" as paid?`}
        confirmLabel="Mark Paid"
        loading={markingPaid}
        onConfirm={async () => {
          if (markPaidTarget) {
            await updateStatus({ id: markPaidTarget._id, status: 'PAID' });
            setMarkPaidTarget(null);
          }
        }}
        onCancel={() => setMarkPaidTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        description={`Delete "${deleteTarget?.description}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteExpense(deleteTarget._id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
