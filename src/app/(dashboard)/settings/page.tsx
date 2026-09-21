'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, Pencil, Loader2, X, Building2, Lock, Users, Ruler, Warehouse as WarehouseIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { FormField, SelectField } from '@/components/forms/FormField';
import { cn } from '@/lib/formatters';
import { useAppSelector } from '@/lib/store/hooks';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useChangePasswordMutation,
} from '@/features/settings/services/settingsApi';
import type { UserRecord } from '@/features/settings/types';

// ── Schemas ───────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  role: z.enum(['admin', 'manager', 'staff']),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'manager', 'staff']),
});
type EditUserForm = z.infer<typeof editUserSchema>;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = 'company' | 'users' | 'password';

const LINK_TABS = [
  { href: '/settings/uom', label: 'Units of Measure', icon: Ruler },
  { href: '/settings/warehouses', label: 'Warehouses', icon: WarehouseIcon },
];

// ── User Dialog ───────────────────────────────────────────────────────────────

function UserDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user?: UserRecord | null;
  onClose: () => void;
}) {
  const isEdit = !!user;
  const [create, { isLoading: creating }] = useCreateUserMutation();
  const [update, { isLoading: updating }] = useUpdateUserMutation();
  const isLoading = creating || updating;

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'staff' },
  });
  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    values: user ? { name: user.name, role: user.role } : undefined,
  });

  async function onCreateSubmit(values: CreateUserForm) {
    try {
      await create(values).unwrap();
      toast.success('User created');
      onClose();
      createForm.reset();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to create user');
    }
  }

  async function onEditSubmit(values: EditUserForm) {
    try {
      await update({ id: user!._id, body: values }).unwrap();
      toast.success('User updated');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to update user');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-md bg-white rounded-none sm:rounded-xl shadow-lg z-10"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit User' : 'New User'}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isEdit ? (
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
            <FormField
              label="Name"
              required
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <SelectField
              label="Role"
              required
              error={editForm.formState.errors.role?.message}
              {...editForm.register('role')}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </SelectField>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} noValidate className="px-6 py-4 flex flex-col gap-4">
            <FormField
              label="Name"
              required
              placeholder="Full name"
              error={createForm.formState.errors.name?.message}
              {...createForm.register('name')}
            />
            <FormField
              label="Email"
              required
              type="email"
              placeholder="user@hcc.com"
              error={createForm.formState.errors.email?.message}
              {...createForm.register('email')}
            />
            <FormField
              label="Password"
              required
              type="password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              error={createForm.formState.errors.password?.message}
              {...createForm.register('password')}
            />
            <SelectField
              label="Role"
              required
              error={createForm.formState.errors.role?.message}
              {...createForm.register('role')}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </SelectField>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={isLoading} className="h-10 px-4 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button type="submit" disabled={isLoading} className="h-10 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Create User
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Company Info Tab ──────────────────────────────────────────────────────────

function CompanyInfoTab() {
  return (
    <div className="bg-white rounded-lg border border-border p-6 max-w-2xl">
      <h2 className="text-base font-semibold text-foreground mb-4">Company Information</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {[
          { label: 'Company Name', value: 'Health Care Cosmetics Ltd.' },
          { label: 'Country', value: 'Bangladesh' },
          { label: 'Currency', value: 'BDT (৳)' },
          { label: 'Warehouse', value: 'Main Warehouse (Single)' },
          { label: 'System Version', value: 'HCC ERP v1.0' },
          { label: 'Support', value: 'admin@hcc.com' },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="text-sm text-foreground mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Change Password Tab ───────────────────────────────────────────────────────

function ChangePasswordTab() {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(values: ChangePasswordForm) {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
      toast.success('Password changed successfully');
      reset();
    } catch (err: unknown) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Failed to change password');
    }
  }

  return (
    <div className="bg-white rounded-lg border border-border p-6 max-w-md">
      <h2 className="text-base font-semibold text-foreground mb-4">Change Password</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField
          label="Current Password"
          required
          type="password"
          placeholder="Enter current password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <FormField
          label="New Password"
          required
          type="password"
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormField
          label="Confirm New Password"
          required
          type="password"
          placeholder="Repeat new password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 px-6 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
}

// ── User Management Tab ───────────────────────────────────────────────────────

function UserManagementTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserRecord | null>(null);
  const currentUser = useAppSelector((s) => s.auth.user);

  const { data, isLoading, isError, refetch } = useGetUsersQuery();
  const [updateUser, { isLoading: toggling }] = useUpdateUserMutation();

  async function handleToggleActive() {
    if (!toggleTarget) return;
    try {
      await updateUser({
        id: toggleTarget._id,
        body: { isActive: !toggleTarget.isActive },
      }).unwrap();
      toast.success(`User ${toggleTarget.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update user');
    } finally {
      setToggleTarget(null);
    }
  }

  const columns: Column<UserRecord>[] = [
    {
      key: 'name',
      header: 'Name',
      priority: 'P1',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'email', header: 'Email', priority: 'P2' },
    {
      key: 'role',
      header: 'Role',
      priority: 'P1',
      render: (row) => (
        <span className="capitalize text-[13px]">{row.role}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      priority: 'P1',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: '',
      priority: 'P1',
      className: 'w-[80px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => { setEditUser(row); setDialogOpen(true); }}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit user"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          {row._id !== currentUser?._id && (
            <button
              onClick={() => setToggleTarget(row)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-medium min-h-[32px] transition-colors',
                row.isActive
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-emerald-700 hover:bg-emerald-50',
              )}
              title={row.isActive ? 'Deactivate' : 'Activate'}
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      ),
    },
  ];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setEditUser(null); setDialogOpen(true); }}
          className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          New User
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data.users ?? []}
        keyField="_id"
        isLoading={isLoading}
        emptyMessage="No users found."
      />

      <UserDialog
        open={dialogOpen}
        user={editUser}
        onClose={() => { setDialogOpen(false); setEditUser(null); }}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.isActive ? 'Deactivate User' : 'Activate User'}
        description={
          toggleTarget?.isActive
            ? `${toggleTarget.name} will no longer be able to log in.`
            : `${toggleTarget?.name} will be able to log in again.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.isActive ? 'danger' : 'default'}
        loading={toggling}
        onConfirm={handleToggleActive}
        onCancel={() => setToggleTarget(null)}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId | null) ?? 'company';
  const currentUser = useAppSelector((s) => s.auth.user);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and system configuration"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-stable">
        <Link
          href="/settings?tab=company"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
            activeTab === 'company' ? 'border-emerald text-emerald-700' : 'border-transparent text-secondary hover:text-foreground',
          )}
        >
          <Building2 size={16} aria-hidden="true" /> Company Info
        </Link>
        {LINK_TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-secondary hover:text-foreground transition-colors shrink-0"
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/settings?tab=users"
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
              activeTab === 'users' ? 'border-emerald text-emerald-700' : 'border-transparent text-secondary hover:text-foreground',
            )}
          >
            <Users size={16} aria-hidden="true" /> User Management
          </Link>
        )}
        <Link
          href="/settings?tab=password"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
            activeTab === 'password' ? 'border-emerald text-emerald-700' : 'border-transparent text-secondary hover:text-foreground',
          )}
        >
          <Lock size={16} aria-hidden="true" /> Change Password
        </Link>
      </div>

      {/* Tab content */}
      {activeTab === 'company' && <CompanyInfoTab />}
      {activeTab === 'password' && <ChangePasswordTab />}
      {activeTab === 'users' && <UserManagementTab />}
    </>
  );
}
