'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft, Package, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { DealerFormDialog } from '@/features/sales/components/DealerFormDialog';
import { formatCurrency } from '@/lib/formatters';
import { useCreateSalesOrderMutation, useGetDealersQuery } from '@/features/sales/services/salesApi';
import type { Dealer } from '@/features/sales/types';
import { useGetItemsQuery, useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

const lineSchema = z.object({
  item: z.string().min(1, 'Item required'),
  uom: z.string().min(1, 'UOM required'),
  qty: z.coerce.number().int('Whole number').min(1, 'Qty > 0'),
  giftQty: z.coerce.number().int('Whole number').min(0).default(0),
  unitPrice: z.coerce.number().min(0, 'Price ≥ 0'),
  commissionRate: z.coerce.number().min(0).max(100).default(0),
  description: z.string().optional(),
});

const orderSchema = z.object({
  dealer: z.string().min(1, 'Dealer is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  commissionRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'Add at least one item'),
  paymentAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().default('CASH'),
  paymentReference: z.string().optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [createOrder, { isLoading }] = useCreateSalesOrderMutation();
  const [dealerDialogOpen, setDealerDialogOpen] = useState(false);
  const [extraDealers, setExtraDealers] = useState<Dealer[]>([]);
  const { data: dealersData } = useGetDealersQuery({ page: 1 });
  const { data: itemsData } = useGetItemsQuery({ page: 1, type: 'FINISHED_GOOD' });
  const { data: warehouseData } = useGetWarehousesQuery();

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      taxPercent: 0, commissionRate: 0,
      paymentMethod: 'CASH', paymentAmount: 0,
      items: [{ item: '', uom: '', qty: 1, giftQty: 0, unitPrice: 0, commissionRate: 0 }],
    },
  });

  const warehouses = warehouseData?.data?.warehouses?.filter((w) => w.isActive) ?? [];
  useEffect(() => {
    if (warehouses.length > 0) setValue('warehouse', warehouses[0]._id);
  }, [warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedTax = useWatch({ control, name: 'taxPercent' });
  const watchedPaymentAmount = useWatch({ control, name: 'paymentAmount' });

  const watchedDealer = useWatch({ control, name: 'dealer' });
  const dealers = [...(dealersData?.data?.dealers?.filter((d) => d.isActive) ?? []), ...extraDealers];
  const items = itemsData?.data?.items ?? [];

  function getCurrentCommission() {
    const d = dealers.find((x) => x._id === watchedDealer);
    return d?.commissionRate ?? 0;
  }

  function handleItemChange(index: number, itemId: string) {
    setValue(`items.${index}.item`, itemId);
    const found = items.find((it) => it._id === itemId);
    if (found) {
      if (found.salePrice) setValue(`items.${index}.unitPrice`, found.salePrice);
      const uomId = typeof found.baseUom === 'string' ? found.baseUom : found.baseUom._id;
      setValue(`items.${index}.uom`, uomId);
    }
  }

  // Totals
  const grossAmount = watchedItems?.reduce((s, l) =>
    s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0) ?? 0;
  const totalCommission = watchedItems?.reduce((s, l) => {
    const lineGross = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    return s + lineGross * ((Number(l.commissionRate) || 0) / 100);
  }, 0) ?? 0;
  const subtotal = grossAmount - totalCommission;
  const taxAmount = subtotal * (Number(watchedTax) || 0) / 100;
  const grandTotal = subtotal + taxAmount;

  async function onSubmit(values: OrderForm) {
    try {
      const result = await createOrder({
        dealer: values.dealer,
        warehouse: values.warehouse,
        taxPercent: values.taxPercent,
        commissionRate: values.commissionRate,
        notes: values.notes,
        items: values.items.map((l) => ({
          item: l.item, uom: l.uom, qty: l.qty,
          giftQty: l.giftQty, unitPrice: l.unitPrice,
          commissionRate: l.commissionRate,
          description: l.description,
        })),
        ...(values.paymentAmount > 0 ? {
          payment: {
            amount: values.paymentAmount,
            method: values.paymentMethod,
            reference: values.paymentReference,
          },
        } : {}),
      }).unwrap();
      toast.success('Sales order created');
      router.push(`/sales/invoices/${result.data.salesOrder.invoiceId}`);
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to create order');
    }
  }

  return (
    <>
      <PageHeader
        title="New Sales Order"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Orders', href: '/sales/orders' }, { label: 'New' }]}
        actions={
          <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <ArrowLeft size={15} /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">

        {/* Main grid: 4-col on 2xl, 3-col on lg/xl, 2-col on md, 1-col on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">

          {/* LEFT COLUMN — Line Items + Order Details (spans 2 on md+, 2 on lg, 3 on 2xl) */}
          <div className="col-span-1 md:col-span-1 lg:col-span-2 2xl:col-span-3 flex flex-col gap-6">

        {/* Line items table */}
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-slate-700">
            <div className="flex items-center gap-2.5">
              <Package size={14} className="text-emerald shrink-0" />
              <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Line Items</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  {['Product', 'Stock', 'Qty', 'Free/Gift', 'TP Price (৳)', 'Commission %', 'Net Amount', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((field, i) => {
                  const lineGross = (Number(watchedItems?.[i]?.qty) || 0) * (Number(watchedItems?.[i]?.unitPrice) || 0);
                  const lineCommission = lineGross * ((Number(watchedItems?.[i]?.commissionRate) || 0) / 100);
                  const lineNet = lineGross - lineCommission;
                  const uomSymbol = (() => {
                    const it = items.find((x) => x._id === watchedItems?.[i]?.item);
                    return typeof it?.baseUom === 'object' ? it.baseUom.symbol : '';
                  })();
                  return (
                    <tr key={field.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        {(() => {
                          const selectedIds = new Set(watchedItems?.map((l, idx) => idx !== i ? l.item : '').filter(Boolean));
                          return (
                            <SelectField error={errors.items?.[i]?.item?.message} {...register(`items.${i}.item`)} onChange={(e) => handleItemChange(i, e.target.value)}>
                              <option value="">Select product…</option>
                              {items.map((it) => (
                                <option key={it._id} value={it._id} disabled={selectedIds.has(it._id)}>{it.name}</option>
                              ))}
                            </SelectField>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 w-[80px]">
                        {(() => {
                          const it = items.find((x) => x._id === watchedItems?.[i]?.item);
                          if (!it) return <span className="text-xs text-muted">—</span>;
                          const isLow = it.currentStock === 0 || (it.reorderLevel != null && it.currentStock <= it.reorderLevel);
                          return (
                            <span className={`text-xs font-semibold ${isLow ? 'text-red-500' : 'text-emerald-600'}`}>
                              {it.currentStock}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 w-[130px]">
                        <div className="flex items-center gap-1">
                          <div className="min-w-0 flex-1">
                            <FormField type="number" min={1} step="1" error={errors.items?.[i]?.qty?.message} className="no-spinner" onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }} {...register(`items.${i}.qty`)} />
                          </div>
                          {uomSymbol && <span className="text-xs text-muted shrink-0">{uomSymbol}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 w-[75px]">
                        <FormField type="number" min={0} step="1" placeholder="0" error={errors.items?.[i]?.giftQty?.message} className="no-spinner" onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }} {...register(`items.${i}.giftQty`)} />
                      </td>
                      <td className="px-3 py-2 w-[130px]">
                        <FormField type="number" min={0} step="0.01" error={errors.items?.[i]?.unitPrice?.message} className="no-spinner" onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (!/[0-9.]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }} {...register(`items.${i}.unitPrice`)} />
                      </td>
                      <td className="px-3 py-2 w-[80px]">
                        <FormField type="number" min={0} max={100} step="0.5" placeholder="0" error={errors.items?.[i]?.commissionRate?.message} className="no-spinner" onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (!/[0-9.]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }} {...register(`items.${i}.commissionRate`)} />
                      </td>
                      <td className="px-3 py-2 w-[110px]">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{formatCurrency(lineNet)}</span>
                          {lineCommission > 0 && (
                            <span className="text-[11px] text-violet-500">-{formatCurrency(lineCommission)} comm.</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 w-[40px]">
                        <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="h-8 w-8 rounded-md text-secondary hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-0 disabled:pointer-events-none">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errors.items?.root && <p className="px-4 pb-3 text-[11px] text-red-500">{errors.items.root.message}</p>}
          <div className="px-4 py-3 border-t border-border">
            <button
              type="button"
              onClick={() => append({ item: '', uom: '', qty: 1, giftQty: 0, unitPrice: 0, commissionRate: getCurrentCommission() })}
              className="h-8 px-3 rounded-md border border-dashed border-emerald-500 text-emerald-600 text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-50 transition-colors"
            >
              <Plus size={13} /> Add Line
            </button>
          </div>
        </div>

          {/* Order Details (bottom-left) */}
          <div className="bg-white rounded-lg border border-border divide-y divide-border">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-slate-700 rounded-t-lg">
              <ShoppingCart size={14} className="text-emerald shrink-0" />
              <p className="text-xs font-semibold text-white uppercase tracking-wide">Order Details</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </SelectField>

              <TextareaField label="Notes" placeholder="Optional notes…" {...register('notes')} rows={1} />

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Controller
                    control={control}
                    name="dealer"
                    render={({ field }) => (
                      <SelectField label="Dealer" required error={errors.dealer?.message} {...field} onChange={(e) => {
                        field.onChange(e);
                        const d = dealers.find((x) => x._id === e.target.value);
                        if (d) {
                          setValue('commissionRate', d.commissionRate ?? 0);
                          // Apply dealer default commission to all lines
                          fields.forEach((_, i) => setValue(`items.${i}.commissionRate`, d.commissionRate ?? 0));
                        }
                      }}>
                        <option value="">Select dealer…</option>
                        {dealers.map((d) => <option key={d._id} value={d._id}>{d.name}{d.commissionRate ? ` (${d.commissionRate}%)` : ''}</option>)}
                      </SelectField>
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDealerDialogOpen(true)}
                  className="h-10 w-10 rounded-md bg-emerald hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors mb-[1px]"
                  title="New dealer"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          </div>{/* end left column */}

          {/* RIGHT COLUMN — Summary + Payment */}
          <div className="col-span-1 md:col-span-1 lg:col-span-1 2xl:col-span-1 flex flex-col gap-4">
            {/* Summary */}
            <div className="bg-white rounded-lg border border-border divide-y divide-border">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-slate-700 rounded-t-lg">
                <ShoppingCart size={13} className="text-emerald shrink-0" />
                <p className="text-xs font-semibold text-white uppercase tracking-wide">Summary</p>
              </div>
              <div className="p-5 flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-secondary">
                  <span>Gross TP</span><span>{formatCurrency(grossAmount)}</span>
                </div>
                <div className="flex justify-between text-violet-600">
                  <span>Dealer Commission</span><span>- {formatCurrency(totalCommission)}</span>
                </div>
                <div className="flex justify-between text-secondary border-t border-border pt-2">
                  <span>Net Amount</span><span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Tax %</span>
                  <FormField type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} onFocus={(e) => e.target.select()} className="no-spinner w-20 text-right" {...register('taxPercent')} />
                </div>
                {Number(watchedTax) > 0 && (
                  <div className="flex justify-between text-secondary">
                    <span>Tax ({Number(watchedTax)}%)</span><span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-2">
                  <span>Total</span><span className="text-emerald-600 text-base">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-lg border border-border divide-y divide-border">
              <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border bg-slate-700 rounded-t-lg">
                <ShoppingCart size={13} className="text-emerald shrink-0" />
                <p className="text-xs font-semibold text-white uppercase tracking-wide">Payment</p>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <FormField label="Amount (৳)" type="number" min={0} step="0.01" error={errors.paymentAmount?.message} onFocus={(e) => e.target.select()} {...register('paymentAmount')} />
                <div className="flex gap-2">
                  <div className="w-[130px] shrink-0">
                    <Controller
                      control={control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <SelectField label="Method" error={errors.paymentMethod?.message} {...field}>
                          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                        </SelectField>
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField label="Reference" placeholder="Cheque / txn ID…" {...register('paymentReference')} />
                  </div>
                </div>
                {Number(watchedPaymentAmount) > 0 && (
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    {Number(watchedPaymentAmount) >= grandTotal
                      ? <><span className="text-muted">Change</span><span className="font-semibold text-emerald-600">{formatCurrency(Number(watchedPaymentAmount) - grandTotal)}</span></>
                      : <><span className="text-muted">Due Balance</span><span className="font-semibold text-amber-600">{formatCurrency(grandTotal - Number(watchedPaymentAmount))}</span></>
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button type="submit" disabled={isLoading} className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                Create Sales Order
              </button>
              <button type="button" onClick={() => router.back()} className="h-10 px-4 rounded-md border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors">Cancel</button>
            </div>
          </div>{/* end right column */}

        </div>{/* end main grid */}
      </form>

      <DealerFormDialog
        open={dealerDialogOpen}
        onClose={(created) => {
          setDealerDialogOpen(false);
          if (created) {
            setExtraDealers((prev) => [...prev, created]);
            setValue('dealer', created._id);
            setValue('commissionRate', created.commissionRate ?? 0);
            fields.forEach((_, i) => setValue(`items.${i}.commissionRate`, created.commissionRate ?? 0));
          }
        }}
      />
    </>
  );
}
