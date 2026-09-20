'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetAttendanceQuery,
  useGetEmployeesQuery,
  useBulkUpsertAttendanceMutation,
} from '@/features/hr/services/hrApi';
import type { Attendance, Employee } from '@/features/hr/types';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Present', color: 'bg-emerald text-white' },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-500 text-white' },
  { value: 'LATE', label: 'Late', color: 'bg-amber-500 text-white' },
  { value: 'HALF_DAY', label: 'Half Day', color: 'bg-blue-500 text-white' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [tab, setTab] = useState<'bulk' | 'log'>('bulk');
  const [date, setDate] = useState(todayStr);
  const [records, setRecords] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [saved, setSaved] = useState(false);

  // Log tab filters
  const [page, setPage] = useState(1);
  const [empFilter, setEmpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: empData, isLoading: empLoading } = useGetEmployeesQuery({ status: 'ACTIVE' });
  const employees = empData?.data?.employees ?? [];

  const { data: logData, isLoading: logLoading, isError: logError, refetch } = useGetAttendanceQuery(
    { page, employee: empFilter || undefined, status: statusFilter || undefined, from: from || undefined, to: to || undefined },
    { skip: tab !== 'log' },
  );

  const [bulkUpsert, { isLoading: saving }] = useBulkUpsertAttendanceMutation();

  // Init records when employees or date changes
  useEffect(() => {
    if (!employees.length) return;
    const init: Record<string, { status: AttendanceStatus; notes: string }> = {};
    employees.forEach((e) => {
      init[e._id] = records[e._id] ?? { status: 'PRESENT', notes: '' };
    });
    setRecords(init);
    setSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length, date]);

  function setStatus(empId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [empId]: { ...prev[empId], status } }));
    setSaved(false);
  }

  function setNotes(empId: string, notes: string) {
    setRecords((prev) => ({ ...prev, [empId]: { ...prev[empId], notes } }));
    setSaved(false);
  }

  function markAll(status: AttendanceStatus) {
    const updated: Record<string, { status: AttendanceStatus; notes: string }> = {};
    employees.forEach((e) => { updated[e._id] = { ...records[e._id], status }; });
    setRecords(updated);
    setSaved(false);
  }

  async function handleSave() {
    const payload = employees.map((e) => ({
      employee: e._id,
      status: records[e._id]?.status ?? 'PRESENT',
      notes: records[e._id]?.notes || undefined,
    }));
    try {
      await bulkUpsert({ date, records: payload }).unwrap();
      setSaved(true);
    } catch { /* surfaced by RTK Query */ }
  }

  const summary = employees.reduce(
    (acc, e) => {
      const s = records[e._id]?.status ?? 'PRESENT';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const logColumns: Column<Attendance>[] = [
    {
      key: 'employee', header: 'Employee', priority: 'P1',
      render: (row) => {
        const emp = typeof row.employee === 'object' ? row.employee : null;
        return emp
          ? <span className="font-medium">{emp.name} <span className="text-muted font-normal">({emp.employeeId})</span></span>
          : '—';
      },
    },
    { key: 'date', header: 'Date', priority: 'P1', render: (row) => formatDate(row.date) },
    { key: 'status', header: 'Status', priority: 'P1', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'notes', header: 'Notes', priority: 'P3', render: (row) => row.notes ?? <span className="text-muted">—</span> },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark and track daily employee attendance"
        breadcrumbs={[{ label: 'HR' }, { label: 'Attendance' }]}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {(['bulk', 'log'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-emerald text-emerald' : 'border-transparent text-secondary hover:text-foreground'
            }`}
          >
            {t === 'bulk' ? 'Mark Attendance' : 'Attendance Log'}
          </button>
        ))}
      </div>

      {tab === 'bulk' && (
        <div className="space-y-4">
          {/* Date navigator */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setDate((d) => shiftDate(d, -1))}
                className="p-2 hover:bg-slate-100 transition-colors"
                aria-label="Previous day"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 px-3">
                <CalendarDays size={15} className="text-secondary" />
                <input
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-sm font-medium bg-transparent focus:outline-none"
                />
              </div>
              <button
                onClick={() => setDate((d) => shiftDate(d, 1))}
                disabled={date >= todayStr()}
                className="p-2 hover:bg-slate-100 transition-colors disabled:opacity-40"
                aria-label="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Mark all shortcuts */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-secondary">Mark all:</span>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => markAll(s.value)}
                  className={`h-7 px-3 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${s.color}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary bar */}
          {employees.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <div key={s.value} className="flex items-center gap-1.5 text-xs text-secondary">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  {s.label}: <span className="font-semibold text-foreground">{summary[s.value] ?? 0}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-secondary ml-auto">
                Total: <span className="font-semibold text-foreground">{employees.length}</span>
              </div>
            </div>
          )}

          {/* Bulk sheet */}
          {empLoading ? (
            <div className="rounded-lg border border-border overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
                  <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                  <div className="h-8 w-64 bg-slate-200 rounded animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-lg border border-border px-4 py-12 text-center text-muted text-sm">
              No active employees found.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp: Employee, idx: number) => {
                    const rec = records[emp._id] ?? { status: 'PRESENT' as AttendanceStatus, notes: '' };
                    return (
                      <tr key={emp._id} className="border-b border-border last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-muted text-xs w-8">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{emp.name}</div>
                          <div className="text-xs text-muted">{emp.employeeId} · {typeof emp.department === 'object' ? emp.department.name : ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {STATUS_OPTIONS.map((s) => (
                              <button
                                key={s.value}
                                onClick={() => setStatus(emp._id, s.value)}
                                className={`h-7 px-3 rounded-full text-xs font-medium transition-all border ${
                                  rec.status === s.value
                                    ? `${s.color} border-transparent shadow-sm`
                                    : 'bg-white border-border text-secondary hover:border-slate-400'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <input
                            type="text"
                            value={rec.notes}
                            onChange={(e) => setNotes(emp._id, e.target.value)}
                            placeholder="Optional note..."
                            className="h-8 w-full max-w-[220px] rounded-md border border-border bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Save button */}
          {employees.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              {saved && <span className="text-xs text-emerald font-medium">✓ Attendance saved for {date}</span>}
              {!saved && <span />}
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-5 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={empFilter} onChange={(e) => { setEmpFilter(e.target.value); setPage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
            >
              <option value="">All Employees</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
            <select
              value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
            </select>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
              aria-label="From date"
            />
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="h-9 w-full sm:w-auto rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
              aria-label="To date"
            />
          </div>

          {logError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <DataTable
              columns={logColumns}
              data={logData?.data?.attendance ?? []}
              keyField="_id"
              isLoading={logLoading}
              pagination={logData?.pagination}
              onPageChange={setPage}
              emptyMessage="No attendance records found."
            />
          )}
        </div>
      )}
    </>
  );
}
