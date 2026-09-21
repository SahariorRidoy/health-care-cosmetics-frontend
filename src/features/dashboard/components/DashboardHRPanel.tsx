'use client';

import Link from 'next/link';
import { Users, UserCheck, Calendar, Banknote, Clock } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { StatusBadge } from '@/components/feedback';
import type { AttendanceSummaryRow, PayrollTotals } from '@/features/reports/types';

interface Props {
  totalEmployees: number;
  attendanceSummary: AttendanceSummaryRow[];
  payrollTotals: PayrollTotals[];
  pendingLeaves: number;
}

export function DashboardHRPanel({ totalEmployees, attendanceSummary, payrollTotals, pendingLeaves }: Props) {
  const totalPresent = attendanceSummary.reduce((s, r) => s + r.present, 0);
  const totalAbsent = attendanceSummary.reduce((s, r) => s + r.absent, 0);
  const totalLate = attendanceSummary.reduce((s, r) => s + r.late, 0);
  const totalAttendance = totalPresent + totalAbsent + totalLate;
  const attendancePct = totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0;
  const attColor = attendancePct >= 90 ? 'text-emerald-600' : attendancePct >= 75 ? 'text-amber-600' : 'text-red-500';
  const attBarColor = attendancePct >= 90 ? 'bg-emerald-500' : attendancePct >= 75 ? 'bg-amber-400' : 'bg-red-400';

  const totalNetPayroll = payrollTotals.reduce((s, r) => s + r.totalNet, 0);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-cyan-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center shadow-sm">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Human Resources Overview</h2>
            <p className="text-[11px] text-secondary">Workforce, attendance & payroll summary</p>
          </div>
        </div>
        <Link href="/hr/employees" className="text-xs text-cyan-600 hover:underline font-semibold">
          View HR →
        </Link>
      </div>

      <div className="p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-cyan-600" />
              <span className="text-[11px] font-semibold text-cyan-700 uppercase tracking-wide">Employees</span>
            </div>
            <p className="text-2xl font-bold text-cyan-700">{formatNumber(totalEmployees, 0)}</p>
            <p className="text-[10px] text-cyan-500 mt-0.5">Active staff</p>
          </div>
          <div className={`border rounded-xl p-4 ${pendingLeaves > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} className={pendingLeaves > 0 ? 'text-amber-600' : 'text-secondary'} />
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${pendingLeaves > 0 ? 'text-amber-700' : 'text-secondary'}`}>
                Pending Leaves
              </span>
            </div>
            <p className={`text-2xl font-bold ${pendingLeaves > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
              {pendingLeaves}
            </p>
            <p className={`text-[10px] mt-0.5 ${pendingLeaves > 0 ? 'text-amber-500' : 'text-muted'}`}>awaiting approval</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck size={14} className="text-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Attendance</span>
            </div>
            <p className={`text-2xl font-bold ${attColor}`}>{attendancePct}%</p>
            <p className="text-[10px] text-emerald-500 mt-0.5">attendance rate</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote size={14} className="text-blue-600" />
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Net Payroll</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalNetPayroll)}</p>
            <p className="text-[10px] text-blue-500 mt-0.5">{payrollTotals.length} payroll runs</p>
          </div>
        </div>

        {/* 3-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Breakdown */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <UserCheck size={12} className="text-emerald-600" />
              <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Attendance Breakdown</p>
            </div>
            {totalAttendance === 0 ? (
              <p className="text-xs text-muted">No attendance data.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-secondary">Attendance Rate</span>
                    <span className={`font-bold ${attColor}`}>{attendancePct}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${attBarColor}`} style={{ width: `${attendancePct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-emerald-700">{totalPresent}</p>
                    <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Present</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-red-600">{totalAbsent}</p>
                    <p className="text-[10px] text-red-500 uppercase tracking-wide">Absent</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-amber-700">{totalLate}</p>
                    <p className="text-[10px] text-amber-600 uppercase tracking-wide">Late</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payroll Summary */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Banknote size={12} className="text-blue-500" />
              <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Payroll Summary</p>
            </div>
            {payrollTotals.length === 0 ? (
              <p className="text-xs text-muted">No payroll data.</p>
            ) : (
              <div className="space-y-2">
                {payrollTotals.slice(0, 5).map((row) => (
                  <div key={row._id} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg">
                    <StatusBadge status={row._id} />
                    <span className="text-secondary">{row.count} payrolls</span>
                    <span className="font-semibold text-foreground">{formatCurrency(row.totalNet)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t border-border font-bold">
                  <span className="text-secondary">Total Net Payroll</span>
                  <span className="text-foreground">{formatCurrency(totalNetPayroll)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">Quick Links</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/hr/employees', icon: Users, label: 'Employees', color: 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100' },
                { href: '/hr/attendance', icon: UserCheck, label: 'Attendance', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                { href: '/hr/leaves', icon: Calendar, label: 'Leaves', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
                { href: '/hr/payroll', icon: Banknote, label: 'Payroll', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                { href: '/hr/departments', icon: Users, label: 'Departments', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
                { href: '/hr/leaves', icon: Clock, label: 'Pending Leaves', color: pendingLeaves > 0 ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-secondary bg-slate-50 hover:bg-slate-100' },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href + label} href={href} className={`flex items-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg transition-colors ${color}`}>
                  <Icon size={13} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
