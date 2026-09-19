'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { useGetDepartmentsQuery, useDeleteDepartmentMutation } from '@/features/hr/services/hrApi';
import { DepartmentDialog } from '@/features/hr/components/DepartmentDialog';
import type { Department } from '@/features/hr/types';

export default function DepartmentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const { data, isLoading, isError, refetch } = useGetDepartmentsQuery();
  const [deleteDepartment, { isLoading: deleting }] = useDeleteDepartmentMutation();

  const columns: Column<Department>[] = [
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
            aria-label="Edit department" title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Delete department" title="Delete"
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
        title="Departments"
        description="Manage company departments"
        breadcrumbs={[{ label: 'HR' }, { label: 'Departments' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Department
          </button>
        }
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.departments?.length === 0 && !isLoading ? (
        <EmptyState
          title="No departments yet"
          description="Create your first department."
          action={
            <button onClick={() => setCreateOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Department
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.departments ?? []}
          keyField="_id"
          isLoading={isLoading}
        />
      )}

      <DepartmentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <DepartmentDialog open={!!editTarget} onClose={() => setEditTarget(null)} department={editTarget} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Department"
        description={`Delete "${deleteTarget?.name}"? This will deactivate it.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          if (deleteTarget) { await deleteDepartment(deleteTarget._id); setDeleteTarget(null); }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
