'use client';

import Link from 'next/link';
import { Package, CheckCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import type { StockBalanceRow } from '@/features/reports/types';

interface Props {
  lowStockItems: StockBalanceRow[];
  totalRawMats: number;
  totalFinishedGoods: number;
}

const typeLabel: Record<string, string> = {
  RAW_MATERIAL: 'Raw',
  PACKAGING: 'Pkg',
  FINISHED_GOOD: 'FG',
};

const typeBadge: Record<string, string> = {
  RAW_MATERIAL: 'bg-orange-100 text-orange-700',
  PACKAGING:    'bg-blue-100 text-blue-700',
  FINISHED_GOOD:'bg-violet-100 text-violet-700',
};

export function DashboardLowStockPanel({ lowStockItems, totalRawMats, totalFinishedGoods }: Props) {
  const rawLow = lowStockItems.filter((b) => {
    const t = (b.item as { type?: string })?.type;
    return t === 'RAW_MATERIAL' || t === 'PACKAGING';
  }).length;
  const fgLow = lowStockItems.filter((b) => (b.item as { type?: string })?.type === 'FINISHED_GOOD').length;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50">
            <Package size={15} className="text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-foreground">Low Stock Alerts</span>
          {lowStockItems.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
              {lowStockItems.length}
            </span>
          )}
        </div>
        <Link href="/reports/stock" className="text-xs text-emerald-600 hover:underline font-medium">
          Stock report →
        </Link>
      </div>

      <div className="p-5">
        {/* Summary chips */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5 bg-orange-50 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Raw / Pkg</span>
            <span className="text-sm font-bold text-orange-700">{rawLow}</span>
            <span className="text-[10px] text-orange-500">/ {totalRawMats}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-violet-50 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide">Finished</span>
            <span className="text-sm font-bold text-violet-700">{fgLow}</span>
            <span className="text-[10px] text-violet-500">/ {totalFinishedGoods}</span>
          </div>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 py-4">
            <CheckCircle size={16} />
            All items are above reorder level.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 font-semibold text-secondary uppercase tracking-wide">Item</th>
                    <th className="text-left py-2 pr-3 font-semibold text-secondary uppercase tracking-wide hidden sm:table-cell">SKU</th>
                    <th className="text-left py-2 pr-3 font-semibold text-secondary uppercase tracking-wide hidden md:table-cell">Type</th>
                    <th className="text-right py-2 pr-3 font-semibold text-secondary uppercase tracking-wide">Stock</th>
                    <th className="text-right py-2 font-semibold text-secondary uppercase tracking-wide">Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((row) => {
                    const itemType = (row.item as { type?: string })?.type ?? '';
                    const deficit = (row.item?.reorderLevel ?? 0) - row.quantity;
                    return (
                      <tr key={row._id} className="border-b border-border last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-3 font-medium text-foreground">{row.item?.name}</td>
                        <td className="py-2 pr-3 font-mono text-secondary hidden sm:table-cell">{row.item?.sku}</td>
                        <td className="py-2 pr-3 hidden md:table-cell">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeBadge[itemType] ?? 'bg-slate-100 text-slate-600'}`}>
                            {typeLabel[itemType] ?? itemType}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-bold text-red-600">{formatNumber(row.quantity, 0)}</td>
                        <td className="py-2 text-right">
                          <span className="text-secondary">{formatNumber(row.item?.reorderLevel ?? 0, 0)}</span>
                          {deficit > 0 && (
                            <span className="ml-1 text-[10px] text-red-400">(-{formatNumber(deficit, 0)})</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
