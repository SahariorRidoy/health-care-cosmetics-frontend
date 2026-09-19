'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { useGetStockBalanceReportQuery } from '@/features/reports/services/reportsApi';
import type { StockBalanceRow } from '@/features/reports/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export default function StockReportPage() {
  const [page, setPage] = useState(1);
  const [lowStock, setLowStock] = useState(false);

  const { data, isLoading, isError, refetch } = useGetStockBalanceReportQuery({
    page,
    lowStock: lowStock || undefined,
  });

  const csvUrl = `${API_URL}/reports/stock/balance?format=csv${lowStock ? '&lowStock=true' : ''}`;

  const columns: Column<StockBalanceRow>[] = [
    {
      key: 'sku', header: 'SKU', priority: 'P2',
      render: (row) => <span className="font-mono text-[13px]">{row.item?.sku}</span>,
    },
    {
      key: 'name', header: 'Item', priority: 'P1',
      render: (row) => <span className="font-medium">{row.item?.name}</span>,
    },
    {
      key: 'category', header: 'Category', priority: 'P3',
      render: (row) => row.item?.category ?? '—',
    },
    {
      key: 'warehouse', header: 'Warehouse', priority: 'P3',
      render: (row) => row.warehouse?.name ?? '—',
    },
    {
      key: 'quantity', header: 'Qty', priority: 'P1',
      render: (row) => formatNumber(row.quantity, 0),
    },
    {
      key: 'reorderLevel', header: 'Reorder Level', priority: 'P2',
      render: (row) => formatNumber(row.item?.reorderLevel ?? 0, 0),
    },
    {
      key: 'valuation', header: 'Valuation', priority: 'P2',
      render: (row) => formatCurrency(row.valuation),
    },
    {
      key: 'isLowStock', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.isLowStock ? 'OVERDUE' : 'ACTIVE'} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock Report"
        description="Current stock balance and valuation"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Stock' }]}
        actions={
          <a
            href={csvUrl}
            download
            className="h-9 px-4 rounded-md border border-border bg-white text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => { setLowStock(e.target.checked); setPage(1); }}
            className="rounded border-border text-emerald focus:ring-emerald"
          />
          Low stock only
        </label>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.balances?.length === 0 && !isLoading ? (
        <EmptyState title="No stock data" description="No stock balance records found." />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.balances ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
