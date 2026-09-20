'use client';

import { useParams } from 'next/navigation';
import { Printer, FileDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetPayrollQuery } from '@/features/hr/services/hrApi';
import type { Payroll } from '@/features/hr/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useGetPayrollQuery(id);
  const payroll = data?.data?.payroll as Payroll | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !payroll) return <ErrorState onRetry={refetch} />;

  const emp = typeof payroll.employee === 'object' ? payroll.employee : null;
  const periodLabel = `${MONTHS[payroll.period.month - 1]} ${payroll.period.year}`;

  return (
    <>
      <PageHeader
        title={`Payslip — ${periodLabel}`}
        description={payroll.payrollNumber}
        breadcrumbs={[{ label: 'HR' }, { label: 'Payroll', href: '/hr/payroll' }, { label: payroll.payrollNumber }]}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1'}/hr/payroll/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <FileDown size={15} aria-hidden="true" /> Download PDF
            </a>
            <button
              onClick={() => window.print()}
              className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Printer size={15} aria-hidden="true" /> Print
            </button>
          </div>
        }
      />

      <div className="max-w-2xl bg-white rounded-xl border border-border p-8 print:shadow-none print:border-none">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Health Care Cosmetics Ltd.</h2>
            <p className="text-sm text-muted mt-1">Payslip for {periodLabel}</p>
          </div>
          <StatusBadge status={payroll.status} />
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-muted text-xs">Employee Name</p>
            <p className="font-medium">{emp?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted text-xs">Employee ID</p>
            <p className="font-medium font-mono">{emp?.employeeId ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted text-xs">Present Days</p>
            <p className="font-medium">{payroll.presentDays}</p>
          </div>
          <div>
            <p className="text-muted text-xs">Absent Days</p>
            <p className="font-medium">{payroll.absentDays}</p>
          </div>
          {payroll.paidAt && (
            <div>
              <p className="text-muted text-xs">Paid On</p>
              <p className="font-medium">{formatDate(payroll.paidAt)}</p>
            </div>
          )}
        </div>

        {/* Earnings */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Earnings</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Base Salary</span>
              <span className="font-medium">{formatCurrency(payroll.baseSalary)}</span>
            </div>
            {payroll.allowances.map((a, i) => (
              <div key={i} className="flex justify-between text-emerald-700">
                <span>{a.label}</span>
                <span>{formatCurrency(a.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
              <span>Gross Salary</span>
              <span>{formatCurrency(payroll.grossSalary)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        {payroll.deductions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Deductions</h3>
            <div className="space-y-1 text-sm">
              {payroll.deductions.map((d, i) => (
                <div key={i} className="flex justify-between text-red-600">
                  <span>{d.label}</span>
                  <span>({formatCurrency(d.amount)})</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1 text-red-600">
                <span>Total Deductions</span>
                <span>({formatCurrency(payroll.totalDeductions)})</span>
              </div>
            </div>
          </div>
        )}

        {/* Net */}
        <div className="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-3 mt-4">
          <span className="font-bold text-foreground">Net Salary</span>
          <span className="text-xl font-bold text-emerald">{formatCurrency(payroll.netSalary)}</span>
        </div>

        {payroll.notes && (
          <p className="text-sm text-muted mt-4">Notes: {payroll.notes}</p>
        )}
      </div>
    </>
  );
}
