'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation, useGetDepartmentsQuery } from '../services/hrApi';
import type { Employee } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email').trim().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required').trim(),
  joiningDate: z.string().min(1, 'Joining date is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']),
  currentSalary: z.coerce.number().min(0),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

export function EmployeeFormDialog({ open, onClose, employee }: Props) {
  const isEdit = !!employee;
  const [create, { isLoading: creating }] = useCreateEmployeeMutation();
  const [update, { isLoading: updating }] = useUpdateEmployeeMutation();
  const { data: deptData } = useGetDepartmentsQuery();
  const isLoading = creating || updating;
  const departments = deptData?.data?.departments ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ACTIVE', currentSalary: 0 },
  });

  useEffect(() => {
    if (open) {
      if (employee) {
        reset({
          name: employee.name,
          email: employee.email ?? '',
          phone: employee.phone ?? '',
          address: employee.address ?? '',
          department: typeof employee.department === 'object' ? employee.department._id : employee.department,
          designation: employee.designation,
          joiningDate: employee.joiningDate.slice(0, 10),
          status: employee.status,
          currentSalary: employee.currentSalary,
        });
      } else {
        reset({ name: '', email: '', phone: '', address: '', department: '', designation: '', joiningDate: '', status: 'ACTIVE', currentSalary: 0 });
      }
    }
  }, [open, employee, reset]);

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, email: values.email || undefined };
      if (isEdit && employee) {
        await update({ id: employee._id, body: payload }).unwrap();
      } else {
        await create(payload).unwrap();
      }
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="emp-dialog-title"
        className="relative w-full sm:max-w-lg bg-white rounded-none sm:rounded-xl shadow-lg p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="emp-dialog-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Employee' : 'New Employee'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required error={errors.name?.message} placeholder="e.g. Rahim Uddin" {...register('name')} />
            <FormField label="Email" error={errors.email?.message} type="email" placeholder="email@example.com" {...register('email')} />
            <FormField label="Phone" error={errors.phone?.message} placeholder="+880..." {...register('phone')} />
            <FormField label="Designation" required error={errors.designation?.message} placeholder="e.g. Operator" {...register('designation')} />
            <SelectField label="Department" required error={errors.department?.message} {...register('department')}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </SelectField>
            <FormField label="Joining Date" required type="date" error={errors.joiningDate?.message} {...register('joiningDate')} />
            <SelectField label="Status" required error={errors.status?.message} {...register('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
            </SelectField>
            <FormField label="Current Salary (৳)" type="number" min={0} error={errors.currentSalary?.message} {...register('currentSalary')} />
          </div>
          <TextareaField label="Address" error={errors.address?.message} placeholder="Optional" rows={2} {...register('address')} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
