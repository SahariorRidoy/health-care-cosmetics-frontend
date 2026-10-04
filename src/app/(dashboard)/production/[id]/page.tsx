'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Package, Warehouse, TrendingDown, DollarSign, FlaskConical, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState, StatusBadge } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetProductQuery } from '@/features/products/services/productsApi';
import { useGetStockBalancesQuery, useGetStockMovementsQuery } from '@/features/inventory/services/inventoryApi';
import { useGetUOMConversionsQuery } from '@/features/settings/services/settingsApi';
import { ProductionFormDialog } from '@/features/production/components/ProductionFormDialog';
import { ProductionBatchHistory } from '@/features/production/components/ProductionBatchHistory';
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

const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PRODUCTION_OUTPUT: { label: 'Production Output', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  PRODUCTION_ISSUE: { label: 'Material Consumed', color: 'text-orange-700', bg: 'bg-orange-50' },
  SALES_DISPATCH: { label: 'Sales Dispatch', color: 'text-blue-700', bg: 'bg-blue-50' },
  ADJUSTMENT: { label: 'Adjustment', color: 'text-slate-600', bg: 'bg-slate-100' },
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

  const totalProductionCost = inputMaterials.reduce((sum, m: ProductMaterial) => sum + getLineCost(m), 0);
  const totalStock = product.currentStock;
  const isLowStock = totalStock <= product.reorderLevel;
  const margin = product.salePrice && product.costPrice ? ((product.salePrice - product.costPrice) / product.salePrice) * 100 : null;

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-secondary">SKU: {product.sku}</span>
            <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} />
          </span>
        }
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: product.name }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium">
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={() => setEditOpen(true)} className="h-9 px-4 rounded-lg bg-emerald hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
              <Pencil size={13} /> Edit Product
            </button>
          </div>
        }
      />

      {/* KPI chips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: 'Current Stock',
            value: `${totalStock} ${uomSymbol}`,
            icon: Package,
            color: isLowStock ? 'text-red-600' : 'text-emerald-600',
            bg: isLowStock ? 'bg-red-50' : 'bg-emerald-50',
            sub: isLowStock ? 'Below reorder level' : `Reorder at ${product.reorderLevel}`,
            subColor: isLowStock ? 'text-red-400' : 'text-muted',
          },
          {
            label: 'Warehouses',
            value: balances.length,
            icon: Warehouse,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            sub: 'Storage locations',
            subColor: 'text-muted',
          },
          {
            label: 'Cost Price',
            value: product.costPrice > 0 ? formatCurrency(product.costPrice) : '—',
            icon: DollarSign,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            sub: `Sale: ${product.salePrice ? formatCurrency(product.salePrice) : '—'}`,
            subColor: 'text-muted',
          },
          {
            label: 'Margin',
            value: margin !== null ? `${margin.toFixed(1)}%` : '—',
            icon: TrendingDown,
            color: margin !== null && margin > 30 ? 'text-emerald-600' : 'text-amber-600',
            bg: margin !== null && margin > 30 ? 'bg-emerald-50' : 'bg-amber-50',
            sub: 'Gross margin',
            subColor: 'text-muted',
          },
        ].map(({ label, value, icon: Icon, color, bg, sub, subColor }) => (
          <div key={label} className="bg-white rounded-xl border border-border px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-base font-bold text-foreground leading-tight truncate">{value}</p>
              <p className={`text-[11px] ${subColor} leading-tight`}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Product info */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-slate-50/60 flex items-center gap-2">
            <FlaskConical size={14} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-foreground">Product Info</h2>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                { label: 'Base UOM', value: uomSymbol || '—' },
                { label: 'Reorder Level', value: `${product.reorderLevel ?? 0} ${uomSymbol}` },
                { label: 'Cost Price', value: product.costPrice > 0 ? <span className="font-semibold text-violet-600">{formatCurrency(product.costPrice)}</span> : '—' },
                { label: 'Sale Price', value: product.salePrice ? <span className="font-semibold text-emerald-600">{formatCurrency(product.salePrice)}</span> : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-0.5">{label}</dt>
                  <dd className="text-foreground font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {product.description && (
              <p className="mt-4 text-sm text-secondary border-t border-border pt-4 leading-relaxed">{product.description}</p>
            )}
          </div>
        </div>

        {/* Stock by warehouse */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-slate-50/60 flex items-center gap-2">
            <Warehouse size={14} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-foreground">Stock by Warehouse</h2>
          </div>
          <div className="p-5">
            {balances.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No stock recorded.</p>
            ) : (
              <div className="space-y-3">
                {balances.map((b) => {
                  const wh = typeof b.warehouse === 'string' ? b.warehouse : (b.warehouse as { name: string }).name;
                  const low = b.quantity <= product.reorderLevel;
                  const pct = product.reorderLevel > 0 ? Math.min((b.quantity / (product.reorderLevel * 3)) * 100, 100) : 80;
                  return (
                    <div key={b._id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-secondary font-medium">{wh}</span>
                        <span className={`font-bold ${low ? 'text-red-600' : 'text-foreground'}`}>
                          {b.quantity} {uomSymbol}
                          {low && <span className="ml-2 text-[10px] font-semibold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">Low</span>}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${low ? 'bg-red-400' : 'bg-emerald'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-border flex justify-between text-sm font-bold">
                  <span className="text-secondary">Total</span>
                  <span className="text-foreground">{product.currentStock} {uomSymbol}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Materials */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-border bg-slate-50/60 flex items-center gap-2">
          <BarChart3 size={14} className="text-violet-600" />
          <h2 className="text-sm font-semibold text-foreground">Bill of Materials</h2>
          {inputMaterials.length > 0 && (
            <span className="ml-auto text-xs text-muted">{inputMaterials.length} material{inputMaterials.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Material', 'Qty / UOM', 'Unit Cost', 'Line Cost'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inputMaterials.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted text-sm">No input materials defined.</td></tr>
              ) : (
                <>
                  {inputMaterials.map((m: ProductMaterial, i: number) => {
                    const itemObj = typeof m.item === 'object' ? m.item : null;
                    const name = itemObj?.name ?? (typeof m.item === 'string' ? m.item : '—');
                    const uomLabel = typeof m.uom === 'object' ? m.uom.symbol : m.uom;
                    const unitCost = itemObj?.costPrice ?? 0;
                    const lineCost = getLineCost(m);
                    return (
                      <tr key={i} className="border-b border-border hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-foreground">{name}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-foreground px-2 py-0.5 rounded-md text-xs font-medium">
                            {m.qty} <span className="text-muted">{uomLabel ?? '—'}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-secondary">{unitCost > 0 ? formatCurrency(unitCost) : '—'}</td>
                        <td className="px-5 py-3.5 font-semibold text-foreground">{lineCost > 0 ? formatCurrency(lineCost) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gradient-to-r from-emerald-50 to-transparent border-t-2 border-emerald/20">
                    <td colSpan={3} className="px-5 py-4 text-sm font-bold text-foreground">Total Production Cost</td>
                    <td className="px-5 py-4 text-lg font-bold text-emerald-600">{formatCurrency(totalProductionCost)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4">
        <ProductionBatchHistory productId={id} outputUomSymbol={uomSymbol} />
      </div>

      {/* Stock movements */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-slate-50/60 flex items-center gap-2">
          <BarChart3 size={14} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-foreground">Stock Movements</h2>
          {movements.length > 0 && <span className="ml-auto text-xs text-muted">{movements.length} records</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {['Type', 'Qty', 'Balance After', 'Reference', 'Date'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted text-sm">No movements yet.</td></tr>
              ) : (
                movements.slice(0, 20).map((m) => {
                  const cfg = MOVEMENT_TYPE_CONFIG[m.type];
                  return (
                    <tr key={m._id} className="border-b border-border hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${cfg?.bg ?? 'bg-slate-100'} ${cfg?.color ?? 'text-slate-600'}`}>
                          {cfg?.label ?? m.type}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 font-bold text-sm ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-5 py-3.5 text-secondary font-medium">{m.balanceAfter}</td>
                      <td className="px-5 py-3.5 text-secondary font-mono text-xs">{m.reference ?? '—'}</td>
                      <td className="px-5 py-3.5 text-secondary">{formatDate(m.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductionFormDialog open={editOpen} onClose={() => setEditOpen(false)} product={product} />
    </>
  );
}
