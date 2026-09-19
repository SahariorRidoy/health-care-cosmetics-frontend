'use client';

import { useState } from 'react';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetLeavesQuery,
  useGetEmployeesQuery,
  useUpdateLeaveStatusMutation,
} from '@/features/hr/services/hrApi';
import { LeaveFormDialog } from '@/features/hr/components/LeaveFormDialog';
import type { Leave } from '@/features/hr/types';

export default function LeavesPage() {
  const [page, setPage] = useState(1);
  const [empFilter, setEmpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Leave | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Leave | null>(null);

  const { data, isLoading, isError, refetch } = useGetLeavesQuery({
    page,
    employee: empFilter || undefined,
    status: statusFilter || undefined,
    leaveType: typeFilter || undefined,
  });
  const { data: empData } = useGetEmployeesQuery({});
  const [updateStatus, { isLoading: updating }] = useUpdateLeaveStatusMutation();
  const employees = empData?.data?.employees ?? [];

  const columns: Column<Leave>[] = [
    {
      key: 'employee', header: 'Employee', priority: 'P1',
      render: (row) => {
        const emp = typeof row.employee === 'object' ? row.employee : null;
        return emp ? <span className="font-medium">{emp.name}</span> : '—';
      },
    },
    {
      key: 'leaveType', header: 'Type', priority: 'P2',
      render: (row) => <span className="capitalize text-sm">{row.leaveType.toLowerCase()}</span>,
    },
    {
      key: 'startDate', header: 'From', priority: 'P1',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate', header: 'To', priority: 'P2',
      render: (row) => formatDate(row.endDate),
    },
    {
      key: 'totalDays', header: 'Days', priority: 'P2',
      render: (row) => row.totalDays,
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[80px] text-right',
      render: (row) => row.status === 'PENDING' ? (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setApproveTarget(row)}
            className="p-1.5 rounded-md text-emerald hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Approve leave" title="Approve"
          >
            <CheckCircle size={15} />
          </button>
          <button
            onClick={() => setRejectTarget(row)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Reject leave" title="Reject"
          >
            <XCircle size={15} />
          </button>
        </div>
      ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Leave Management"
        description="Review and manage employee leave requests"
        breadcrumbs={[{ label: 'HR' }, { label: 'Leaves' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New Leave
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <select
          value={empFilter} onChange={(e) => { setEmpFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by employee"
        >
          <option value="">All Employees</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <select
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by leave type"
        >
          <option value="">All Types</option>
          <option value="ANNUAL">Annual</option>
          <option value="SICK">Sick</option>
          <option value="CASUAL">Casual</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.leaves?.length === 0 && !isLoading ? (
        <EmptyState
          title="No leave requests"
          description="No leave requests found for the selected filters."
          action={
            <button onClick={() => setCreateOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> New Leave
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.leaves ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <LeaveFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={!!approveTarget}
        title="Approve Leave"
        description={`Approve leave request for "${typeof approveTarget?.employee === 'object' ? approveTarget.employee.name : ''}"?`}
        confirmLabel="Approve"
        loading={updating}
        onConfirm={async () => {
          if (approveTarget) { await updateStatus({ id: approveTarget._id, status: 'APPROVED' }); setApproveTarget(null); }
        }}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmDialog
        open={!!rejectTarget}
        title="Reject Leave"
        description={`Reject leave request for "${typeof rejectTarget?.employee === 'object' ? rejectTarget.employee.name : ''}"?`}
        confirmLabel="Reject"
        variant="danger"
        loading={updating}
        onConfirm={async () => {
          if (rejectTarget) { await updateStatus({ id: rejectTarget._id, status: 'REJECTED' }); setRejectTarget(null); }
        }}
        onCancel={() => setRejectTarget(null)}
      />
    </>
  );
}
