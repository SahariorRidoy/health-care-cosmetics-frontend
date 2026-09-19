export type ExpenseStatus = 'PENDING' | 'PAID';

export interface ExpenseCategory {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Expense {
  _id: string;
  expenseNumber: string;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  expenseDate: string;
  paidBy: string;
  status: ExpenseStatus;
  reference?: string;
  notes?: string;
  isActive: boolean;
  createdBy: { _id: string; name: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  expenses: {
    paid: { total: number; count: number };
    pending: { total: number; count: number };
    total: number;
    byCategory: { _id: string; categoryName: string; total: number; count: number }[];
  };
  payables: { total: number; supplierCount: number };
  receivables: { total: number; customerCount: number };
  period: { from: string | null; to: string | null };
}

// API response shapes
export interface ExpenseCategoriesResponse {
  success: boolean;
  data: { categories: ExpenseCategory[] };
}
export interface ExpenseCategoryResponse {
  success: boolean;
  data: { category: ExpenseCategory };
}
export interface ExpensesResponse {
  success: boolean;
  data: { expenses: Expense[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface ExpenseResponse {
  success: boolean;
  data: { expense: Expense };
}
export interface FinanceSummaryResponse {
  success: boolean;
  data: FinanceSummary;
}
