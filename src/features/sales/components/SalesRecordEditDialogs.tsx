'use client';

import { useEffect } from 'react';
import { useFieldArray, useForm, type Control, type FieldArrayPath, type FieldPath, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { formatCurrency } from '@/lib/formatters';
import {
  useUpdateSalesOrderMutation,
  useUpdateInvoiceMutation,
  useUpdateCustomerPaymentMutation,
  useGetCustomersQuery,
} from '../services/salesApi';
import type { CustomerPayment, Invoice, SalesOrder } from '../types';
import { useGetItemsQuery, useGetWarehousesQuery } from '@/features/inventory/services/inventoryApi';
import type { Item } from '@/features/inventory/types';

const lineSchema = z.object({
  item: z.string().min(1, 'Item required'),
  uom: z.string().min(1, 'UOM required'),
  qty: z.coerce.number().int('Qty must be a whole number').min(1, 'Qty > 0'),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
  discount: z.coerce.number().min(0).max(100),
  description: z.string().optional(),
});

const orderSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  taxPercent: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'Add at least one item'),
});
type OrderForm = z.infer<typeof orderSchema>;

const invoiceSchema = z.object({
  taxPercent: z.coerce.number().min(0).max(100),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'Add at least one item'),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

const receiptSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  method: z.string().min(1, 'Payment method required'),
  paymentDate: z.string().min(1, 'Payment date required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type ReceiptForm = z.infer<typeof receiptSchema>;

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'];

function idOf(value: string | { _id: string } | undefined) {
  return typeof value === 'string' ? value : value?._id ?? '';
}

function dateInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function EditFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label={title} className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col rounded-none bg-white shadow-lg sm:rounded-xl">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-secondary hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function EditLineItems<T extends { items: z.infer<typeof lineSchema>[] }>({
  register, control, lineErrors, items, fallbackItems, setValue, watchedItems,
}: {
  register: UseFormRegister<T>;
  control: Control<T>;
  lineErrors?: Array<Record<string, { message?: string } | undefined>>;
  items: Item[];
  fallbackItems: Array<{ _id: string; name: string; sku: string }>;
  setValue: UseFormSetValue<T>;
  watchedItems: Array<Partial<z.infer<typeof lineSchema>>> | undefined;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' as FieldArrayPath<T> });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => append({ item: '', uom: '', qty: 1, unitPrice: 0, discount: 0 } as never)} className="flex h-8 items-center gap-1.5 rounded-md bg-emerald px-3 text-xs font-medium text-white hover:bg-emerald-600"><Plus size={13} /> Add Line</button>
      </div>
      {fields.map((field, index) => {
        const current = watchedItems?.[index];
        const selectedItem = items.find((item) => item._id === current?.item);
        const fallbackItem = fallbackItems.find((item) => item._id === current?.item);
        return (
          <div key={field.id} className="grid grid-cols-1 items-end gap-3 rounded-md border border-border bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <SelectField label="Item" required error={lineErrors?.[index]?.item?.message} {...register(`items.${index}.item` as FieldPath<T>)} onChange={(event) => {
              const selected = items.find((item) => item._id === event.target.value);
              setValue(`items.${index}.item` as FieldPath<T>, event.target.value as never);
              if (selected) setValue(`items.${index}.uom` as FieldPath<T>, idOf(selected.baseUom) as never);
            }}>
              <option value="">Select item...</option>
              {fallbackItem && !items.some((item) => item._id === fallbackItem._id) && <option value={fallbackItem._id}>{fallbackItem.name} ({fallbackItem.sku})</option>}
              {items.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku})</option>)}
            </SelectField>
            <FormField label="Qty" type="number" min={1} step="1" required error={lineErrors?.[index]?.qty?.message} {...register(`items.${index}.qty` as FieldPath<T>)} />
            <FormField label="Unit Price" type="number" min={0} step="0.01" required error={lineErrors?.[index]?.unitPrice?.message} {...register(`items.${index}.unitPrice` as FieldPath<T>)} />
            <FormField label="Discount %" type="number" min={0} max={100} step="0.01" error={lineErrors?.[index]?.discount?.message} {...register(`items.${index}.discount` as FieldPath<T>)} />
            <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-md text-secondary hover:bg-red-50 hover:text-red-500 disabled:opacity-30" aria-label="Remove line"><Trash2 size={15} /></button>
            <input type="hidden" {...register(`items.${index}.uom` as FieldPath<T>)} />
            <input type="hidden" {...register(`items.${index}.description` as FieldPath<T>)} />
            <div className="md:col-span-4 text-right text-xs text-secondary">Line total: {formatCurrency((Number(current?.qty) || 0) * (Number(current?.unitPrice) || 0) * (1 - (Number(current?.discount) || 0) / 100))}{selectedItem ? ` · ${selectedItem.name}` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export function SalesOrderEditDialog({ order, open, onClose }: { order: SalesOrder; open: boolean; onClose: () => void }) {
  const [update, { isLoading }] = useUpdateSalesOrderMutation();
  const { data: itemsData } = useGetItemsQuery({ page: 1, type: 'FINISHED_GOOD' });
  const { data: warehouseData } = useGetWarehousesQuery();
  const { data: customersData } = useGetCustomersQuery({ page: 1 });
  const items = itemsData?.data?.items ?? [];
  const warehouses = warehouseData?.data?.warehouses ?? [];
  const customers = customersData?.data?.customers ?? [];
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<OrderForm>({ resolver: zodResolver(orderSchema) });
  const watchedItems = watch('items');

  useEffect(() => {
    if (open) reset({
      customer: idOf(order.customer), warehouse: idOf(order.warehouse), taxPercent: order.taxPercent,
      notes: order.notes ?? '',
      items: order.items.map((line) => ({ item: idOf(line.item), uom: idOf(line.uom), qty: line.qty, unitPrice: line.unitPrice, discount: line.discount, description: line.description ?? '' })),
    });
  }, [open, order, reset]);

  async function submit(values: OrderForm) {
    try {
      await update({ id: order._id, body: values }).unwrap();
      toast.success('Sales order updated');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to update sales order');
    }
  }
  if (!open) return null;

  return <EditFrame title={`Edit Order · ${order.orderNumber}`} onClose={onClose}>
    <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-col">
      <div className="overflow-y-auto px-6 py-4">
        <EditLineItems register={register} control={control} lineErrors={errors.items as Array<Record<string, { message?: string } | undefined>> | undefined} items={items} fallbackItems={order.items.flatMap((line) => typeof line.item === 'string' ? [] : [{ _id: line.item._id, name: line.item.name, sku: line.item.sku }])} setValue={setValue} watchedItems={watchedItems} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Customer" required error={errors.customer?.message} {...register('customer')}>
            {!customers.some((customer) => customer._id === idOf(order.customer)) && <option value={idOf(order.customer)}>{typeof order.customer === 'string' ? 'Current customer' : order.customer.name}</option>}
            {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
          </SelectField>
          <SelectField label="Warehouse" required error={errors.warehouse?.message} {...register('warehouse')}>
            {!warehouses.some((warehouse) => warehouse._id === idOf(order.warehouse)) && <option value={idOf(order.warehouse)}>{typeof order.warehouse === 'string' ? 'Current warehouse' : order.warehouse.name}</option>}
            {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>)}
          </SelectField>
          <FormField label="Tax %" type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} {...register('taxPercent')} />
          <TextareaField label="Notes" {...register('notes')} />
        </div>
        <p className="mt-3 text-xs text-amber-700">Invoices and receipts stay unchanged. Edit them separately to keep their payment history accurate.</p>
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <button type="button" onClick={onClose} disabled={isLoading} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={isLoading} className="flex h-10 items-center gap-2 rounded-md bg-emerald px-4 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60">{isLoading && <Loader2 size={14} className="animate-spin" />} Save Changes</button>
      </footer>
    </form>
  </EditFrame>;
}

export function InvoiceEditDialog({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const [update, { isLoading }] = useUpdateInvoiceMutation();
  const { data: itemsData } = useGetItemsQuery({ page: 1, type: 'FINISHED_GOOD' });
  const items = itemsData?.data?.items ?? [];
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<InvoiceForm>({ resolver: zodResolver(invoiceSchema) });
  const watchedItems = watch('items');

  useEffect(() => {
    if (open) reset({
      taxPercent: invoice.taxPercent, dueDate: dateInput(invoice.dueDate), notes: invoice.notes ?? '',
      items: invoice.items.map((line) => ({ item: idOf(line.item), uom: idOf(line.uom), qty: line.qty, unitPrice: line.unitPrice, discount: line.discount, description: line.description ?? '' })),
    });
  }, [open, invoice, reset]);

  async function submit(values: InvoiceForm) {
    try {
      await update({ id: invoice._id, body: { ...values, dueDate: values.dueDate || undefined } }).unwrap();
      toast.success('Invoice updated');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to update invoice');
    }
  }
  if (!open) return null;

  return <EditFrame title={`Edit Invoice · ${invoice.invoiceNumber}`} onClose={onClose}>
    <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-col">
      <div className="overflow-y-auto px-6 py-4">
        <EditLineItems register={register} control={control} lineErrors={errors.items as Array<Record<string, { message?: string } | undefined>> | undefined} items={items} fallbackItems={invoice.items.flatMap((line) => typeof line.item === 'string' ? [] : [{ _id: line.item._id, name: line.item.name, sku: line.item.sku }])} setValue={setValue} watchedItems={watchedItems} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Tax %" type="number" min={0} max={100} step="0.01" error={errors.taxPercent?.message} {...register('taxPercent')} />
          <FormField label="Due Date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
          <TextareaField label="Notes" {...register('notes')} />
        </div>
        <p className="mt-3 text-xs text-amber-700">Existing receipts remain linked to this invoice. The server may reject totals that conflict with recorded payments.</p>
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <button type="button" onClick={onClose} disabled={isLoading} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={isLoading} className="flex h-10 items-center gap-2 rounded-md bg-emerald px-4 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60">{isLoading && <Loader2 size={14} className="animate-spin" />} Save Changes</button>
      </footer>
    </form>
  </EditFrame>;
}

export function ReceiptEditDialog({ payment, open, onClose }: { payment: CustomerPayment; open: boolean; onClose: () => void }) {
  const [update, { isLoading }] = useUpdateCustomerPaymentMutation();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReceiptForm>({ resolver: zodResolver(receiptSchema) });

  useEffect(() => {
    if (open) reset({
      amount: payment.amount, method: payment.method, paymentDate: dateInput(payment.paymentDate),
      reference: payment.reference ?? '', notes: payment.notes ?? '',
    });
  }, [open, payment, reset]);

  async function submit(values: ReceiptForm) {
    try {
      await update({ id: payment._id, body: { ...values, paymentDate: new Date(values.paymentDate).toISOString(), reference: values.reference || undefined, notes: values.notes || undefined } }).unwrap();
      toast.success('Receipt updated');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to update receipt');
    }
  }
  if (!open) return null;

  return <EditFrame title={`Edit Receipt · ${payment.receiptNumber}`} onClose={onClose}>
    <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-col">
      <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-4 sm:grid-cols-2">
        <FormField label="Applied Amount" type="number" min={0.01} step="0.01" required error={errors.amount?.message} {...register('amount')} />
        <SelectField label="Payment Method" required error={errors.method?.message} {...register('method')}>
          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>)}
        </SelectField>
        <FormField label="Payment Date" type="date" required error={errors.paymentDate?.message} {...register('paymentDate')} />
        <FormField label="Reference" placeholder="Cheque no. / transaction ID" {...register('reference')} />
        <TextareaField label="Notes" {...register('notes')} />
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <button type="button" onClick={onClose} disabled={isLoading} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={isLoading} className="flex h-10 items-center gap-2 rounded-md bg-emerald px-4 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60">{isLoading && <Loader2 size={14} className="animate-spin" />} Save Changes</button>
      </footer>
    </form>
  </EditFrame>;
}
