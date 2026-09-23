'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormField, SelectField } from '@/components/forms/FormField';
import { useGetUOMsQuery } from '@/features/inventory/services/inventoryApi';
import { useAddMaterialReturnMutation } from '../services/factoryProductionApi';
import type { FactoryBatch, FactoryDispatchMaterial } from '../types';

interface ReturnLine {
  item: string;
  returnedQty: string;
  uom: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  batch: FactoryBatch;
}

function emptyLine(): ReturnLine {
  return { item: '', returnedQty: '', uom: '' };
}

export function ReturnMaterialDialog({ open, onClose, batch }: Props) {
  const { data: uomData } = useGetUOMsQuery();
  const [addReturn, { isLoading }] = useAddMaterialReturnMutation();

  const uoms = useMemo(() => uomData?.data?.uoms?.filter((u) => u.isActive) ?? [], [uomData]);

  // Build dispatched materials list with remaining stock derived
  const dispatchedMaterials = useMemo(() => {
    return batch.dispatch.materials.map((m: FactoryDispatchMaterial) => {
      const item = m.item as { _id: string; name: string; sku: string } | string;
      const uom = m.uom as { _id: string; symbol: string } | string;
      const itemId = typeof item === 'string' ? item : item._id;
      const itemName = typeof item === 'string' ? item : item.name;
      const uomId = typeof uom === 'string' ? uom : uom._id;
      const uomSymbol = typeof uom === 'string' ? '' : uom.symbol;

      // Derive remaining: dispatched - used - already returned
      const dispatched = m.dispatchedQty;
      const used = batch.receipts.reduce((s, r) =>
        s + r.products.reduce((ps, p) =>
          ps + p.materialsUsed
            .filter((mu) => {
              const muItem = mu.item as { _id: string } | string;
              return (typeof muItem === 'string' ? muItem : muItem._id) === itemId;
            })
            .reduce((ms, mu) => ms + mu.usedQty, 0), 0), 0);
      const returned = batch.materialReturns.reduce((s, r) =>
        s + r.materials
          .filter((mat) => {
            const matItem = mat.item as { _id: string } | string;
            return (typeof matItem === 'string' ? matItem : matItem._id) === itemId;
          })
          .reduce((ms, mat) => ms + mat.returnedQty, 0), 0);
      const remaining = Math.max(0, dispatched - used - returned);

      return { id: itemId, name: itemName, uomId, uomSymbol, dispatched, used, returned, remaining };
    });
  }, [batch]);

  const [returnDate, setReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReturnLine[]>([emptyLine()]);

  function reset() { setReturnDate(''); setNotes(''); setLines([emptyLine()]); }
  function handleClose() { reset(); onClose(); }

  function updateLine(idx: number, patch: Partial<ReturnLine>) {
    setLines((p) => p.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  async function handleSave() {
    if (!returnDate) { toast.error('Return date is required'); return; }
    const filled = lines.filter((l) => l.item && parseFloat(l.returnedQty) > 0 && l.uom);
    if (!filled.length) { toast.error('Add at least one material to return'); return; }

    for (const l of filled) {
      const mat = dispatchedMaterials.find((d) => d.id === l.item);
      if (mat && parseFloat(l.returnedQty) > mat.remaining) {
        toast.error(`Return qty exceeds remaining factory stock (${mat.remaining} ${mat.uomSymbol}) for "${mat.name}"`);
        return;
      }
    }

    try {
      await addReturn({
        id: batch._id,
        body: {
          returnDate: new Date(returnDate).toISOString(),
          materials: filled.map((l) => ({ item: l.item, returnedQty: parseFloat(l.returnedQty), uom: l.uom })),
          notes: notes.trim() || undefined,
        },
      }).unwrap();
      toast.success('Material return recorded — stock restored');
      reset();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to record return');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-label="Return Materials"
        className="relative w-full sm:max-w-xl bg-white rounded-none sm:rounded-xl shadow-lg z-10 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Return Materials</h2>
            <p className="text-xs text-secondary mt-0.5">{batch.fbNumber} — unused materials back to warehouse</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Factory stock summary */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-border">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Current Factory Stock</p>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  {['Material', 'Dispatched', 'Used', 'Returned', 'Remaining'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dispatchedMaterials.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{d.name}</td>
                    <td className="px-3 py-2 text-secondary">{d.dispatched} {d.uomSymbol}</td>
                    <td className="px-3 py-2 text-secondary">{d.used} {d.uomSymbol}</td>
                    <td className="px-3 py-2 text-secondary">{d.returned} {d.uomSymbol}</td>
                    <td className="px-3 py-2">
                      <span className={`font-semibold ${d.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {d.remaining} {d.uomSymbol}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Return form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Return Date" type="date" required value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            <FormField label="Notes" placeholder="Optional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Materials to Return</p>
              <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="h-7 px-2.5 rounded-md border border-border text-xs text-secondary hover:bg-slate-50 flex items-center gap-1 transition-colors">
                <Plus size={11} /> Add Row
              </button>
            </div>

            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_110px_110px_32px] gap-2 px-1">
                <span className="text-[11px] font-medium text-secondary">Material</span>
                <span className="text-[11px] font-medium text-secondary">Return Qty</span>
                <span className="text-[11px] font-medium text-secondary">UOM</span>
                <span />
              </div>
              {lines.map((l, idx) => {
                const mat = dispatchedMaterials.find((d) => d.id === l.item);
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_32px] gap-2 items-center">
                    <div className="flex flex-col gap-0.5">
                      <select
                        value={l.item}
                        onChange={(e) => {
                          const found = dispatchedMaterials.find((d) => d.id === e.target.value);
                          updateLine(idx, { item: e.target.value, uom: found?.uomId ?? '' });
                        }}
                        className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                      >
                        <option value="">Select material…</option>
                        {dispatchedMaterials.map((d) => (
                          <option key={d.id} value={d.id} disabled={d.remaining <= 0}>
                            {d.name} (remaining: {d.remaining} {d.uomSymbol})
                          </option>
                        ))}
                      </select>
                      {mat && (
                        <span className="text-[10px] text-secondary px-1">Max returnable: <span className="font-semibold text-amber-600">{mat.remaining} {mat.uomSymbol}</span></span>
                      )}
                    </div>
                    <input
                      type="number" min={0} step="any" placeholder="Qty"
                      value={l.returnedQty}
                      onChange={(e) => updateLine(idx, { returnedQty: e.target.value })}
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald"
                    />
                    <SelectField label="" value={l.uom} onChange={(e) => updateLine(idx, { uom: e.target.value })}>
                      <option value="">UOM…</option>
                      {uoms.map((u) => <option key={u._id} value={u._id}>{u.symbol}</option>)}
                    </SelectField>
                    <button
                      type="button"
                      onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                      disabled={lines.length === 1}
                      className="h-9 w-8 flex items-center justify-center rounded-md text-secondary hover:text-red-500 disabled:opacity-30 transition-colors"
                      aria-label="Remove row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={handleClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Record Return
          </button>
        </div>
      </div>
    </div>
  );
}
