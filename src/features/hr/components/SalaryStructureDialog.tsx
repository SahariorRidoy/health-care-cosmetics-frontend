'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/forms/FormField';
import { useCreateSalaryStructureMutation } from '../services/hrApi';

const lineItemSchema = z.object({ label: z.string().min(1, 'Label required'), amount: z.coerce.number().min(0) });

const schema = z.object({
  baseSalary: z.coerce.number().min(0, 'Base salary required'),
  allowances: z.array(lineItemSchema),
  deductions: z.array(lineItemSchema),
  effectiveDate: z.string().min(1, 'Effective date is required'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  employeeId: string;
}

export function SalaryStructureDialog({ open, onClose, employeeId }: Props) {
  const [create, { isLoading }] = useCreateSalaryStructureMutation();

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { baseSalary: 0, allowances: [], deductions: [], effectiveDate: '' },
  });

  const { fields: allowanceFields, append: addAllowance, remove: removeAllowance } = useFieldArray({ control, name: 'allowances' });
  const { fields: deductionFields, append: addDeduction, remove: removeDeduction } = useFieldArray({ control, name: 'deductions' });

  useEffect(() => {
    if (open) reset({ baseSalary: 0, allowances: [], deductions: [], effectiveDate: new Date().toISOString().slice(0, 10) });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await create({ ...values, employee: employeeId }).unwrap();
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="sal-dialog-title"
        className="relative w-full sm:max-w-lg bg-white rounded-xl shadow-lg p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="sal-dialog-title" className="text-base font-semibold text-foreground">New Salary Structure</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Base Salary (৳)" required type="number" min={0} error={errors.baseSalary?.message} {...register('baseSalary')} />
            <FormField label="Effective Date" required type="date" error={errors.effectiveDate?.message} {...register('effectiveDate')} />
          </div>

          {/* Allowances */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Allowances</span>
              <button type="button" onClick={() => addAllowance({ label: '', amount: 0 })} className="text-xs text-emerald hover:underline flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            {allowanceFields.map((field, i) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input placeholder="Label" {...register(`allowances.${i}.label`)} className="h-9 flex-1 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                <input type="number" min={0} placeholder="Amount" {...register(`allowances.${i}.amount`)} className="h-9 w-28 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                <button type="button" onClick={() => removeAllowance(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Deductions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Deductions</span>
              <button type="button" onClick={() => addDeduction({ label: '', amount: 0 })} className="text-xs text-emerald hover:underline flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            {deductionFields.map((field, i) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input placeholder="Label" {...register(`deductions.${i}.label`)} className="h-9 flex-1 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                <input type="number" min={0} placeholder="Amount" {...register(`deductions.${i}.amount`)} className="h-9 w-28 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                <button type="button" onClick={() => removeDeduction(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Save Structure
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
