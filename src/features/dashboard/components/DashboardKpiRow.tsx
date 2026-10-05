'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Factory, Package, Users, Wallet } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';

type Color = 'emerald' | 'red' | 'orange' | 'blue' | 'violet' | 'amber' | 'cyan';

interface KpiItem {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: Color;
  href?: string;
  trend?: { label: string; positive: boolean };
}

const colorMap: Record<Color, { bg: string; icon: string; bar: string }> = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', bar: 'bg-emerald-500' },
  red:     { bg: 'bg-red-50',     icon: 'text-red-500',     bar: 'bg-red-500'     },
  orange:  { bg: 'bg-orange-50',  icon: 'text-orange-500',  bar: 'bg-orange-500'  },
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-500',    bar: 'bg-blue-500'    },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-500',  bar: 'bg-violet-500'  },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   bar: 'bg-amber-500'   },
  cyan:    { bg: 'bg-cyan-50',    icon: 'text-cyan-600',    bar: 'bg-cyan-500'    },
};

function KpiCard({ label, value, sub, icon: _Icon, color, href, trend, large }: KpiItem & { large?: boolean }) {
  const c = colorMap[color];
  const inner = (
    <div className={`bg-white rounded-xl border border-border hover:shadow-md hover:border-slate-300 transition-all duration-200 group h-full flex flex-col ${large ? 'p-8' : 'p-6'}`}>
      <div className="flex items-start justify-between mb-4 min-h-[28px]">
        {trend && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {trend.label}
          </span>
        )}
      </div>
      <p className={`font-semibold text-secondary uppercase tracking-wider mb-1 ${large ? 'text-sm' : 'text-xs'}`}>{label}</p>
      <p className={`font-bold text-foreground leading-tight ${large ? 'text-4xl mt-2' : 'text-2xl'}`}>{value}</p>
      {!large && <p className="text-sm text-muted mt-1">{sub}</p>}
      <div className={`mt-auto pt-4 h-0.5 w-12 ${c.bar} rounded-full opacity-60 group-hover:w-full transition-all duration-500`} />
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
}

export interface DashboardKpiRowProps {
  totalRevenue: number;
  totalOrders: number;
  totalExpenses: number;
  expenseCount: number;
  payables: number;
  supplierCount: number;
  commission: number;
  dealerCount: number;
  netProfit: number;
  inProgress: number;
  lowStockCount: number;
  totalEmployees: number;
}

export function DashboardKpiRow({
  totalRevenue, totalOrders, totalExpenses, expenseCount,
  payables, supplierCount, commission, dealerCount,
  netProfit, inProgress, lowStockCount, totalEmployees,
}: DashboardKpiRowProps) {
  const netPositive = netProfit >= 0;

  const items: KpiItem[] = [
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      sub: `${totalOrders} sales orders`,
      icon: TrendingUp,
      color: 'emerald',
      href: '/reports/sales',
      trend: { label: 'This period', positive: true },
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      sub: `${expenseCount} expense records`,
      icon: TrendingDown,
      color: 'red',
      href: '/finance/expenses',
    },
    {
      label: 'Net Profit / Loss',
      value: formatCurrency(Math.abs(netProfit)),
      sub: netPositive ? 'Surplus this period' : 'Deficit this period',
      icon: Wallet,
      color: netPositive ? 'cyan' : 'red',
      trend: { label: netPositive ? 'Profit' : 'Loss', positive: netPositive },
    },
    {
      label: 'Supplier Payables',
      value: formatCurrency(payables),
      sub: `${supplierCount} active suppliers`,
      icon: ShoppingCart,
      color: 'orange',
      href: '/procurement/suppliers',
    },
    {
      label: 'Dealer Commission',
      value: formatCurrency(commission),
      sub: `${dealerCount} dealers`,
      icon: DollarSign,
      color: 'blue',
      href: '/sales/dealers',
    },
    {
      label: 'Active Work Orders',
      value: formatNumber(inProgress, 0),
      sub: 'production in progress',
      icon: Factory,
      color: 'violet',
      href: '/production',
      trend: inProgress > 0 ? { label: 'In progress', positive: true } : undefined,
    },
    {
      label: 'Low Stock Alerts',
      value: formatNumber(lowStockCount, 0),
      sub: 'items below reorder level',
      icon: Package,
      color: lowStockCount > 0 ? 'amber' : 'emerald',
      href: '/reports/stock',
      trend: lowStockCount > 0 ? { label: 'Needs attention', positive: false } : { label: 'All good', positive: true },
    },
    {
      label: 'Total Employees',
      value: formatNumber(totalEmployees, 0),
      sub: 'active workforce',
      icon: Users,
      color: 'cyan',
      href: '/hr/employees',
    },
  ];

  const [revenue, expenses, netProfitLoss, ...rest] = items;
  const rightCards = [expenses, ...rest];

  return (
    <div className="flex gap-4 mb-8">
      {/* Left: 1/3 width — Revenue & Net Profit/Loss stacked */}
      <div className="flex flex-col gap-4 w-1/3">
        <KpiCard {...revenue} large />
        <KpiCard {...netProfitLoss} large />
      </div>
      {/* Right: 2/3 width — 6 cards in 3x2 grid */}
      <div className="grid grid-cols-3 grid-rows-2 gap-4 w-2/3">
        {rightCards.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}
