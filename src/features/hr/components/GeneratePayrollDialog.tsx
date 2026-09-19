'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { SelectField, TextareaField } from '@/components/forms/FormField';
import { useGeneratePayrollMutation, useGetEmployeesQuery } from '../services/hrApi';

const currentYear = new Date().getFullYear();
const schema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GeneratePayrollDialog({ open, onClose }: Props) {
  const [generate, { isLoading }] = useGeneratePayrollMutation();
  const { data: empData } = useGetEmployeesQuery({ status: 'ACTIVE' });
  const employees = empData?.data?.employees ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { month: new Date().getMonth() + 1, year: currentYear },
  });

  useEffect(() => {
    if (open) reset({ employee: '', month: new Date().getMonth() + 1, year: currentYear, notes: '' });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await generate(values).unwrap();
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="payroll-dialog-title"
        className="relative w-full sm:max-w-md bg-white rounded-xl shadow-lg p-6 z-10"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="payroll-dialog-title" className="text-base font-semibold text-foreground">Generate Payroll</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <SelectField label="Employee" required error={errors.employee?.message} {...register('employee')}>
            <option value="">Select employee</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name} ({e.employeeId})</option>)}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Month" required error={errors.month?.message} {...register('month')}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </SelectField>
            <SelectField label="Year" required error={errors.year?.message} {...register('year')}>
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </SelectField>
          </div>
          <TextareaField label="Notes" error={errors.notes?.message} rows={2} {...register('notes')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
