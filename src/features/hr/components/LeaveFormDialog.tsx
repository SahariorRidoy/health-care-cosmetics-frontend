'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateLeaveMutation, useGetEmployeesQuery } from '../services/hrApi';

const schema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  leaveType: z.enum(['ANNUAL', 'SICK', 'CASUAL', 'UNPAID', 'OTHER']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required').trim(),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LeaveFormDialog({ open, onClose }: Props) {
  const [create, { isLoading }] = useCreateLeaveMutation();
  const { data: empData } = useGetEmployeesQuery({ status: 'ACTIVE' });
  const employees = empData?.data?.employees ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { leaveType: 'ANNUAL' },
  });

  useEffect(() => {
    if (open) reset({ employee: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '', notes: '' });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await create(values).unwrap();
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title"
        className="relative w-full sm:max-w-lg bg-white rounded-xl shadow-lg p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="leave-dialog-title" className="text-base font-semibold text-foreground">New Leave Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <SelectField label="Employee" required error={errors.employee?.message} {...register('employee')}>
            <option value="">Select employee</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name} ({e.employeeId})</option>)}
          </SelectField>
          <SelectField label="Leave Type" required error={errors.leaveType?.message} {...register('leaveType')}>
            <option value="ANNUAL">Annual</option>
            <option value="SICK">Sick</option>
            <option value="CASUAL">Casual</option>
            <option value="UNPAID">Unpaid</option>
            <option value="OTHER">Other</option>
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" required type="date" error={errors.startDate?.message} {...register('startDate')} />
            <FormField label="End Date" required type="date" error={errors.endDate?.message} {...register('endDate')} />
          </div>
          <TextareaField label="Reason" required error={errors.reason?.message} rows={2} {...register('reason')} />
          <TextareaField label="Notes" error={errors.notes?.message} rows={2} {...register('notes')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Submit Leave
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
