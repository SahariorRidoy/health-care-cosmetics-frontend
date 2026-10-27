import type { LucideIcon } from 'lucide-react';

export interface StatCardItem {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  valueTone: string;
  chip: string;
}

export function StatCards({ items, label, isLoading, isFetching }: {
  items: StatCardItem[] | null;
  label: string;
  isLoading: boolean;
  isFetching: boolean;
}) {
  return (
    <div
      aria-label={label}
      aria-busy={isLoading || isFetching}
      className={`mb-4 grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-4 ${isFetching && !isLoading ? 'opacity-60' : ''}`}
    >
      {isLoading || !items
        ? [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))
        : items.map((s) => (
            <div key={s.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.chip}`}>
                <s.icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                <p className={`truncate text-lg font-bold tabular-nums ${s.valueTone}`} title={s.value}>{s.value}</p>
                <p className="truncate text-xs text-slate-500" title={s.hint}>{s.hint}</p>
              </div>
            </div>
          ))}
    </div>
  );
}
