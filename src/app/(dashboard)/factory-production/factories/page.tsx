'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Warehouse, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState, StatusBadge } from '@/components/feedback';
import { formatDate } from '@/lib/formatters';
import { useGetFactoryBatchesQuery } from '@/features/factory-production/services/factoryProductionApi';
import { AddReceiptDialogLoader } from '@/features/factory-production/components/AddReceiptDialogLoader';
import type { FactoryBatch } from '@/features/factory-production/types';

const RECEIPT_STATUSES = ['DISPATCHED', 'IN_PRODUCTION', 'PARTIALLY_RECEIVED'];

export default function FactoryLedgerPage() {
  const router = useRouter();
  const [receiptBatchId, setReceiptBatchId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useGetFactoryBatchesQuery({ page: 1 });

  if (isError) return (
    <>
      <PageHeader title="Factory Ledger" description="Material stock at factory" breadcrumbs={[{ label: 'Factory Production', href: '/factory-production' }, { label: 'Factory Ledger' }]} />
      <ErrorState onRetry={refetch} />
    </>
  );

  const batches: FactoryBatch[] = data?.data?.factoryBatches ?? [];
  const activeBatches = batches.filter((b) => !['COMPLETED', 'CANCELLED'].includes(b.status));

  return (
    <>
      <PageHeader
        title="Factory Ledger"
        description="Material stock currently at factory"
        breadcrumbs={[{ label: 'Factory Production', href: '/factory-production' }, { label: 'Factory Ledger' }]}
      />

      {isLoading ? (
        <div className="bg-white rounded-lg border border-border divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-4 animate-pulse flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          {/* Factory header */}
          <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
              <Warehouse size={18} className="text-navy" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Our Factory</p>
              <p className="text-xs text-secondary mt-0.5">
                {batches.length} batch{batches.length !== 1 ? 'es' : ''} total
                {activeBatches.length > 0 && <span className="ml-2 text-amber-600 font-medium">· {activeBatches.length} active</span>}
              </p>
            </div>
            {activeBatches.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                {activeBatches.length} active
              </span>
            )}
          </div>

          {/* Active batches */}
          {activeBatches.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-secondary">No active batches at factory.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeBatches.map((b) => (
                <div key={b._id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-foreground">{b.fbNumber}</span>
                    <span className="text-sm text-foreground">{b.batchName}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {b.dispatch.dispatchedDate && (
                      <span className="text-xs text-secondary hidden sm:block">Dispatched: {formatDate(b.dispatch.dispatchedDate)}</span>
                    )}
                    {RECEIPT_STATUSES.includes(b.status) && (
                      <button
                        onClick={() => setReceiptBatchId(b._id)}
                        className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                        aria-label="Add receipt"
                      >
                        <ClipboardList size={15} /> Add Receipt
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/factory-production/${b._id}`)}
                      className="p-1.5 rounded-md text-secondary hover:bg-slate-100 flex items-center justify-center"
                      aria-label="View batch"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {receiptBatchId && (
        <AddReceiptDialogLoader batchId={receiptBatchId} onClose={() => setReceiptBatchId(null)} />
      )}
    </>
  );
}
