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

function KpiCard({ label, value, sub, icon: Icon, color, href, trend }: KpiItem) {
  const c = colorMap[color];
  const inner = (
    <div className="bg-white rounded-xl border border-border p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={22} className={c.icon} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {trend.label}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-sm text-muted mt-1">{sub}</p>
      <div className={`mt-4 h-0.5 w-12 ${c.bar} rounded-full opacity-60 group-hover:w-full transition-all duration-500`} />
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>;
}

export interface DashboardKpiRowProps {
  totalRevenue: number;
  totalOrders: number;
  totalExpenses: number;
  expenseCount: number;
  payables: number;
  supplierCount: number;
  receivables: number;
  customerCount: number;
  netProfit: number;
  inProgress: number;
  lowStockCount: number;
  totalEmployees: number;
}

export function DashboardKpiRow({
  totalRevenue, totalOrders, totalExpenses, expenseCount,
  payables, supplierCount, receivables, customerCount,
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
      label: 'Customer Receivables',
      value: formatCurrency(receivables),
      sub: `${customerCount} customers`,
      icon: DollarSign,
      color: 'blue',
      href: '/sales/customers',
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

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}
