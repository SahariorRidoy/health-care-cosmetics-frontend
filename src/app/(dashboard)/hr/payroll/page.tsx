'use client';

import { useState } from 'react';
import { Plus, Eye, CheckCircle, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { formatCurrency } from '@/lib/formatters';
import {
  useGetPayrollsQuery,
  useBulkGeneratePayrollMutation,
  useUpdatePayrollStatusMutation,
} from '@/features/hr/services/hrApi';
import { GeneratePayrollDialog } from '@/features/hr/components/GeneratePayrollDialog';
import type { Payroll } from '@/features/hr/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentYear = new Date().getFullYear();

export default function PayrollPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [generateOpen, setGenerateOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Payroll | null>(null);
  const [payTarget, setPayTarget] = useState<Payroll | null>(null);

  const { data, isLoading, isError, refetch } = useGetPayrollsQuery({
    page,
    status: statusFilter || undefined,
    month: monthFilter ? Number(monthFilter) : undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
  });
  const [bulkGenerate, { isLoading: bulkGenerating }] = useBulkGeneratePayrollMutation();
  const [updateStatus, { isLoading: updating }] = useUpdatePayrollStatusMutation();

  const columns: Column<Payroll>[] = [
    {
      key: 'payrollNumber', header: 'Ref #', priority: 'P2',
      render: (row) => <span className="font-mono text-[13px]">{row.payrollNumber}</span>,
    },
    {
      key: 'employee', header: 'Employee', priority: 'P1',
      render: (row) => {
        const emp = typeof row.employee === 'object' ? row.employee : null;
        return emp ? <span className="font-medium">{emp.name} <span className="text-muted font-normal">({emp.employeeId})</span></span> : '—';
      },
    },
    {
      key: 'period', header: 'Period', priority: 'P1',
      render: (row) => `${MONTHS[row.period.month - 1]} ${row.period.year}`,
    },
    {
      key: 'grossSalary', header: 'Gross', priority: 'P2',
      render: (row) => formatCurrency(row.grossSalary),
    },
    {
      key: 'netSalary', header: 'Net', priority: 'P1',
      render: (row) => <span className="font-medium">{formatCurrency(row.netSalary)}</span>,
    },
    {
      key: 'presentDays', header: 'Days', priority: 'P3',
      render: (row) => `${row.presentDays}P / ${row.absentDays}A`,
    },
    {
      key: 'status', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[110px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/hr/payroll/${row._id}`}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="View payslip" title="View"
          >
            <Eye size={15} />
          </Link>
          {row.status === 'DRAFT' && (
            <button
              onClick={() => setApproveTarget(row)}
              className="p-1.5 rounded-md text-emerald hover:bg-emerald-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Approve payroll" title="Approve"
            >
              <CheckCircle size={15} />
            </button>
          )}
          {row.status === 'APPROVED' && (
            <button
              onClick={() => setPayTarget(row)}
              className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Mark as paid" title="Mark Paid"
            >
              <CreditCard size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Generate and manage employee payroll"
        breadcrumbs={[{ label: 'HR' }, { label: 'Payroll' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBulkTarget(true)}
              className="h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Bulk Generate
            </button>
            <button
              onClick={() => setGenerateOpen(true)}
              className="h-9 px-3 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus size={16} aria-hidden="true" /> Generate
            </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <select
          value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by year"
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.payrolls?.length === 0 && !isLoading ? (
        <EmptyState
          title="No payroll records"
          description="Generate payroll for the selected period."
          action={
            <button onClick={() => setGenerateOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={16} aria-hidden="true" /> Generate Payroll
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.payrolls ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}

      <GeneratePayrollDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />

      <ConfirmDialog
        open={bulkTarget}
        title="Bulk Generate Payroll"
        description={`Generate payroll for ALL active employees for ${MONTHS[Number(monthFilter || new Date().getMonth() + 1) - 1]} ${yearFilter}? Existing records will be skipped.`}
        confirmLabel="Generate All"
        loading={bulkGenerating}
        onConfirm={async () => {
          await bulkGenerate({
            month: Number(monthFilter || new Date().getMonth() + 1),
            year: Number(yearFilter),
          });
          setBulkTarget(false);
        }}
        onCancel={() => setBulkTarget(false)}
      />

      <ConfirmDialog
        open={!!approveTarget}
        title="Approve Payroll"
        description={`Approve payroll "${approveTarget?.payrollNumber}"?`}
        confirmLabel="Approve"
        loading={updating}
        onConfirm={async () => {
          if (approveTarget) { await updateStatus({ id: approveTarget._id, status: 'APPROVED' }); setApproveTarget(null); }
        }}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmDialog
        open={!!payTarget}
        title="Mark as Paid"
        description={`Mark payroll "${payTarget?.payrollNumber}" as paid?`}
        confirmLabel="Mark Paid"
        loading={updating}
        onConfirm={async () => {
          if (payTarget) { await updateStatus({ id: payTarget._id, status: 'PAID' }); setPayTarget(null); }
        }}
        onCancel={() => setPayTarget(null)}
      />
    </>
  );
}
