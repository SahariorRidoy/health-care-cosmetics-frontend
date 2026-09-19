'use client';

import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Package, Factory,
  AlertTriangle, DollarSign, Users, ShoppingCart,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { useGetFinanceSummaryQuery } from '@/features/finance/services/financeApi';
import { useGetSalesSummaryQuery, useGetProductionSummaryQuery, useGetStockBalanceReportQuery } from '@/features/reports/services/reportsApi';

function KpiCard({
  label, value, sub, icon: Icon, iconClass, href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconClass: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-lg border border-border p-5 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</p>
        <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 truncate">{value}</p>
        {sub && <p className="text-xs text-muted mt-1 truncate">{sub}</p>}
      </div>
      <div className={`p-2 rounded-lg shrink-0 ${iconClass}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

export default function DashboardPage() {
  const { data: finData, isLoading: finLoading } = useGetFinanceSummaryQuery({});
  const { data: salesData, isLoading: salesLoading } = useGetSalesSummaryQuery({});
  const { data: prodData, isLoading: prodLoading } = useGetProductionSummaryQuery({});
  const { data: stockData, isLoading: stockLoading } = useGetStockBalanceReportQuery({ lowStock: true, page: 1 });

  const fin = finData?.data;
  const sales = salesData?.data;
  const prod = prodData?.data;
  const lowStockItems = stockData?.data?.balances ?? [];

  const totalRevenue = sales?.orderSummary.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalOrders = sales?.orderSummary.reduce((s, r) => s + r.count, 0) ?? 0;
  const prodSummary = prod?.summary ?? [];
  const totalProduced = prodSummary.reduce((s, r) => s + r.totalOutput, 0);
  const inProgress = prodSummary.find((r) => r._id === 'IN_PROGRESS')?.count ?? 0;

  const isLoading = finLoading || salesLoading || prodLoading || stockLoading;

  if (isLoading) return <LoadingSpinner />;

  return (
    <>
      <PageHeader title="Dashboard" description="Health Care Cosmetics Ltd. — ERP Overview" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          sub={`${totalOrders} sales orders`}
          icon={TrendingUp}
          iconClass="bg-emerald-50 text-emerald-600"
          href="/reports/sales"
        />
        <KpiCard
          label="Total Expenses"
          value={formatCurrency(fin?.expenses.total ?? 0)}
          sub={`${(fin?.expenses.paid.count ?? 0) + (fin?.expenses.pending.count ?? 0)} records`}
          icon={TrendingDown}
          iconClass="bg-red-50 text-red-500"
          href="/finance/expenses"
        />
        <KpiCard
          label="Supplier Payables"
          value={formatCurrency(fin?.payables.total ?? 0)}
          sub={`${fin?.payables.supplierCount ?? 0} suppliers`}
          icon={ShoppingCart}
          iconClass="bg-orange-50 text-orange-500"
          href="/procurement/suppliers"
        />
        <KpiCard
          label="Customer Receivables"
          value={formatCurrency(fin?.receivables.total ?? 0)}
          sub={`${fin?.receivables.customerCount ?? 0} customers`}
          icon={DollarSign}
          iconClass="bg-blue-50 text-blue-500"
          href="/sales/customers"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Production Status */}
        <div className="bg-white rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Factory size={16} className="text-secondary" aria-hidden="true" /> Production
            </h2>
            <Link href="/reports/production" className="text-xs text-emerald hover:underline">View report</Link>
          </div>
          <div className="space-y-3">
            {prodSummary.length === 0 ? (
              <p className="text-sm text-muted">No production data.</p>
            ) : (
              prodSummary.map((row) => (
                <div key={row._id} className="flex items-center justify-between text-sm">
                  <StatusBadge status={row._id} />
                  <span className="text-secondary">{row.count} orders</span>
                </div>
              ))
            )}
            {totalProduced > 0 && (
              <div className="pt-2 border-t border-border text-sm flex justify-between">
                <span className="text-secondary">Total Output</span>
                <span className="font-medium text-foreground">{formatNumber(totalProduced, 0)} units</span>
              </div>
            )}
            {inProgress > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                <AlertTriangle size={13} aria-hidden="true" />
                {inProgress} order{inProgress > 1 ? 's' : ''} in progress
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-secondary" aria-hidden="true" /> Top Products
            </h2>
            <Link href="/reports/sales" className="text-xs text-emerald hover:underline">View report</Link>
          </div>
          {!sales?.topProducts?.length ? (
            <p className="text-sm text-muted">No sales data.</p>
          ) : (
            <div className="space-y-2">
              {sales.topProducts.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate max-w-[60%]">{p.itemName}</span>
                  <span className="text-secondary shrink-0">{formatCurrency(p.totalRevenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses by Category */}
        <div className="bg-white rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign size={16} className="text-secondary" aria-hidden="true" /> Expenses
            </h2>
            <Link href="/finance/summary" className="text-xs text-emerald hover:underline">View summary</Link>
          </div>
          {!fin?.expenses.byCategory?.length ? (
            <p className="text-sm text-muted">No expense data.</p>
          ) : (
            <div className="space-y-2">
              {fin.expenses.byCategory.slice(0, 5).map((c) => (
                <div key={c._id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate max-w-[60%]">{c.categoryName}</span>
                  <span className="text-secondary shrink-0">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package size={16} className="text-secondary" aria-hidden="true" /> Low Stock Alerts
            {lowStockItems.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                {lowStockItems.length}
              </span>
            )}
          </h2>
          <Link href="/reports/stock" className="text-xs text-emerald hover:underline">View stock report</Link>
        </div>
        {lowStockItems.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald">
            <Users size={15} aria-hidden="true" />
            All items are above reorder level.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-secondary uppercase tracking-wide">Item</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-secondary uppercase tracking-wide hidden sm:table-cell">SKU</th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-secondary uppercase tracking-wide">Stock</th>
                  <th className="text-right py-2 text-xs font-medium text-secondary uppercase tracking-wide">Reorder</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.slice(0, 10).map((row) => (
                  <tr key={row._id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-foreground">{row.item?.name}</td>
                    <td className="py-2 pr-4 font-mono text-[13px] text-secondary hidden sm:table-cell">{row.item?.sku}</td>
                    <td className="py-2 pr-4 text-right text-red-600 font-medium">{formatNumber(row.quantity, 0)}</td>
                    <td className="py-2 text-right text-secondary">{formatNumber(row.item?.reorderLevel ?? 0, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
