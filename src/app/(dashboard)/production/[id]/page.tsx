'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetProductQuery } from '@/features/products/services/productsApi';
import { useGetStockBalancesQuery, useGetStockMovementsQuery } from '@/features/inventory/services/inventoryApi';
import { useGetUOMConversionsQuery } from '@/features/settings/services/settingsApi';
import { ProductionFormDialog } from '@/features/production/components/ProductionFormDialog';
import type { StockBalance, StockMovement } from '@/features/inventory/types';
import type { ProductMaterial } from '@/features/products/types';
import type { UOMConversion } from '@/features/settings/types';

function resolveConversionFactor(usageUomId: string, baseUomId: string, conversions: UOMConversion[]): number {
  if (!usageUomId || !baseUomId || usageUomId === baseUomId) return 1;
  const direct = conversions.find((c) => c.fromUOM._id === usageUomId && c.toUOM._id === baseUomId);
  if (direct) return direct.factor;
  const reverse = conversions.find((c) => c.fromUOM._id === baseUomId && c.toUOM._id === usageUomId);
  if (reverse) return 1 / reverse.factor;
  return 1;
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PRODUCTION_OUTPUT: 'Production Output',
  PRODUCTION_ISSUE: 'Material Consumed',
  SALES_DISPATCH: 'Sales Dispatch',
  ADJUSTMENT: 'Adjustment',
};

export default function ProductionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetProductQuery(id);
  const { data: stockData } = useGetStockBalancesQuery({ item: id });
  const { data: movementsData } = useGetStockMovementsQuery({ item: id });
  const { data: convData } = useGetUOMConversionsQuery();

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data?.data?.item) return <ErrorState onRetry={refetch} />;

  const product = data.data.item;
  const uomSymbol = typeof product.baseUom === 'object' ? product.baseUom.symbol : '';
  const balances = (stockData?.data?.balances ?? []) as StockBalance[];
  const movements = (movementsData?.data?.movements ?? []) as StockMovement[];
  const inputMaterials = product.materials ?? [];
  const conversions = convData?.data?.conversions ?? [];

  function getLineCost(m: ProductMaterial): number {
    const itemObj = typeof m.item === 'object' ? m.item : null;
    if (!itemObj) return 0;
    const costPrice = itemObj.costPrice ?? 0;
    const usageUomId = typeof m.uom === 'object' ? m.uom._id : m.uom;
    const baseUomId = typeof itemObj.baseUom === 'object' ? itemObj.baseUom._id : (itemObj.baseUom ?? usageUomId);
    const factor = resolveConversionFactor(usageUomId, baseUomId, conversions);
    return m.qty * factor * costPrice;
  }

  return (
    <>
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: product.name }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button onClick={() => setEditOpen(true)} className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Product info */}
        <div className="bg-white rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Product Info</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              { label: 'Base UOM', value: uomSymbol || '—' },
              { label: 'Cost Price', value: product.costPrice > 0 ? formatCurrency(product.costPrice) : '—' },
              { label: 'Sale Price', value: product.salePrice ? formatCurrency(product.salePrice) : '—' },
              { label: 'Reorder Level', value: (product.reorderLevel ?? 0).toString() },
              { label: 'Status', value: <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium text-muted uppercase tracking-wide">{label}</dt>
                <dd className="mt-0.5 text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {product.description && (
            <p className="mt-3 text-sm text-secondary border-t border-border pt-3">{product.description}</p>
          )}
        </div>

        {/* Stock by warehouse */}
        <div className="bg-white rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Current Stock</h2>
          {balances.length === 0 ? (
            <p className="text-sm text-muted">No stock recorded.</p>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => {
                const wh = typeof b.warehouse === 'string' ? b.warehouse : (b.warehouse as { name: string }).name;
                const low = b.quantity <= product.reorderLevel;
                return (
                  <div key={b._id} className="flex items-center justify-between text-sm">
                    <span className="text-secondary">{wh}</span>
                    <span className={`font-semibold ${low ? 'text-amber-600' : 'text-foreground'}`}>
                      {b.quantity} {uomSymbol}
                      {low && <span className="ml-2 text-xs font-normal text-amber-500">Low stock</span>}
                    </span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border flex justify-between text-sm font-semibold">
                <span className="text-secondary">Total</span>
                <span className="text-foreground">{product.currentStock} {uomSymbol}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Materials (BOM recipe on the product) */}
      <div className="bg-white rounded-lg border border-border mb-4">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Input Materials</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Material', 'Qty / UOM', 'Unit Cost', 'Line Cost'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inputMaterials.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">No input materials defined.</td></tr>
              ) : (
                <>
                  {inputMaterials.map((m: ProductMaterial, i: number) => {
                    const itemObj = typeof m.item === 'object' ? m.item : null;
                    const name = itemObj?.name ?? (typeof m.item === 'string' ? m.item : '—');
                    const uomLabel = typeof m.uom === 'object' ? m.uom.symbol : m.uom;
                    const unitCost = itemObj?.costPrice ?? 0;
                    const lineCost = getLineCost(m);
                    return (
                      <tr key={i} className="border-b border-border hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                        <td className="px-4 py-3 text-foreground">{m.qty} {uomLabel ?? '—'}</td>
                        <td className="px-4 py-3 text-secondary">{unitCost > 0 ? formatCurrency(unitCost) : '—'}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{lineCost > 0 ? formatCurrency(lineCost) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 border-t-2 border-border">
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">Total Production Cost</td>
                    <td className="px-4 py-3 text-base font-bold text-emerald-600">
                      {formatCurrency(inputMaterials.reduce((sum, m: ProductMaterial) => sum + getLineCost(m), 0))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock movements */}
      <div className="bg-white rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Stock Movements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Type', 'Qty', 'Balance After', 'Reference', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">No movements yet.</td></tr>
              ) : (
                movements.slice(0, 20).map((m) => (
                  <tr key={m._id} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3">{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</td>
                    <td className={`px-4 py-3 font-medium ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-secondary">{m.balanceAfter}</td>
                    <td className="px-4 py-3 text-secondary font-mono text-xs">{m.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(m.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductionFormDialog open={editOpen} onClose={() => setEditOpen(false)} product={product} />
    </>
  );
}
