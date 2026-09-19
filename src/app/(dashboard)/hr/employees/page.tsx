'use client';

import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetEmployeesQuery,
  useGetDepartmentsQuery,
  useDeleteEmployeeMutation,
} from '@/features/hr/services/hrApi';
import { EmployeeFormDialog } from '@/features/hr/components/EmployeeFormDialog';
import type { Employee } from '@/features/hr/types';

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const { data, isLoading, isError, refetch } = useGetEmployeesQuery({
    page,
    search: search || undefined,
    department: deptFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: deptData } = useGetDepartmentsQuery();
  const [deleteEmployee, { isLoading: deleting }] = useDeleteEmployeeMutation();

  const departments = deptData?.data?.departments ?? [];

  const columns: Column<Employee>[] = [
    {
      key: 'employeeId', header: 'ID', priority: 'P2',
      render: (row) => <span className="font-mono text-[13px]">{row.employeeId}</span>,
    },
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'department', header: 'Department', priority: 'P2',
      render: (row) => (typeof row.department === 'object' ? row.department.name : '—'),
    },
    { key: 'designation', header: 'Designation', priority: 'P2' },
    {
      key: 'currentSalary', header: 'Salary', priority: 'P3',
      render: (row) => formatCurrency(row.currentSalary),
    },
    {
      key: 'joiningDate', header: 'Joined', priority: 'P3',
      render: (row) => formatDate(row.joiningDate),
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/hr/employees/${row._id}`}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View employee"
            title="View"
          >
            <Eye size={15} />
          </Link>
          <button
            onClick={() => setEditTarget(row)}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit employee" title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Delete employee" title="Delete"
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
        title="Employees"
        description="Manage employee records"
        breadcrumbs={[{ label: 'HR' }, { label: 'Employees' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Employee
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search" placeholder="Search employees…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
        <select
          value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TERMINATED">Terminated</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.employees?.length === 0 && !isLoading ? (
        <EmptyState
          title="No employees yet"
          description="Add your first employee to get started."
          action={
            <button onClick={() => setCreateOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Employee
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.employees ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <EmployeeFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EmployeeFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} employee={editTarget} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Deactivate Employee"
        description={`Deactivate "${deleteTarget?.name}"? They will no longer appear in active lists.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          if (deleteTarget) { await deleteEmployee(deleteTarget._id); setDeleteTarget(null); }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
