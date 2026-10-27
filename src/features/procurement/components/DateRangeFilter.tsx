'use client';

import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, parseISO,
} from 'date-fns';
import { formatDate } from '@/lib/formatters';

export type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'year' | 'custom';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

function presetRange(preset: DatePreset): { from?: Date; to?: Date } {
  const now = new Date();
  switch (preset) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case '7d': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30d': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'lastMonth': { const last = subMonths(now, 1); return { from: startOfMonth(last), to: endOfMonth(last) }; }
    case 'year': return { from: startOfYear(now), to: endOfDay(now) };
    default: return {};
  }
}

/** Date-range filter state. `from`/`to` are ISO strings (local day boundaries) ready to send to the API. */
export function useDateRangeFilter(onChange?: () => void) {
  const [preset, setPreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const invalid = preset === 'custom' && !!customFrom && !!customTo && customFrom > customTo;
  const range = useMemo(() => {
    if (preset !== 'custom') return presetRange(preset);
    if (invalid) return {};
    return {
      from: customFrom ? startOfDay(parseISO(customFrom)) : undefined,
      to: customTo ? endOfDay(parseISO(customTo)) : undefined,
    };
  }, [preset, customFrom, customTo, invalid]);

  const label = range.from || range.to
    ? `${range.from ? formatDate(range.from, 'dd MMM yyyy') : 'Start'} – ${range.to ? formatDate(range.to, 'dd MMM yyyy') : 'Today'}`
    : 'All time';

  return {
    from: range.from?.toISOString(),
    to: range.to?.toISOString(),
    isActive: !!(range.from || range.to),
    label,
    filterProps: {
      preset,
      customFrom,
      customTo,
      invalid,
      onPresetChange: (p: DatePreset) => { setPreset(p); onChange?.(); },
      onCustomChange: (from: string, to: string) => { setCustomFrom(from); setCustomTo(to); onChange?.(); },
    },
  };
}

const inputCls = 'h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald';

export function DateRangeFilter({ preset, onPresetChange, customFrom, customTo, onCustomChange, invalid }: {
  preset: DatePreset;
  onPresetChange: (p: DatePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
      <div className="relative">
        <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as DatePreset)}
          aria-label="Filter by date"
          className={`${inputCls} w-full pl-9 pr-8 sm:w-40`}
        >
          {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {preset === 'custom' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => onCustomChange(e.target.value, customTo)}
              aria-label="From date"
              aria-invalid={invalid}
              className={`${inputCls} min-w-0 flex-1 sm:w-36 sm:flex-none ${invalid ? 'border-red-400' : ''}`}
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => onCustomChange(customFrom, e.target.value)}
              aria-label="To date"
              aria-invalid={invalid}
              className={`${inputCls} min-w-0 flex-1 sm:w-36 sm:flex-none ${invalid ? 'border-red-400' : ''}`}
            />
          </div>
          {invalid && <p className="text-xs text-red-600" role="alert">From date must be before To date.</p>}
        </div>
      )}
    </div>
  );
}
