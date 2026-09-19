export interface StockBalanceRow {
  _id: string;
  item: { _id: string; name: string; sku: string; type: string; category: string; reorderLevel: number; costPrice: number };
  warehouse: { _id: string; name: string };
  quantity: number;
  valuation: number;
  isLowStock: boolean;
}

export interface StockMovementRow {
  _id: string;
  type: string;
  item: { _id: string; name: string; sku: string };
  warehouse: { _id: string; name: string };
  quantity: number;
  balanceAfter: number;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface ProductionOrderRow {
  _id: string;
  woNumber: string;
  product: { _id: string; name: string };
  status: string;
  plannedQty: number;
  actualOutputQty: number;
  wastageQty: number;
  startDate?: string;
  completedDate?: string;
}

export interface ProductionSummaryItem {
  _id: string;
  count: number;
  totalPlanned: number;
  totalOutput: number;
  totalWastage: number;
}

export interface SalesOrderRow {
  _id: string;
  orderNumber: string;
  customer: { _id: string; name: string; code: string };
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
}

export interface SalesSummaryStatusItem {
  _id: string;
  count: number;
  totalAmount: number;
}

export interface SalesTopCustomer {
  _id: string;
  customerName: string;
  totalAmount: number;
  count: number;
}

export interface SalesTopProduct {
  _id: string;
  itemName: string;
  sku: string;
  totalQty: number;
  totalRevenue: number;
}

export interface SalesSummary {
  orderSummary: SalesSummaryStatusItem[];
  invoiceSummary: { _id: string; count: number; totalAmount: number; paidAmount: number; dueAmount: number }[];
  topCustomers: SalesTopCustomer[];
  topProducts: SalesTopProduct[];
}

export interface PurchaseOrderRow {
  _id: string;
  poNumber: string;
  supplier: { _id: string; name: string; code: string };
  status: string;
  totalAmount: number;
  createdAt: string;
}

export interface PurchaseTopSupplier {
  _id: string;
  supplierName: string;
  totalAmount: number;
  count: number;
}

export interface PurchaseSummary {
  orderSummary: { _id: string; count: number; totalAmount: number }[];
  receivingSummary: { count: number; totalAmount: number };
  topSuppliers: PurchaseTopSupplier[];
  supplierDues: { _id: string; name: string; code: string; balance: number }[];
}

export interface ExpenseRow {
  _id: string;
  expenseNumber: string;
  category: { _id: string; name: string };
  description: string;
  amount: number;
  expenseDate: string;
  paidBy: string;
  status: string;
}

export interface FinanceSummaryReport {
  expenseByCategory: { _id: string; categoryName: string; total: number; count: number }[];
  expenseByStatus: { _id: string; total: number; count: number }[];
  payables: { total: number; count: number };
  receivables: { total: number; count: number };
}

export interface EmployeeRow {
  _id: string;
  employeeId: string;
  name: string;
  department: { _id: string; name: string };
  designation: string;
  joiningDate: string;
  status: string;
  currentSalary: number;
}

export interface AttendanceSummaryRow {
  _id: string;
  employeeName: string;
  employeeId: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  total: number;
}

export interface PayrollRow {
  _id: string;
  payrollNumber: string;
  employee: { _id: string; name: string; employeeId: string };
  period: { month: number; year: number };
  grossSalary: number;
  netSalary: number;
  status: string;
}

export interface PayrollTotals {
  _id: string;
  count: number;
  totalGross: number;
  totalNet: number;
}

export interface ReportPagination {
  page: number;
  pages: number;
  total: number;
  limit: number;
}
