'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import {
  useGetEmployeeListReportQuery,
  useGetAttendanceSummaryReportQuery,
  useGetPayrollSummaryReportQuery,
} from '@/features/reports/services/reportsApi';
import type { EmployeeRow, AttendanceSummaryRow, PayrollRow } from '@/features/reports/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

type Tab = 'employees' | 'attendance' | 'payroll';

export default function HRReportPage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [empPage, setEmpPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: empData, isLoading: empLoading, isError: empError, refetch: empRefetch } = useGetEmployeeListReportQuery({ page: empPage });
  const { data: attData, isLoading: attLoading, isError: attError, refetch: attRefetch } = useGetAttendanceSummaryReportQuery({ from: from || undefined, to: to || undefined });
  const { data: payData, isLoading: payLoading, isError: payError, refetch: payRefetch } = useGetPayrollSummaryReportQuery({ page: payPage });

  const empCsvUrl = `${API_URL}/reports/hr/employees?format=csv`;
  const attCsvUrl = `${API_URL}/reports/hr/attendance?format=csv${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;
  const payCsvUrl = `${API_URL}/reports/hr/payroll?format=csv`;

  const empColumns: Column<EmployeeRow>[] = [
    { key: 'employeeId', header: 'ID', priority: 'P2', render: (r) => <span className="font-mono text-[13px]">{r.employeeId}</span> },
    { key: 'name', header: 'Name', priority: 'P1', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'department', header: 'Department', priority: 'P2', render: (r) => (typeof r.department === 'object' ? r.department.name : '—') },
    { key: 'designation', header: 'Designation', priority: 'P3' },
    { key: 'joiningDate', header: 'Joined', priority: 'P3', render: (r) => formatDate(r.joiningDate) },
    { key: 'status', header: 'Status', priority: 'P1', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'currentSalary', header: 'Salary', priority: 'P2', render: (r) => formatCurrency(r.currentSalary) },
  ];

  const attColumns: Column<AttendanceSummaryRow>[] = [
    { key: 'employeeId', header: 'ID', priority: 'P2', render: (r) => <span className="font-mono text-[13px]">{r.employeeId}</span> },
    { key: 'employeeName', header: 'Employee', priority: 'P1', render: (r) => <span className="font-medium">{r.employeeName}</span> },
    { key: 'present', header: 'Present', priority: 'P1', render: (r) => formatNumber(r.present, 0) },
    { key: 'absent', header: 'Absent', priority: 'P1', render: (r) => formatNumber(r.absent, 0) },
    { key: 'late', header: 'Late', priority: 'P2', render: (r) => formatNumber(r.late, 0) },
    { key: 'halfDay', header: 'Half Day', priority: 'P2', render: (r) => formatNumber(r.halfDay, 0) },
    { key: 'total', header: 'Total', priority: 'P2', render: (r) => formatNumber(r.total, 0) },
  ];

  const payColumns: Column<PayrollRow>[] = [
    { key: 'payrollNumber', header: 'Ref #', priority: 'P2', render: (r) => <span className="font-mono text-[13px]">{r.payrollNumber}</span> },
    { key: 'employee', header: 'Employee', priority: 'P1', render: (r) => <span className="font-medium">{typeof r.employee === 'object' ? r.employee.name : '—'}</span> },
    { key: 'period', header: 'Period', priority: 'P2', render: (r) => `${r.period.month}/${r.period.year}` },
    { key: 'grossSalary', header: 'Gross', priority: 'P1', render: (r) => formatCurrency(r.grossSalary) },
    { key: 'netSalary', header: 'Net', priority: 'P1', render: (r) => formatCurrency(r.netSalary) },
    { key: 'status', header: 'Status', priority: 'P1', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'employees', label: 'Employees' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'payroll', label: 'Payroll' },
  ];

  const csvUrl = tab === 'employees' ? empCsvUrl : tab === 'attendance' ? attCsvUrl : payCsvUrl;

  return (
    <>
      <PageHeader
        title="HR Report"
        description="Employees, attendance, and payroll summary"
        breadcrumbs={[{ label: 'Reports' }, { label: 'HR' }]}
        actions={
          <a href={csvUrl} download className="h-9 px-4 rounded-md border border-border bg-white text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 whitespace-nowrap ${tab === t.key ? 'border-emerald text-emerald' : 'border-transparent text-secondary hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Attendance date filter */}
      {tab === 'attendance' && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-sm text-secondary whitespace-nowrap shrink-0">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald min-w-0" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-sm text-secondary whitespace-nowrap shrink-0">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald min-w-0" />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }}
              className="h-9 px-3 rounded-md border border-border text-sm text-secondary hover:bg-slate-50 transition-colors">Clear</button>
          )}
        </div>
      )}

      {tab === 'employees' && (
        empError ? <ErrorState onRetry={empRefetch} />
          : empData?.data?.employees?.length === 0 && !empLoading ? <EmptyState title="No employees" description="No employee records found." />
          : <DataTable columns={empColumns} data={empData?.data?.employees ?? []} keyField="_id" isLoading={empLoading} pagination={empData?.pagination} onPageChange={setEmpPage} />
      )}

      {tab === 'attendance' && (
        attError ? <ErrorState onRetry={attRefetch} />
          : attData?.data?.summary?.length === 0 && !attLoading ? <EmptyState title="No attendance data" description="No attendance records for this period." />
          : <DataTable columns={attColumns} data={attData?.data?.summary ?? []} keyField="_id" isLoading={attLoading} />
      )}

      {tab === 'payroll' && (
        payError ? <ErrorState onRetry={payRefetch} />
          : payData?.data?.payrolls?.length === 0 && !payLoading ? <EmptyState title="No payroll records" description="No payroll records found." />
          : <DataTable columns={payColumns} data={payData?.data?.payrolls ?? []} keyField="_id" isLoading={payLoading} pagination={payData?.pagination} onPageChange={setPayPage} />
      )}
    </>
  );
}
