'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useGetExpenseCategoriesQuery, useCreateExpenseMutation, useUpdateExpenseMutation } from '../services/financeApi';
import type { Expense } from '../types';

const schema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required').trim(),
  amount: z.coerce.number().positive('Amount must be positive'),
  expenseDate: z.string().optional(),
  paidBy: z.string().min(1, 'Paid by is required').trim(),
  status: z.enum(['PENDING', 'PAID']),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

export function ExpenseFormDialog({ open, onClose, expense }: Props) {
  const isEdit = !!expense;
  const { data: catData } = useGetExpenseCategoriesQuery();
  const [create, { isLoading: creating }] = useCreateExpenseMutation();
  const [update, { isLoading: updating }] = useUpdateExpenseMutation();
  const isLoading = creating || updating;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'PENDING' },
  });

  useEffect(() => {
    if (open) {
      if (expense) {
        const catId = typeof expense.category === 'object' ? expense.category._id : expense.category;
        reset({
          category: catId,
          description: expense.description,
          amount: expense.amount,
          expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : '',
          paidBy: expense.paidBy,
          status: expense.status,
          reference: expense.reference ?? '',
          notes: expense.notes ?? '',
        });
      } else {
        reset({ category: '', description: '', amount: 0, expenseDate: '', paidBy: '', status: 'PENDING', reference: '', notes: '' });
      }
    }
  }, [open, expense, reset]);

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && expense) {
        await update({ id: expense._id, body: values }).unwrap();
      } else {
        await create(values).unwrap();
      }
      onClose();
    } catch {
      // error surfaced by RTK Query
    }
  }

  if (!open) return null;

  const categories = catData?.data?.categories ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-dialog-title"
        className="relative w-full sm:max-w-lg bg-white rounded-xl shadow-lg p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="expense-dialog-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Expense' : 'New Expense'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <SelectField label="Category" required error={errors.category?.message} {...register('category')}>
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </SelectField>
            </div>

            <div className="sm:col-span-2">
              <FormField
                label="Description"
                required
                error={errors.description?.message}
                placeholder="What was this expense for?"
                {...register('description')}
              />
            </div>

            <FormField
              label="Amount (৳)"
              required
              error={errors.amount?.message}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register('amount')}
            />

            <FormField
              label="Expense Date"
              error={errors.expenseDate?.message}
              type="date"
              {...register('expenseDate')}
            />

            <FormField
              label="Paid By"
              required
              error={errors.paidBy?.message}
              placeholder="Name or department"
              {...register('paidBy')}
            />

            <SelectField label="Status" required error={errors.status?.message} {...register('status')}>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </SelectField>

            <div className="sm:col-span-2">
              <FormField
                label="Reference"
                error={errors.reference?.message}
                placeholder="Invoice / receipt no."
                {...register('reference')}
              />
            </div>

            <div className="sm:col-span-2">
              <TextareaField
                label="Notes"
                error={errors.notes?.message}
                placeholder="Optional notes"
                rows={2}
                {...register('notes')}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
