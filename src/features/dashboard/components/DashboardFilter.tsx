'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const QUICK_PRESETS = [
  { label: 'This Month',  range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Last Month',  range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Last 3 Mo',   range: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
  { label: 'Last 6 Mo',   range: () => ({ from: startOfMonth(subMonths(new Date(), 5)), to: endOfMonth(new Date()) }) },
  { label: 'This Year',   range: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DashboardFilter({ value, onChange }: Props) {
  const today = new Date();
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [picking, setPicking]     = useState<'from' | 'to'>('from');
  const [tempFrom, setTempFrom]   = useState<Date | null>(null);
  const [tempTo, setTempTo]       = useState<Date | null>(null);
  const [hovered, setHovered]     = useState<Date | null>(null);

  const cells = buildCalendar(viewYear, viewMonth);

  function applyPreset(preset: typeof QUICK_PRESETS[0]) {
    const { from, to } = preset.range();
    onChange({ from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd'), label: preset.label });
    setOpen(false);
  }

  function handleDayClick(day: number) {
    const clicked = new Date(viewYear, viewMonth, day);
    if (picking === 'from') {
      setTempFrom(clicked);
      setTempTo(null);
      setPicking('to');
    } else {
      if (tempFrom && clicked < tempFrom) {
        setTempFrom(clicked);
        setPicking('to');
      } else {
        setTempTo(clicked);
      }
    }
  }

  function applyCustom() {
    if (!tempFrom || !tempTo) return;
    onChange({
      from: format(tempFrom, 'yyyy-MM-dd'),
      to:   format(tempTo,   'yyyy-MM-dd'),
      label: `${format(tempFrom, 'dd MMM yyyy')} – ${format(tempTo, 'dd MMM yyyy')}`,
    });
    setOpen(false);
  }

  function isInRange(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    const end = tempTo ?? hovered;
    if (!tempFrom || !end) return false;
    const [s, e] = tempFrom <= end ? [tempFrom, end] : [end, tempFrom];
    return d > s && d < e;
  }

  function isStart(day: number) {
    return tempFrom?.toDateString() === new Date(viewYear, viewMonth, day).toDateString();
  }

  function isEnd(day: number) {
    return tempTo?.toDateString() === new Date(viewYear, viewMonth, day).toDateString();
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Quick preset pills */}
      <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1">
        <button
          onClick={() => onChange({ from: '', to: '', label: 'All Time' })}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            value.label === 'All Time'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-secondary hover:bg-slate-100'
          }`}
        >
          All Time
        </button>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              value.label === p.label
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-secondary hover:bg-slate-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Clear button — only shown when a filter is active */}
      {value.label !== 'All Time' && (
        <button
          onClick={() => onChange({ from: '', to: '', label: 'All Time' })}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-white text-red-500 hover:bg-red-50 hover:border-red-300 transition-all"
        >
          <X size={13} />
          Clear
        </button>
      )}

      {/* Custom date range picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
            value.label.includes('–')
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white border-border text-secondary hover:border-slate-400'
          }`}>
            <CalendarDays size={14} />
            {value.label.includes('–') ? value.label : 'Custom Range'}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="z-50 bg-white rounded-2xl shadow-2xl border border-border p-0 w-[340px] animate-in fade-in-0 zoom-in-95"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Select Date Range</span>
              <Popover.Close className="text-muted hover:text-foreground transition-colors">
                <X size={16} />
              </Popover.Close>
            </div>

            {/* Picking indicator */}
            <div className="flex gap-2 px-5 pt-3">
              <div className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-all ${picking === 'from' ? 'border-slate-900 bg-slate-50' : 'border-border'}`}>
                <p className="text-muted text-[10px] uppercase tracking-wider mb-0.5">From</p>
                <p className="font-medium text-foreground">{tempFrom ? format(tempFrom, 'dd MMM yyyy') : '—'}</p>
              </div>
              <div className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-all ${picking === 'to' ? 'border-slate-900 bg-slate-50' : 'border-border'}`}>
                <p className="text-muted text-[10px] uppercase tracking-wider mb-0.5">To</p>
                <p className="font-medium text-foreground">{tempTo ? format(tempTo, 'dd MMM yyyy') : '—'}</p>
              </div>
            </div>

            {/* Calendar nav */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronLeft size={16} className="text-secondary" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronRight size={16} className="text-secondary" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-4 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 px-4 pb-4 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const start = isStart(day);
                const end   = isEnd(day);
                const inRng = isInRange(day);
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => picking === 'to' && setHovered(new Date(viewYear, viewMonth, day))}
                    onMouseLeave={() => setHovered(null)}
                    className={`relative h-8 w-full text-xs font-medium transition-all
                      ${start || end ? 'bg-slate-900 text-white rounded-lg z-10' : ''}
                      ${inRng ? 'bg-slate-100 text-foreground rounded-none' : ''}
                      ${!start && !end && !inRng ? 'text-foreground hover:bg-slate-100 rounded-lg' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Apply button */}
            <div className="px-5 pb-4">
              <button
                onClick={applyCustom}
                disabled={!tempFrom || !tempTo}
                className="w-full py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                Apply Range
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
