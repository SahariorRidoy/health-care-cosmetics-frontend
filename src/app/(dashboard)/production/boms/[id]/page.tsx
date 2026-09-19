'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState, LoadingSpinner, StatusBadge } from '@/components/feedback';
import { useGetBOMQuery } from '@/features/production/services/productionApi';
import type { BOMInput } from '@/features/production/types';

export default function BOMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useGetBOMQuery(id);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const bom = data?.data?.bom;
  if (!bom) return <ErrorState title="BOM not found" />;

  const product = typeof bom.product === 'string' ? { name: bom.product, sku: '' } : bom.product as { name: string; sku: string };
  const outputUom = typeof bom.outputUom === 'string' ? bom.outputUom : (bom.outputUom as { symbol: string }).symbol;

  return (
    <>
      <PageHeader
        title={`BOM — ${product.name}`}
        description={`Version: ${bom.version}`}
        breadcrumbs={[
          { label: 'Production' },
          { label: 'BOMs', href: '/production/boms' },
          { label: product.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/production/boms')}
              className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-border p-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">Product</p>
          <p className="text-sm font-semibold text-foreground">{product.name}</p>
          <p className="text-xs text-secondary">{product.sku}</p>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">Expected Output</p>
          <p className="text-sm font-semibold text-foreground">{bom.expectedOutputQty} {outputUom}</p>
          <p className="text-xs text-secondary">Wastage: {bom.wastagePercent}%</p>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">Status</p>
          <StatusBadge status={bom.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </div>
      </div>

      {/* Input materials table */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Input Materials</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wide">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">UOM</th>
              </tr>
            </thead>
            <tbody>
              {bom.inputMaterials.map((mat: BOMInput, i: number) => {
                const item = typeof mat.item === 'string' ? { name: mat.item, sku: '' } : mat.item as { name: string; sku: string };
                const uom = typeof mat.uom === 'string' ? mat.uom : (mat.uom as { symbol: string }).symbol;
                return (
                  <tr key={i} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-secondary">{item.sku}</td>
                    <td className="px-4 py-3 text-right text-foreground">{mat.qty}</td>
                    <td className="px-4 py-3 text-secondary">{uom}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {bom.notes && (
        <div className="mt-4 bg-white rounded-lg border border-border p-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-foreground">{bom.notes}</p>
        </div>
      )}
    </>
  );
}
