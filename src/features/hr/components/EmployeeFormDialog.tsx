'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { FormField, SelectField, TextareaField } from '@/components/forms/FormField';
import {
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useGetDepartmentsQuery,
  useCreateSalaryStructureMutation,
} from '../services/hrApi';
import type { Employee } from '../types';

// ── Step 1: Employee info ─────────────────────────────────────────────────────
const empSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email').trim().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required').trim(),
  joiningDate: z.string().min(1, 'Joining date is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']),
});
type EmpValues = z.infer<typeof empSchema>;

// ── Step 2: Salary structure ──────────────────────────────────────────────────
const lineItem = z.object({ label: z.string().min(1, 'Label required'), amount: z.coerce.number().min(0) });
const salarySchema = z.object({
  baseSalary: z.coerce.number().min(1, 'Base salary is required'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  allowances: z.array(lineItem),
  deductions: z.array(lineItem),
});
type SalaryValues = z.infer<typeof salarySchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

export function EmployeeFormDialog({ open, onClose, employee }: Props) {
  const isEdit = !!employee;
  const [step, setStep] = useState<1 | 2>(1);

  const [createEmployee, { isLoading: creating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: updating }] = useUpdateEmployeeMutation();
  const [createSalary, { isLoading: savingSalary }] = useCreateSalaryStructureMutation();
  const { data: deptData } = useGetDepartmentsQuery();
  const departments = deptData?.data?.departments ?? [];

  // Step 1 form
  const empForm = useForm<EmpValues>({
    resolver: zodResolver(empSchema),
    defaultValues: { status: 'ACTIVE' },
  });

  // Step 2 form
  const salaryForm = useForm<SalaryValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: { baseSalary: 0, effectiveDate: new Date().toISOString().slice(0, 10), allowances: [], deductions: [] },
  });
  const { fields: allowanceFields, append: addAllowance, remove: removeAllowance } = useFieldArray({ control: salaryForm.control, name: 'allowances' });
  const { fields: deductionFields, append: addDeduction, remove: removeDeduction } = useFieldArray({ control: salaryForm.control, name: 'deductions' });

  useEffect(() => {
    if (open) {
      setStep(1);
      if (employee) {
        empForm.reset({
          name: employee.name,
          email: employee.email ?? '',
          phone: employee.phone ?? '',
          address: employee.address ?? '',
          department: typeof employee.department === 'object' ? employee.department._id : employee.department,
          designation: employee.designation,
          joiningDate: employee.joiningDate.slice(0, 10),
          status: employee.status,
        });
      } else {
        empForm.reset({ name: '', email: '', phone: '', address: '', department: '', designation: '', joiningDate: new Date().toISOString().slice(0, 10), status: 'ACTIVE' });
        salaryForm.reset({ baseSalary: 0, effectiveDate: new Date().toISOString().slice(0, 10), allowances: [], deductions: [] });
      }
    }
  }, [open, employee]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode: just save employee info and close
  async function handleEditSubmit(values: EmpValues) {
    try {
      await updateEmployee({ id: employee!._id, body: { ...values, email: values.email || undefined } }).unwrap();
      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  // Create mode step 1: validate and go to step 2
  async function handleStep1Next(values: EmpValues) {
    // store values and advance — actual API call happens after step 2
    empForm.reset(values);
    setStep(2);
  }

  // Create mode step 2: create employee then salary structure
  async function handleStep2Submit(salaryValues: SalaryValues) {
    try {
      const empValues = empForm.getValues();
      const emp = await createEmployee({
        ...empValues,
        email: empValues.email || undefined,
        currentSalary: salaryValues.baseSalary,
      }).unwrap();

      await createSalary({
        employee: emp.data.employee._id,
        baseSalary: salaryValues.baseSalary,
        allowances: salaryValues.allowances,
        deductions: salaryValues.deductions,
        effectiveDate: salaryValues.effectiveDate,
      }).unwrap();

      onClose();
    } catch { /* surfaced by RTK Query */ }
  }

  if (!open) return null;

  const isLoading = creating || updating || savingSalary;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="emp-dialog-title"
        className="relative w-full sm:max-w-lg bg-white rounded-none sm:rounded-xl shadow-lg p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 id="emp-dialog-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Employee' : step === 1 ? 'New Employee' : 'Salary Structure'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator — create only */}
        {!isEdit && (
          <div className="flex items-center gap-2 mb-5 mt-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step === s ? 'bg-emerald text-white' : step > s ? 'bg-emerald-100 text-emerald' : 'bg-slate-100 text-secondary'
                }`}>
                  {s}
                </div>
                <span className={`text-xs ${step === s ? 'text-foreground font-medium' : 'text-secondary'}`}>
                  {s === 1 ? 'Employee Info' : 'Salary Structure'}
                </span>
                {s < 2 && <ChevronRight size={14} className="text-secondary" />}
              </div>
            ))}
          </div>
        )}

        {/* ── Step 1 / Edit form ── */}
        {(step === 1 || isEdit) && (
          <form onSubmit={empForm.handleSubmit(isEdit ? handleEditSubmit : handleStep1Next)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name" required error={empForm.formState.errors.name?.message} placeholder="e.g. Rahim Uddin" {...empForm.register('name')} />
              <FormField label="Email" error={empForm.formState.errors.email?.message} type="email" placeholder="email@example.com" {...empForm.register('email')} />
              <FormField label="Phone" error={empForm.formState.errors.phone?.message} placeholder="+880..." {...empForm.register('phone')} />
              <FormField label="Designation" required error={empForm.formState.errors.designation?.message} placeholder="e.g. Operator" {...empForm.register('designation')} />
              <SelectField label="Department" required error={empForm.formState.errors.department?.message} {...empForm.register('department')}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </SelectField>
              <FormField label="Joining Date" required type="date" error={empForm.formState.errors.joiningDate?.message} {...empForm.register('joiningDate')} />
              <SelectField label="Status" required error={empForm.formState.errors.status?.message} {...empForm.register('status')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
              </SelectField>
            </div>
            <TextareaField label="Address" error={empForm.formState.errors.address?.message} placeholder="Optional" rows={2} {...empForm.register('address')} />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? 'Save Changes' : <><span>Next</span><ChevronRight size={14} /></>}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Salary structure ── */}
        {step === 2 && !isEdit && (
          <form onSubmit={salaryForm.handleSubmit(handleStep2Submit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Base Salary (৳)" required type="number" min={0} error={salaryForm.formState.errors.baseSalary?.message} {...salaryForm.register('baseSalary')} />
              <FormField label="Effective Date" required type="date" error={salaryForm.formState.errors.effectiveDate?.message} {...salaryForm.register('effectiveDate')} />
            </div>

            {/* Allowances */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">Allowances</span>
                <button type="button" onClick={() => addAllowance({ label: '', amount: 0 })} className="text-xs text-emerald hover:underline flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              {allowanceFields.length === 0 && <p className="text-xs text-muted mb-2">No allowances added.</p>}
              {allowanceFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <input placeholder="e.g. House Allowance" {...salaryForm.register(`allowances.${i}.label`)} className="h-9 flex-1 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                  <input type="number" min={0} placeholder="Amount" {...salaryForm.register(`allowances.${i}.amount`)} className="h-9 w-28 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                  <button type="button" onClick={() => removeAllowance(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={14} /></button>
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
              {deductionFields.length === 0 && <p className="text-xs text-muted mb-2">No deductions added.</p>}
              {deductionFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <input placeholder="e.g. Tax" {...salaryForm.register(`deductions.${i}.label`)} className="h-9 flex-1 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                  <input type="number" min={0} placeholder="Amount" {...salaryForm.register(`deductions.${i}.amount`)} className="h-9 w-28 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald" />
                  <button type="button" onClick={() => removeDeduction(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              <button type="button" onClick={() => setStep(1)} className="h-10 px-4 rounded-md border border-border text-sm hover:bg-slate-50 transition-colors flex items-center gap-1">
                <ChevronLeft size={14} /> Back
              </button>
              <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                Create Employee
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
