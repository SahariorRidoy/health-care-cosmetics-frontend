import { api } from '@/lib/store/api';
import type {
  StockBalanceRow, StockMovementRow,
  ProductionOrderRow, ProductionSummaryItem,
  SalesOrderRow, SalesSummary,
  PurchaseOrderRow, PurchaseSummary,
  ExpenseRow, FinanceSummaryReport,
  EmployeeRow, AttendanceSummaryRow, PayrollRow, PayrollTotals,
  ReportPagination,
} from '../types';

type Paged<K extends string, T> = { success: boolean; data: Record<K, T[]>; pagination: ReportPagination };

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ── Stock ──────────────────────────────────────────────────────────────
    getStockBalanceReport: build.query<Paged<'balances', StockBalanceRow>, { page?: number; warehouse?: string; lowStock?: boolean }>({
      query: (params) => ({ url: '/reports/stock/balance', params }),
      providesTags: ['Report'],
    }),
    getStockMovementReport: build.query<Paged<'movements', StockMovementRow>, { page?: number; item?: string; type?: string; from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/stock/movements', params }),
      providesTags: ['Report'],
    }),

    // ── Production ─────────────────────────────────────────────────────────
    getProductionReport: build.query<Paged<'orders', ProductionOrderRow>, { page?: number; status?: string; from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/production', params }),
      providesTags: ['Report'],
    }),
    getProductionSummary: build.query<{ success: boolean; data: { summary: ProductionSummaryItem[] } }, { from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/production/summary', params }),
      providesTags: ['Report'],
    }),

    // ── Sales ──────────────────────────────────────────────────────────────
    getSalesReport: build.query<Paged<'orders', SalesOrderRow>, { page?: number; status?: string; from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/sales', params }),
      providesTags: ['Report'],
    }),
    getSalesSummary: build.query<{ success: boolean; data: SalesSummary }, { from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/sales/summary', params }),
      providesTags: ['Report'],
    }),

    // ── Purchase ───────────────────────────────────────────────────────────
    getPurchaseReport: build.query<Paged<'orders', PurchaseOrderRow>, { page?: number; status?: string; from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/purchase', params }),
      providesTags: ['Report'],
    }),
    getPurchaseSummary: build.query<{ success: boolean; data: PurchaseSummary }, { from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/purchase/summary', params }),
      providesTags: ['Report'],
    }),

    // ── Finance ────────────────────────────────────────────────────────────
    getFinanceReport: build.query<Paged<'expenses', ExpenseRow>, { page?: number; status?: string; from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/finance', params }),
      providesTags: ['Report'],
    }),
    getFinanceSummaryReport: build.query<{ success: boolean; data: FinanceSummaryReport }, { from?: string; to?: string }>({
      query: (params) => ({ url: '/reports/finance/summary', params }),
      providesTags: ['Report'],
    }),

    // ── HR ─────────────────────────────────────────────────────────────────
    getEmployeeListReport: build.query<Paged<'employees', EmployeeRow>, { page?: number; department?: string }>({
      query: (params) => ({ url: '/reports/hr/employees', params }),
      providesTags: ['Report'],
    }),
    getAttendanceSummaryReport: build.query<{ success: boolean; data: { summary: AttendanceSummaryRow[] } }, { from?: string; to?: string; employee?: string }>({
      query: (params) => ({ url: '/reports/hr/attendance', params }),
      providesTags: ['Report'],
    }),
    getPayrollSummaryReport: build.query<{ success: boolean; data: { payrolls: PayrollRow[]; totals: PayrollTotals[] }; pagination: ReportPagination }, { page?: number; month?: number; year?: number }>({
      query: (params) => ({ url: '/reports/hr/payroll', params }),
      providesTags: ['Report'],
    }),
  }),
});

export const {
  useGetStockBalanceReportQuery,
  useGetStockMovementReportQuery,
  useGetProductionReportQuery,
  useGetProductionSummaryQuery,
  useGetSalesReportQuery,
  useGetSalesSummaryQuery,
  useGetPurchaseReportQuery,
  useGetPurchaseSummaryQuery,
  useGetFinanceReportQuery,
  useGetFinanceSummaryReportQuery,
  useGetEmployeeListReportQuery,
  useGetAttendanceSummaryReportQuery,
  useGetPayrollSummaryReportQuery,
} = reportsApi;
