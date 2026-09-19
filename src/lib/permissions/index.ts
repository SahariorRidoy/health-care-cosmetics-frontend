export const PERMISSIONS = {
  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',
  // Procurement
  PROCUREMENT_VIEW: 'procurement.view',
  PROCUREMENT_MANAGE: 'procurement.manage',
  // Production
  PRODUCTION_VIEW: 'production.view',
  PRODUCTION_MANAGE: 'production.manage',
  // Sales
  SALES_VIEW: 'sales.view',
  SALES_MANAGE: 'sales.manage',
  // Finance
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',
  // HR
  HR_VIEW: 'hr.view',
  HR_MANAGE: 'hr.manage',
  // Reports
  REPORTS_VIEW: 'reports.view',
  // Users
  USERS_MANAGE: 'users.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
