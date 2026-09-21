'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/lib/store/hooks';
import { Plus, Pencil, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ErrorState, StatusBadge, ConfirmDialog } from '@/components/feedback';
import { cn } from '@/lib/formatters';
import { Building2, Lock, Users, Ruler, Warehouse as WarehouseIcon } from 'lucide-react';
import { useGetWarehousesQuery, useUpdateWarehouseMutation } from '@/features/inventory/services/inventoryApi';
import { WarehouseFormDialog } from '@/features/inventory/components/WarehouseFormDialog';
import type { Warehouse } from '@/features/inventory/types';
import { toast } from 'sonner';

const SETTINGS_TABS = [
  { id: 'company', label: 'Company Info', icon: Building2, href: '/settings?tab=company' },
  { id: 'uom', label: 'Units of Measure', icon: Ruler, href: '/settings/uom' },
  { id: 'warehouses', label: 'Warehouses', icon: WarehouseIcon, href: '/settings/warehouses' },
  { id: 'users', label: 'User Management', icon: Users, href: '/settings?tab=users' },
  { id: 'password', label: 'Change Password', icon: Lock, href: '/settings?tab=password' },
];

export default function WarehousesPage() {
  const pathname = usePathname();
  const currentUser = useAppSelector((s) => s.auth.user);
  const isAdmin = currentUser?.role === 'admin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Warehouse | null>(null);

  const { data, isLoading, isError, refetch } = useGetWarehousesQuery();
  const [updateWarehouse, { isLoading: toggling }] = useUpdateWarehouseMutation();

  const warehouses = data?.data?.warehouses ?? [];

  async function handleToggleActive() {
    if (!deactivateTarget) return;
    try {
      await updateWarehouse({ id: deactivateTarget._id, body: { isActive: !deactivateTarget.isActive } }).unwrap();
      toast.success(`Warehouse ${deactivateTarget.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update warehouse');
    } finally {
      setDeactivateTarget(null);
    }
  }

  const columns: Column<Warehouse>[] = [
    {
      key: 'name', header: 'Name', priority: 'P1',
      render: (row) => (
        <span className="font-medium flex items-center gap-1.5">
          {row.name}
          {row.isDefault && <Star size={12} className="text-amber-500 fill-amber-400" aria-label="Default" />}
        </span>
      ),
    },
    { key: 'code', header: 'Code', priority: 'P1' },
    { key: 'address', header: 'Address', priority: 'P3', render: (row) => row.address ?? '—' },
    {
      key: 'isActive', header: 'Status', priority: 'P1',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions', header: '', priority: 'P1', className: 'w-[100px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => { setEditWarehouse(row); setDialogOpen(true); }}
            className="p-1.5 rounded-md text-secondary hover:bg-slate-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Edit warehouse" title="Edit"
          >
            <Pencil size={15} />
          </button>
          {!row.isDefault && (
            <button
              onClick={() => setDeactivateTarget(row)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-medium min-h-[32px] transition-colors',
                row.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50',
              )}
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and system configuration"
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Warehouses' }]}
      />

      {/* Settings tab bar */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {SETTINGS_TABS.filter(({ id }) => id !== 'users' || isAdmin).map(({ id, label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <Link key={id} href={href} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0', active ? 'border-emerald text-emerald-700' : 'border-transparent text-secondary hover:text-foreground')}>
              <Icon size={16} aria-hidden="true" />{label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-secondary">Manage storage locations. The default warehouse is used automatically for new transactions.</p>
        <button
          onClick={() => { setEditWarehouse(null); setDialogOpen(true); }}
          className="h-9 px-4 rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-colors shrink-0 ml-4"
        >
          <Plus size={16} aria-hidden="true" /> New Warehouse
        </button>
      </div>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={warehouses}
          keyField="_id"
          isLoading={isLoading}
          emptyMessage="No warehouses yet. Create one to get started."
        />
      )}

      <WarehouseFormDialog
        open={dialogOpen}
        warehouse={editWarehouse}
        onClose={() => { setDialogOpen(false); setEditWarehouse(null); }}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        title={deactivateTarget?.isActive ? 'Deactivate Warehouse' : 'Activate Warehouse'}
        description={
          deactivateTarget?.isActive
            ? `"${deactivateTarget.name}" will be hidden from new transactions.`
            : `"${deactivateTarget?.name}" will be available for transactions again.`
        }
        confirmLabel={deactivateTarget?.isActive ? 'Deactivate' : 'Activate'}
        variant={deactivateTarget?.isActive ? 'danger' : 'default'}
        loading={toggling}
        onConfirm={handleToggleActive}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
  );
}
