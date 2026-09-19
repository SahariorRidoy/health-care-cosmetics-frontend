'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetExpenseCategoriesQuery,
  useDeleteExpenseCategoryMutation,
} from '@/features/finance/services/financeApi';
import { ExpenseCategoryDialog } from '@/features/finance/components/ExpenseCategoryDialog';
import type { ExpenseCategory } from '@/features/finance/types';

export default function ExpenseCategoriesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);

  const { data, isLoading, isError, refetch } = useGetExpenseCategoriesQuery();
  const [deleteCategory, { isLoading: deleting }] = useDeleteExpenseCategoryMutation();

  const columns: Column<ExpenseCategory>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'description', header: 'Description', priority: 'P2',
      render: (row) => row.description ?? <span className="text-muted">—</span>,
    },
    {
      key: 'isActive', header: 'Status', priority: 'P2',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'createdAt', header: 'Created', priority: 'P3',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setEditTarget(row)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit category"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Delete category"
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
        title="Expense Categories"
        description="Manage categories for classifying expenses"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Categories' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Category
          </button>
        }
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.categories?.length === 0 && !isLoading ? (
        <EmptyState
          title="No categories yet"
          description="Create your first expense category."
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New Category
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.categories ?? []}
          keyField="_id"
          isLoading={isLoading}
        />
      )}

      <ExpenseCategoryDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ExpenseCategoryDialog open={!!editTarget} onClose={() => setEditTarget(null)} category={editTarget} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        description={`Delete category "${deleteTarget?.name}"? This will deactivate it.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteCategory(deleteTarget._id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
