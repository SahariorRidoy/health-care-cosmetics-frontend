'use client';

import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/formatters';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index?: number) => React.ReactNode;
  sortable?: boolean;
  /** P1 = always, P2 = md+, P3 = lg+ */
  priority?: 'P1' | 'P2' | 'P3';
  className?: string;
}

interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  isLoading?: boolean;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
  tableHeadAction?: React.ReactNode;
  headerClassName?: string;
  alwaysShowPagination?: boolean;
  rowClassName?: (row: T) => string;
}

const PRIORITY_CLASS: Record<string, string> = {
  P1: '',
  P2: 'hidden md:table-cell',
  P3: 'hidden lg:table-cell',
};

export function DataTable<T>({
  columns, data, keyField, isLoading, pagination,
  onPageChange, sortKey, sortDir, onSort, emptyMessage = 'No records found.', tableHeadAction, headerClassName, alwaysShowPagination, rowClassName,
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col gap-0 min-w-0">
      {tableHeadAction && (
        <div className="flex items-center justify-between mb-2">
          <span />
          {tableHeadAction}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap',
                    headerClassName ?? 'text-secondary',
                    PRIORITY_CLASS[col.priority ?? 'P1'],
                    col.className,
                    onSort && col.key !== 'actions' && col.key !== 'sl' ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors' : '',
                  )}
                  onClick={() => onSort && col.key !== 'actions' && col.key !== 'sl' ? onSort(col.key) : undefined}
                >
                  <div className={cn('flex items-center gap-2', col.className?.includes('text-center') ? 'justify-center' : 'justify-between')}>
                    <span>{col.header}</span>
                    {onSort && col.key !== 'actions' && col.key !== 'sl' && (
                      <span className="shrink-0">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ChevronUp size={13} className="text-foreground" /> : <ChevronDown size={13} className="text-foreground" />
                        ) : (
                          <ChevronsUpDown size={13} className="opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', PRIORITY_CLASS[col.priority ?? 'P1'])}>
                      <div className="h-4 bg-slate-200 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={String(row[keyField])}
                  className={cn(
                    'border-b border-border hover:bg-slate-50 transition-colors',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-foreground',
                        PRIORITY_CLASS[col.priority ?? 'P1'],
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row, rowIndex)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (alwaysShowPagination || pagination.pages > 1) && (
        <div className="flex items-center justify-between px-3 py-2 mt-3 rounded-lg border border-border bg-white text-sm text-secondary gap-3 flex-wrap">
          <span className="text-xs">
            {((pagination.page - 1) * pagination.limit) + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange?.(1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-md border border-border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft size={15} />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-md border border-border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[76px] px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold text-center">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="p-1.5 rounded-md border border-border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.pages)}
              disabled={pagination.page >= pagination.pages}
              className="p-1.5 rounded-md border border-border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors"
              aria-label="Last page"
            >
              <ChevronsRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
