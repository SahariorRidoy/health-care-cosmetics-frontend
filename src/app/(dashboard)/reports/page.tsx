'use client';

import Link from 'next/link';
import { Package, Factory, TrendingUp, ShoppingCart, DollarSign, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const REPORT_LINKS = [
  { href: '/reports/stock', label: 'Stock Report', description: 'Balance, valuation, low-stock alerts', icon: Package },
  { href: '/reports/production', label: 'Production Report', description: 'Orders, output, wastage summary', icon: Factory },
  { href: '/reports/sales', label: 'Sales Report', description: 'Orders, invoices, payment status', icon: TrendingUp },
  { href: '/reports/purchase', label: 'Purchase Report', description: 'POs, receipts, supplier dues', icon: ShoppingCart },
  { href: '/reports/finance', label: 'Finance Report', description: 'Expenses by category and period', icon: DollarSign },
  { href: '/reports/hr', label: 'HR Report', description: 'Employees, attendance, payroll', icon: Users },
];

export default function ReportsIndexPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Cross-module reports with CSV export"
        breadcrumbs={[{ label: 'Reports' }]}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-lg border border-border p-5 hover:border-emerald hover:shadow-sm transition-all flex items-start gap-4"
          >
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald shrink-0">
              <Icon size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
