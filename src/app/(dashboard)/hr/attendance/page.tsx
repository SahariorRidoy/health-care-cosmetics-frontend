'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { useGetAttendanceQuery, useGetEmployeesQuery } from '@/features/hr/services/hrApi';
import { AttendanceDialog } from '@/features/hr/components/AttendanceDialog';
import type { Attendance } from '@/features/hr/types';

export default function AttendancePage() {
  const [page, setPage] = useState(1);
  const [empFilter, setEmpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetAttendanceQuery({
    page,
    employee: empFilter || undefined,
    status: statusFilter || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const { data: empData } = useGetEmployeesQuery({ status: 'ACTIVE' });
  const employees = empData?.data?.employees ?? [];

  const columns: Column<Attendance>[] = [
    {
      key: 'employee', header: 'Employee', priority: 'P1',
      render: (row) => {
        const emp = typeof row.employee === 'object' ? row.employee : null;
        return emp ? <span className="font-medium">{emp.name} <span className="text-muted font-normal">({emp.employeeId})</span></span> : '—';
      },
    },
    {
      key: 'date', header: 'Date', priority: 'P1',
      render: (row) => formatDate(row.date),
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'notes', header: 'Notes', priority: 'P3',
      render: (row) => row.notes ?? <span className="text-muted">—</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Track daily employee attendance"
        breadcrumbs={[{ label: 'HR' }, { label: 'Attendance' }]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> Record Attendance
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
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
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="LATE">Late</option>
          <option value="HALF_DAY">Half Day</option>
        </select>
        <input
          type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="From date"
        />
        <input
          type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="To date"
        />
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.attendance?.length === 0 && !isLoading ? (
        <EmptyState
          title="No attendance records"
          description="Start recording daily attendance."
          action={
            <button onClick={() => setCreateOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> Record Attendance
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.attendance ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <AttendanceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
