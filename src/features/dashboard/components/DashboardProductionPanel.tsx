'use client';

import Link from 'next/link';
import { Factory, AlertTriangle, CheckCircle2, Clock, XCircle, Layers, Gauge, Recycle } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { StatusBadge } from '@/components/feedback';
import type { ProductionSummaryItem } from '@/features/reports/types';

interface Props {
  prodSummary: ProductionSummaryItem[];
  totalProduced: number;
  totalWastage: number;
}

const statusIcon: Record<string, React.ElementType> = {
  COMPLETED: CheckCircle2,
  IN_PROGRESS: Clock,
  CANCELLED: XCircle,
  PLANNED: Layers,
};

const statusBarColor: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  IN_PROGRESS: 'bg-blue-500',
  CANCELLED: 'bg-red-400',
  PLANNED: 'bg-slate-400',
};

export function DashboardProductionPanel({ prodSummary, totalProduced, totalWastage }: Props) {
  const totalOrders = prodSummary.reduce((s, r) => s + r.count, 0);
  const inProgress = prodSummary.find((r) => r._id === 'IN_PROGRESS')?.count ?? 0;
  const completed = prodSummary.find((r) => r._id === 'COMPLETED')?.count ?? 0;
  const planned = prodSummary.find((r) => r._id === 'PLANNED')?.count ?? 0;
  const efficiencyPct = totalProduced + totalWastage > 0
    ? Math.round((totalProduced / (totalProduced + totalWastage)) * 100)
    : 0;
  const effColor = efficiencyPct >= 90 ? 'text-emerald-600' : efficiencyPct >= 70 ? 'text-amber-600' : 'text-red-500';
  const effBarColor = efficiencyPct >= 90 ? 'bg-emerald-500' : efficiencyPct >= 70 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-violet-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm">
            <Factory size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Production Overview</h2>
            <p className="text-[11px] text-secondary">Orders, output & efficiency metrics</p>
          </div>
        </div>
        <Link href="/reports/production" className="text-xs text-violet-600 hover:underline font-semibold">
          View report →
        </Link>
      </div>

      <div className="p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatNumber(totalOrders, 0)}</p>
            <p className="text-[11px] text-secondary uppercase tracking-wide mt-0.5">Total Orders</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{formatNumber(inProgress, 0)}</p>
            <p className="text-[11px] text-blue-500 uppercase tracking-wide mt-0.5">In Progress</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{formatNumber(completed, 0)}</p>
            <p className="text-[11px] text-emerald-500 uppercase tracking-wide mt-0.5">Completed</p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{formatNumber(planned, 0)}</p>
            <p className="text-[11px] text-violet-500 uppercase tracking-wide mt-0.5">Planned</p>
          </div>
        </div>

        {/* 3-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Breakdown */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">Status Breakdown</p>
            {prodSummary.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No production data.</p>
            ) : (
              <div className="space-y-3">
                {prodSummary.map((row) => {
                  const Icon = statusIcon[row._id] ?? Layers;
                  const barColor = statusBarColor[row._id] ?? 'bg-slate-400';
                  const pct = totalOrders > 0 ? Math.round((row.count / totalOrders) * 100) : 0;
                  return (
                    <div key={row._id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} className="text-secondary" />
                          <StatusBadge status={row._id} />
                        </div>
                        <span className="text-secondary">{row.count} orders ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Output Metrics */}
          <div>
            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">Output Metrics</p>
            {totalProduced === 0 ? (
              <p className="text-xs text-muted">No output data.</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-1">Total Output</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatNumber(totalProduced, 0)}</p>
                  <p className="text-[10px] text-emerald-500">units produced</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Recycle size={12} className="text-red-500" />
                    <p className="text-[10px] text-red-600 uppercase tracking-wide font-semibold">Total Wastage</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{formatNumber(totalWastage, 0)}</p>
                  <p className="text-[10px] text-red-400">units wasted</p>
                </div>
              </div>
            )}
          </div>

          {/* Efficiency */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Gauge size={12} className="text-secondary" />
              <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Efficiency</p>
            </div>
            {totalProduced === 0 ? (
              <p className="text-xs text-muted">No efficiency data.</p>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className={`text-5xl font-black ${effColor}`}>{efficiencyPct}%</p>
                  <p className="text-xs text-secondary mt-1">Production Efficiency</p>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${effBarColor}`} style={{ width: `${efficiencyPct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-semibold text-foreground">{formatNumber(totalProduced, 0)}</p>
                    <p className="text-muted">Produced</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-semibold text-foreground">{formatNumber(totalWastage, 0)}</p>
                    <p className="text-muted">Wasted</p>
                  </div>
                </div>
                {inProgress > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} />
                    {inProgress} order{inProgress > 1 ? 's' : ''} in progress
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
