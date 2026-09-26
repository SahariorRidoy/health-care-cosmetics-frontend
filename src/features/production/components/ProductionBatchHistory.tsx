'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ErrorState } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetProductionBatchesQuery } from '@/features/production/services/productionApi';

function displayProduct(batch: { productName?: string; productSku?: string; product: { name: string; sku: string } | string }) {
  if (batch.productName || batch.productSku) return `${batch.productName ?? ''} ${batch.productSku ? `(${batch.productSku})` : ''}`.trim();
  return typeof batch.product === 'string' ? batch.product : `${batch.product.name} (${batch.product.sku})`;
}

export function ProductionBatchHistory({ productId, outputUomSymbol = '' }: { productId: string; outputUomSymbol?: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useGetProductionBatchesQuery({ product: productId, page, limit: 10 });
  const batches = data?.data.batches ?? [];

  return (
    <section className="bg-white rounded-lg border border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Production Batch History</h2>
        {data?.pagination && <span className="text-xs text-secondary">{data.pagination.total} batches</span>}
      </div>

      {isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-muted">Loading production batches…</p>
      ) : isError ? (
        <div className="p-4"><ErrorState onRetry={refetch} /></div>
      ) : batches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No production batches recorded.</p>
      ) : (
        <>
          <div className="divide-y divide-border">
            {batches.map((batch) => {
              const warehouse = typeof batch.warehouse === 'string' ? batch.warehouse : batch.warehouse?.name;
              const order = typeof batch.productionOrder === 'string' ? batch.productionOrder : batch.productionOrder?.woNumber;
              const outputUnit = batch.outputUomSymbol || outputUomSymbol;

              return (
                <details key={batch._id} className="group">
                  <summary className="list-none cursor-pointer px-4 py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_1fr_1fr_24px] gap-x-4 gap-y-1 items-center hover:bg-slate-50">
                    <span className="font-mono text-xs font-semibold text-foreground">{batch.batchNumber}</span>
                    <span className="text-xs text-secondary">{formatDate(batch.manufacturedDate)}</span>
                    <span className="text-sm text-foreground">{batch.quantityProduced} {outputUnit}</span>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(batch.totalProductionCost)}</span>
                    <span className="hidden sm:flex items-center justify-center text-secondary">
                      <ChevronRight size={16} className="group-open:hidden" />
                      <ChevronDown size={16} className="hidden group-open:block" />
                    </span>
                    <span className="sm:col-start-2 text-xs text-secondary">
                      {formatCurrency(batch.costPerUnit)} / {outputUnit || 'unit'}
                    </span>
                    <span className="sm:col-start-3 sm:col-span-2 text-xs text-secondary">
                      {warehouse ? `Warehouse: ${warehouse}` : displayProduct(batch)}
                      {order ? ` · ${order}` : ''}
                    </span>
                    <span className="sm:hidden flex items-center justify-center text-secondary">
                      <ChevronRight size={16} className="group-open:hidden" />
                      <ChevronDown size={16} className="hidden group-open:block" />
                    </span>
                  </summary>

                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border py-3 text-xs">
                      <p><span className="text-secondary">Material cost: </span><span className="font-semibold text-foreground">{formatCurrency(batch.costOfMaterials)}</span></p>
                      <p><span className="text-secondary">Total production cost: </span><span className="font-semibold text-foreground">{formatCurrency(batch.totalProductionCost)}</span></p>
                      <p><span className="text-secondary">Product: </span><span className="font-medium text-foreground">{displayProduct(batch)}</span></p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] text-[13px]">
                        <thead>
                          <tr className="border-b border-border bg-slate-50">
                            {['Material', 'Used quantity', 'Base quantity', 'Rate at production', 'Material cost'].map((heading) => (
                              <th key={heading} className="px-3 py-2 text-left text-xs font-medium text-secondary">{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {batch.materialsUsed.length === 0 ? (
                            <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-muted">No material details stored for this batch.</td></tr>
                          ) : batch.materialsUsed.map((material, index) => (
                            <tr key={`${batch._id}-${index}`} className="border-b border-border last:border-0">
                              <td className="px-3 py-2 font-medium text-foreground">{material.itemName}</td>
                              <td className="px-3 py-2 text-foreground">{material.qtyUsed} {material.uomSymbol ?? ''}</td>
                              <td className="px-3 py-2 text-secondary">
                                {material.baseQtyUsed != null ? `${material.baseQtyUsed} ${material.baseUomSymbol ?? ''}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-secondary">
                                {formatCurrency(material.costAtTime)} / {material.baseUomSymbol || 'base unit'}
                              </td>
                              <td className="px-3 py-2 font-medium text-foreground">
                                {material.lineCost != null ? formatCurrency(material.lineCost) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {batch.notes && <p className="mt-3 text-sm text-secondary">Notes: {batch.notes}</p>}
                  </div>
                </details>
              );
            })}
          </div>
          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-secondary">Page {data.pagination.page} of {data.pagination.pages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="h-9 px-3 rounded-md border border-border text-sm disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((current) => current + 1)} className="h-9 px-3 rounded-md border border-border text-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}