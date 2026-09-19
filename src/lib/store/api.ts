import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { RootState } from './index';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    // Attempt token refresh
    const refreshResult = await baseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions,
    );

    if (refreshResult.data) {
      const { setCredentials } = await import('./authSlice');
      api.dispatch(setCredentials(refreshResult.data as { accessToken: string; user: unknown }));
      result = await baseQuery(args, api, extraOptions);
    } else {
      const { clearCredentials } = await import('./authSlice');
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User', 'UOM', 'Warehouse', 'Item', 'Stock', 'Batch',
    'Supplier', 'PurchaseOrder', 'GoodsReceipt', 'SupplierPayment',
    'Production', 'BOM',
    'Customer', 'SalesOrder', 'Invoice', 'CustomerPayment',
    'Expense', 'ExpenseCategory',
    'Department', 'Employee', 'Attendance', 'Leave', 'Payroll',
    'Report',
  ],
  endpoints: () => ({}),
});
