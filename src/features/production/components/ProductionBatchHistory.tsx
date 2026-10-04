'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, DollarSign, Calendar, Warehouse } from 'lucide-react';
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
    <section className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-slate-50/60 flex items-center gap-2">
        <Package size={14} className="text-amber-600" />
        <h2 className="text-sm font-semibold text-foreground">Production Batch History</h2>
        {data?.pagination && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted bg-slate-100 px-2 py-0.5 rounded-full">
            {data.pagination.total} batch{data.pagination.total !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="px-5 py-10 text-center text-sm text-muted">Loading production batches…</div>
      ) : isError ? (
        <div className="p-5"><ErrorState onRetry={refetch} /></div>
      ) : batches.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted">No production batches recorded.</div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {batches.map((batch) => {
              const warehouse = typeof batch.warehouse === 'string' ? batch.warehouse : batch.warehouse?.name;
              const order = typeof batch.productionOrder === 'string' ? batch.productionOrder : batch.productionOrder?.woNumber;
              const outputUnit = batch.outputUomSymbol || outputUomSymbol;

              return (
                <details key={batch._id} className="group">
                  <summary className="list-none cursor-pointer px-5 py-4 hover:bg-slate-50/70 transition-colors">
                    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_1fr_1fr_1fr_28px] gap-x-4 gap-y-2 items-center">
                      {/* Batch number */}
                      <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 shrink-0">
                        <Package size={14} className="text-amber-600" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground font-mono">{batch.batchNumber}</p>
                        <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(batch.manufacturedDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted font-medium">Qty Produced</p>
                        <p className="text-sm font-bold text-foreground">{batch.quantityProduced} {outputUnit}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted font-medium">Total Cost</p>
                        <p className="text-sm font-bold text-violet-600">{formatCurrency(batch.totalProductionCost)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted font-medium">Cost / {outputUnit || 'unit'}</p>
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(batch.costPerUnit)}</p>
                      </div>

                      <span className="flex items-center justify-center text-muted">
                        <ChevronRight size={16} className="group-open:hidden" />
                        <ChevronDown size={16} className="hidden group-open:block" />
                      </span>

                      {/* Sub-row info */}
                      <div className="sm:col-start-2 sm:col-span-4 flex flex-wrap gap-2 mt-1">
                        {warehouse && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            <Warehouse size={9} /> {warehouse}
                          </span>
                        )}
                        {order && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                            {order}
                          </span>
                        )}
                      </div>
                    </div>
                  </summary>

                  {/* Expanded detail */}
                  <div className="px-5 pb-5 bg-slate-50/40 border-t border-border">
                    {/* Cost breakdown chips */}
                    <div className="flex flex-wrap gap-3 py-4">
                      <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 shadow-sm">
                        <DollarSign size={13} className="text-violet-500" />
                        <div>
                          <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Material Cost</p>
                          <p className="text-sm font-bold text-foreground">{formatCurrency(batch.costOfMaterials)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 shadow-sm">
                        <DollarSign size={13} className="text-emerald-500" />
                        <div>
                          <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Total Production Cost</p>
                          <p className="text-sm font-bold text-violet-600">{formatCurrency(batch.totalProductionCost)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 shadow-sm">
                        <Package size={13} className="text-amber-500" />
                        <div>
                          <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Product</p>
                          <p className="text-sm font-semibold text-foreground">{displayProduct(batch)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Materials table */}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[600px] text-[13px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-border">
                            {['Material', 'Used Qty', 'Base Qty', 'Rate at Production', 'Material Cost'].map((heading) => (
                              <th key={heading} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {batch.materialsUsed.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">No material details stored for this batch.</td></tr>
                          ) : batch.materialsUsed.map((material, index) => (
                            <tr key={`${batch._id}-${index}`} className="border-b border-border last:border-0 hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-foreground">{material.itemName}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-foreground px-2 py-0.5 rounded text-xs font-medium">
                                  {material.qtyUsed} <span className="text-muted">{material.uomSymbol ?? ''}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-secondary">
                                {material.baseQtyUsed != null ? (
                                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                                    {material.baseQtyUsed} {material.baseUomSymbol ?? ''}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-secondary font-medium">
                                {formatCurrency(material.costAtTime)} / {material.baseUomSymbol || 'base unit'}
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">
                                {material.lineCost != null ? formatCurrency(material.lineCost) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {batch.notes && (
                      <p className="mt-3 text-sm text-secondary bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <span className="font-semibold text-amber-700">Notes: </span>{batch.notes}
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-slate-50/40">
              <span className="text-xs text-muted font-medium">Page {data.pagination.page} of {data.pagination.pages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((c) => c - 1)} className="h-8 px-3 rounded-lg border border-border text-sm font-medium disabled:opacity-40 hover:bg-white transition-colors">
                  Previous
                </button>
                <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((c) => c + 1)} className="h-8 px-3 rounded-lg border border-border text-sm font-medium disabled:opacity-40 hover:bg-white transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
