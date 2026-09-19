'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useUpsertAttendanceMutation, useGetEmployeesQuery } from '../services/hrApi';

const schema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY']),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export function AttendanceDialog({ open, onClose, defaultDate }: Props) {
  const [upsert, { isLoading }] = useUpsertAttendanceMutation();
  const { data: empData } = useGetEmployeesQuery({ status: 'ACTIVE' });
  const employees = empData?.data?.employees ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'PRESENT' },
  });

  useEffect(() => {
    if (open) reset({ employee: '', date: defaultDate ?? new Date().toISOString().slice(0, 10), status: 'PRESENT', notes: '' });
  }, [open, defaultDate, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await upsert(values).unwrap();
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="att-dialog-title"
        className="relative w-full sm:max-w-md bg-white rounded-xl shadow-lg p-6 z-10"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="att-dialog-title" className="text-base font-semibold text-foreground">Record Attendance</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <SelectField label="Employee" required error={errors.employee?.message} {...register('employee')}>
            <option value="">Select employee</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name} ({e.employeeId})</option>)}
          </SelectField>
          <FormField label="Date" required type="date" error={errors.date?.message} {...register('date')} />
          <SelectField label="Status" required error={errors.status?.message} {...register('status')}>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
          </SelectField>
          <TextareaField label="Notes" error={errors.notes?.message} rows={2} {...register('notes')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Save Attendance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
