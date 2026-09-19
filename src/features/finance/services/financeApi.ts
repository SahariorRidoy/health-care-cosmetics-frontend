import { api } from '@/lib/store/api';
import type {
  ExpenseCategoriesResponse, ExpenseCategoryResponse,
  ExpensesResponse, ExpenseResponse,
  FinanceSummaryResponse,
} from '../types';

export const financeApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Categories
    getExpenseCategories: build.query<ExpenseCategoriesResponse, void>({
      query: () => '/finance/categories',
      providesTags: ['ExpenseCategory'],
    }),
    createExpenseCategory: build.mutation<ExpenseCategoryResponse, { name: string; description?: string }>({
      query: (body) => ({ url: '/finance/categories', method: 'POST', body }),
      invalidatesTags: ['ExpenseCategory'],
    }),
    updateExpenseCategory: build.mutation<ExpenseCategoryResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/finance/categories/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['ExpenseCategory'],
    }),
    deleteExpenseCategory: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/finance/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ExpenseCategory'],
    }),

    // Expenses
    getExpenses: build.query<ExpensesResponse, { page?: number; category?: string; status?: string; from?: string; to?: string }>({
      query: (params) => ({ url: '/finance/expenses', params }),
      providesTags: ['Expense'],
    }),
    getExpense: build.query<ExpenseResponse, string>({
      query: (id) => `/finance/expenses/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Expense', id }],
    }),
    createExpense: build.mutation<ExpenseResponse, {
      category: string; description: string; amount: number;
      expenseDate?: string; paidBy: string; status: string;
      reference?: string; notes?: string;
    }>({
      query: (body) => ({ url: '/finance/expenses', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    updateExpense: build.mutation<ExpenseResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/finance/expenses/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Expense', { type: 'Expense', id }],
    }),
    updateExpenseStatus: build.mutation<ExpenseResponse, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/finance/expenses/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => ['Expense', { type: 'Expense', id }],
    }),
    deleteExpense: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/finance/expenses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Expense'],
    }),

    // Summary
    getFinanceSummary: build.query<FinanceSummaryResponse, { from?: string; to?: string }>({
      query: (params) => ({ url: '/finance/summary', params }),
      providesTags: ['Expense'],
    }),
  }),
});

export const {
  useGetExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
  useGetExpensesQuery,
  useGetExpenseQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useUpdateExpenseStatusMutation,
  useDeleteExpenseMutation,
  useGetFinanceSummaryQuery,
} = financeApi;
