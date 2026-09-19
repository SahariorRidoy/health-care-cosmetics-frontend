'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/feedback';
import { StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  useGetEmployeeQuery,
  useGetSalaryStructuresQuery,
} from '@/features/hr/services/hrApi';
import { EmployeeFormDialog } from '@/features/hr/components/EmployeeFormDialog';
import { SalaryStructureDialog } from '@/features/hr/components/SalaryStructureDialog';
import type { Employee, SalaryStructure } from '@/features/hr/types';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetEmployeeQuery(id);
  const { data: salaryData } = useGetSalaryStructuresQuery(id);

  const employee = data?.data?.employee as Employee | undefined;
  const salaryStructures = salaryData?.data?.salaryStructures ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !employee) return <ErrorState onRetry={refetch} />;

  const dept = typeof employee.department === 'object' ? employee.department.name : '—';

  return (
    <>
      <PageHeader
        title={employee.name}
        description={`${employee.employeeId} · ${employee.designation}`}
        breadcrumbs={[{ label: 'HR' }, { label: 'Employees', href: '/hr/employees' }, { label: employee.name }]}
        actions={
          <button
            onClick={() => setEditOpen(true)}
            className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={15} aria-hidden="true" /> Edit
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Employee Details</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Department', dept],
              ['Designation', employee.designation],
              ['Joining Date', formatDate(employee.joiningDate)],
              ['Email', employee.email ?? '—'],
              ['Phone', employee.phone ?? '—'],
              ['Address', employee.address ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted text-xs">{label}</dt>
                <dd className="font-medium mt-0.5">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted text-xs">Status</dt>
              <dd className="mt-0.5"><StatusBadge status={employee.status} /></dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Current Salary</dt>
              <dd className="font-medium mt-0.5">{formatCurrency(employee.currentSalary)}</dd>
            </div>
          </dl>
        </div>

        {/* Salary Structures */}
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Salary Structures</h3>
            <button
              onClick={() => setSalaryOpen(true)}
              className="text-xs text-emerald hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> New
            </button>
          </div>
          {salaryStructures.length === 0 ? (
            <p className="text-sm text-muted">No salary structure defined.</p>
          ) : (
            <div className="space-y-3">
              {salaryStructures.map((s: SalaryStructure) => (
                <div key={s._id} className="border border-border rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted text-xs">Effective {formatDate(s.effectiveDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Base</span>
                    <span className="font-medium">{formatCurrency(s.baseSalary)}</span>
                  </div>
                  {s.allowances.map((a, i) => (
                    <div key={i} className="flex justify-between text-emerald-700">
                      <span>+ {a.label}</span>
                      <span>{formatCurrency(a.amount)}</span>
                    </div>
                  ))}
                  {s.deductions.map((d, i) => (
                    <div key={i} className="flex justify-between text-red-600">
                      <span>- {d.label}</span>
                      <span>{formatCurrency(d.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <EmployeeFormDialog open={editOpen} onClose={() => setEditOpen(false)} employee={employee} />
      <SalaryStructureDialog open={salaryOpen} onClose={() => setSalaryOpen(false)} employeeId={id} />
    </>
  );
}
