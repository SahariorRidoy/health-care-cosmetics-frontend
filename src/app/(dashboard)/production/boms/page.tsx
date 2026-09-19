'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Eye } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, StatusBadge } from '@/components/feedback';
import { useGetBOMsQuery } from '@/features/production/services/productionApi';
import type { BOM } from '@/features/production/types';

export default function BOMsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useGetBOMsQuery({
    page,
    search: search || undefined,
  });

  const columns: Column<BOM>[] = [
    {
      key: 'product', header: 'Product', priority: 'P1',
      render: (row) => {
        const p = typeof row.product === 'string' ? null : row.product as { name: string; sku: string };
        return <span className="font-medium">{p?.name ?? '—'}</span>;
      },
    },
    { key: 'version', header: 'Version', priority: 'P2' },
    {
      key: 'expectedOutputQty', header: 'Output Qty', priority: 'P2',
      render: (row) => {
        const uom = typeof row.outputUom === 'string' ? '' : (row.outputUom as { symbol: string }).symbol;
        return `${row.expectedOutputQty} ${uom}`;
      },
    },
    {
      key: 'wastagePercent', header: 'Wastage %', priority: 'P3',
      render: (row) => `${row.wastagePercent}%`,
    },
    {
      key: 'inputMaterials', header: 'Materials', priority: 'P3',
      render: (row) => `${row.inputMaterials.length} item(s)`,
    },
    {
      key: 'isActive', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[60px] text-right',
      render: (row) => (
        <button
          onClick={() => router.push(`/production/boms/${row._id}`)}
          className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
          aria-label="View BOM"
          title="View"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bill of Materials"
        description="Define product recipes and input materials"
        breadcrumbs={[{ label: 'Production' }, { label: 'BOMs' }]}
        actions={
          <button
            onClick={() => router.push('/production/boms/new')}
            className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> New BOM
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search product…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald"
          />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : data?.data?.boms?.length === 0 && !isLoading ? (
        <EmptyState
          title="No BOMs found"
          description="Create your first Bill of Materials."
          action={
            <button
              onClick={() => router.push('/production/boms/new')}
              className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} aria-hidden="true" /> New BOM
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data?.boms ?? []}
          keyField="_id"
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
