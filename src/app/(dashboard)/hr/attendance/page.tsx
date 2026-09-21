'use client';

import { useState, useEffect, useMemo } from 'react';
import { Save, Loader2, ChevronLeft, ChevronRight, X, ClipboardList, AlertCircle, UserCheck, UserX, Clock, Users, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import {
  useGetAttendanceQuery,
  useGetEmployeesQuery,
  useBulkUpsertAttendanceMutation,
} from '@/features/hr/services/hrApi';
import type { Employee } from '@/features/hr/types';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Present', color: 'bg-emerald text-white' },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-500 text-white' },
  { value: 'LATE', label: 'Late', color: 'bg-amber-500 text-white' },
  { value: 'HALF_DAY', label: 'Half Day', color: 'bg-blue-500 text-white' },
];

const DOT_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald',
  ABSENT: 'bg-red-500',
  LATE: 'bg-amber-500',
  HALF_DAY: 'bg-blue-500',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(d: string, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function calMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString().slice(0, 10);
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendancePage() {
  const today = todayStr();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(today);
  const [records, setRecords] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [saved, setSaved] = useState(false);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: empData, isLoading: empLoading } = useGetEmployeesQuery({ status: 'ACTIVE' });
  const employees = empData?.data?.employees ?? [];

  // Calendar month data — for dots on each day
  const { from: calFrom, to: calTo } = calMonthRange(calYear, calMonth);
  const { data: calMonthData } = useGetAttendanceQuery({ from: calFrom, to: calTo, page: 1 });
  const calRecords = useMemo(() => calMonthData?.data?.attendance ?? [], [calMonthData]);

  // Selected day data — for left panel
  const { data: selectedDayData, isFetching: selectedDayLoading } = useGetAttendanceQuery(
    { from: selectedDate, to: selectedDate, page: 1 },
  );
  const selectedDayRecords = useMemo(() => selectedDayData?.data?.attendance ?? [], [selectedDayData]);

  // Modal day data
  const { data: dayData, isFetching: dayLoading } = useGetAttendanceQuery(
    { from: modalDate, to: modalDate, page: 1 },
    { skip: !modalOpen },
  );

  const [bulkUpsert, { isLoading: saving }] = useBulkUpsertAttendanceMutation();

  // Seed modal records
  useEffect(() => {
    if (!employees.length) return;
    const existing: Record<string, { status: AttendanceStatus; notes: string }> = {};
    (dayData?.data?.attendance ?? []).forEach((a) => {
      const empId = typeof a.employee === 'object' ? a.employee._id : a.employee;
      existing[empId] = { status: a.status as AttendanceStatus, notes: a.notes ?? '' };
    });
    const init: Record<string, { status: AttendanceStatus; notes: string }> = {};
    employees.forEach((e) => { init[e._id] = existing[e._id] ?? { status: 'PRESENT', notes: '' }; });
    setRecords(init);
    setSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length, modalDate, dayData]);

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

  function resetForm() {
    const init: Record<string, { status: AttendanceStatus; notes: string }> = {};
    employees.forEach((e) => { init[e._id] = { status: 'PRESENT', notes: '' }; });
    setRecords(init);
    setSaved(false);
    setModalDate(today);
  }

  async function handleSave() {
    const payload = employees.map((e) => ({
      employee: e._id,
      status: records[e._id]?.status ?? 'PRESENT',
      notes: records[e._id]?.notes || undefined,
    }));
    try {
      await bulkUpsert({ date: modalDate, records: payload }).unwrap();
      setSaved(true);
      if (modalDate === today) {
        setTimeout(() => { setModalOpen(false); resetForm(); }, 1200);
      }
    } catch { /* surfaced by RTK Query */ }
  }

  const modalSummary = employees.reduce((acc, e) => {
    const s = records[e._id]?.status ?? 'PRESENT';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Selected day counts
  const dayCounts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0 };
    selectedDayRecords.forEach((r) => { if (r.status in c) c[r.status as AttendanceStatus]++; });
    return c;
  }, [selectedDayRecords]);

  // Build calendar dot map: date -> { PRESENT, ABSENT, LATE, HALF_DAY }
  const dotMap = useMemo(() => {
    const map: Record<string, Partial<Record<AttendanceStatus, number>>> = {};
    calRecords.forEach((r) => {
      const d = r.date?.slice(0, 10);
      if (!d) return;
      if (!map[d]) map[d] = {};
      map[d][r.status as AttendanceStatus] = (map[d][r.status as AttendanceStatus] ?? 0) + 1;
    });
    return map;
  }, [calRecords]);

  // Calendar grid
  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    const now = new Date();
    if (calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth >= now.getMonth())) return;
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const isNextMonthDisabled = useMemo(() => {
    const now = new Date();
    return calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth >= now.getMonth());
  }, [calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark and track daily employee attendance"
        breadcrumbs={[{ label: 'HR' }, { label: 'Attendance' }]}
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <ClipboardList size={15} />
            Mark Attendance
          </button>
        }
      />

      {/* Mark Attendance Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setModalOpen(false); resetForm(); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Mark Attendance</h2>
                <p className="text-xs text-secondary mt-0.5">Record daily attendance for all active employees</p>
              </div>
              <button onClick={() => { setModalOpen(false); resetForm(); }} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Date navigator */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
                  <button onClick={() => setModalDate((d) => shiftDate(d, -1))} className="p-2 hover:bg-slate-100 transition-colors" aria-label="Previous day">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center gap-2 px-3">
                    <CalendarDays size={15} className="text-secondary" />
                    <input
                      type="date" value={modalDate} max={today}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="text-sm font-medium bg-transparent focus:outline-none"
                    />
                  </div>
                  <button onClick={() => setModalDate((d) => shiftDate(d, 1))} disabled={modalDate >= today} className="p-2 hover:bg-slate-100 transition-colors disabled:opacity-40" aria-label="Next day">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-secondary">Mark all:</span>
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s.value} onClick={() => markAll(s.value)} className={`h-7 px-3 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${s.color}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Not entered banner */}
              {!dayLoading && !empLoading && employees.length > 0 && (dayData?.data?.attendance ?? []).length === 0 && !saved && (
                <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                  <AlertCircle size={15} className="shrink-0" />
                  No attendance entry for <span className="font-semibold">{formatDate(modalDate)}</span>. Fill in below and save.
                </div>
              )}

              {/* Summary bar */}
              {employees.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {STATUS_OPTIONS.map((s) => (
                    <div key={s.value} className="flex items-center gap-1.5 text-xs text-secondary">
                      <span className={`w-2 h-2 rounded-full ${s.color}`} />
                      {s.label}: <span className="font-semibold text-foreground">{modalSummary[s.value] ?? 0}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-xs text-secondary ml-auto">
                    Total: <span className="font-semibold text-foreground">{employees.length}</span>
                  </div>
                </div>
              )}

              {/* Bulk sheet */}
              {empLoading || dayLoading ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
                      <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                      <div className="h-8 w-64 bg-slate-200 rounded animate-pulse ml-auto" />
                    </div>
                  ))}
                </div>
              ) : employees.length === 0 ? (
                <div className="rounded-lg border border-border px-4 py-12 text-center text-muted text-sm">No active employees found.</div>
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
                                type="text" value={rec.notes}
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
            </div>

            {employees.length > 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border">
                {saved ? <span className="text-xs text-emerald font-medium">✓ Attendance saved for {modalDate}</span> : <span />}
                <button
                  onClick={handleSave} disabled={saving}
                  className="h-9 px-5 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main layout: left panel + right calendar */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* Left — selected day detail */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Day heading */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-foreground">
                {selectedDate === today ? 'Today' : formatDate(selectedDate)}
              </div>
              {selectedDate !== today && (
                <div className="text-xs text-secondary">{formatDate(selectedDate)}</div>
              )}
            </div>
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="text-xs text-emerald hover:underline"
              >
                Back to today
              </button>
            )}
          </div>

          {/* Status counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Present', value: dayCounts.PRESENT, icon: UserCheck, color: 'text-emerald', bg: 'bg-emerald/10' },
              { label: 'Absent', value: dayCounts.ABSENT, icon: UserX, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Late', value: dayCounts.LATE, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
              { label: 'Half Day', value: dayCounts.HALF_DAY, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-xl border border-border bg-white px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={17} className={color} />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground leading-none">{value}</div>
                  <div className="text-xs text-secondary mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Day attendance table */}
          {selectedDayLoading || empLoading ? (
            <div className="rounded-lg border border-border overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
                  <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : selectedDayRecords.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center">
              <AlertCircle size={20} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-amber-700">No attendance entry for this day</p>
              <p className="text-xs text-amber-600 mt-1">Use &quot;Mark Attendance&quot; to add records</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide hidden sm:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayRecords.map((row) => {
                    const emp = typeof row.employee === 'object' ? row.employee : null;
                    return (
                      <tr key={row._id} className="border-b border-border last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{emp?.name ?? '—'}</div>
                          <div className="text-xs text-muted">{emp?.employeeId}</div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3 hidden sm:table-cell text-sm text-secondary">{row.notes ?? <span className="text-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right — calendar */}
        <div className="w-full lg:w-[320px] shrink-0 rounded-xl border border-border bg-white p-4">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
            <button onClick={nextMonth} disabled={isNextMonthDisabled} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-secondary py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {calDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const isFuture = dateStr > today;
              const dots = dotMap[dateStr];
              const hasEntry = !!dots && Object.values(dots).some(v => (v ?? 0) > 0);
              const noEntry = !isFuture && !hasEntry;

              return (
                <button
                  key={dateStr}
                  disabled={isFuture}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative flex flex-col items-center justify-start pt-1 pb-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                    isSelected
                      ? 'bg-emerald text-white'
                      : isToday
                      ? 'bg-emerald/10 text-emerald'
                      : isFuture
                      ? 'text-slate-300 cursor-default'
                      : 'hover:bg-slate-100 text-foreground'
                  }`}
                >
                  <span>{day}</span>
                  {/* Dots */}
                  {hasEntry && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {(Object.entries(dots) as [AttendanceStatus, number][])
                        .filter(([, count]) => count > 0)
                        .slice(0, 3)
                        .map(([status]) => (
                          <span
                            key={status}
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : DOT_COLORS[status]}`}
                          />
                        ))}
                    </div>
                  )}
                  {/* No entry indicator */}
                  {noEntry && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white/40' : 'bg-slate-300'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-x-3 gap-y-1.5">
            {STATUS_OPTIONS.map((s) => (
              <div key={s.value} className="flex items-center gap-1.5 text-xs text-secondary">
                <span className={`w-2 h-2 rounded-full ${DOT_COLORS[s.value]}`} />
                {s.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              No entry
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
