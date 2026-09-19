import { api } from '@/lib/store/api';
import type {
  CustomersResponse, CustomerResponse, CustomerDuesResponse, CustomerPaymentsResponse,
  SalesOrdersResponse, SalesOrderResponse,
  InvoicesResponse, InvoiceResponse,
  CustomerPaymentResponse,
} from '../types';

export const salesApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Customers
    getCustomers: build.query<CustomersResponse, { page?: number; search?: string; category?: string }>({
      query: (params) => ({ url: '/customers', params }),
      providesTags: ['Customer'],
    }),
    getCustomer: build.query<CustomerResponse, string>({
      query: (id) => `/customers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Customer', id }],
    }),
    getCustomerCategories: build.query<{ success: boolean; data: { categories: string[] } }, void>({
      query: () => '/customers/categories',
      providesTags: ['Customer'],
    }),
    createCustomer: build.mutation<CustomerResponse, {
      name: string; code: string; category: string;
      contactPerson?: string; phone?: string; email?: string; address?: string; creditLimit?: number;
    }>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: build.mutation<CustomerResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/customers/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Customer', { type: 'Customer', id }],
    }),
    deleteCustomer: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customer'],
    }),
    getCustomerDues: build.query<CustomerDuesResponse, string>({
      query: (id) => `/sales/customers/${id}/dues`,
      providesTags: (_r, _e, id) => [{ type: 'Customer', id }],
    }),
    getCustomerPayments: build.query<CustomerPaymentsResponse, { customerId: string; page?: number }>({
      query: ({ customerId, ...params }) => ({ url: `/sales/customers/${customerId}/payments`, params }),
      providesTags: ['CustomerPayment'],
    }),
    createCustomerPayment: build.mutation<CustomerPaymentResponse, {
      customer: string; invoice: string; amount: number;
      paymentDate?: string; method: string; reference?: string; notes?: string;
    }>({
      query: (body) => ({ url: '/sales/payments', method: 'POST', body }),
      invalidatesTags: ['CustomerPayment', 'Customer', 'Invoice'],
    }),

    // Sales Orders
    getSalesOrders: build.query<SalesOrdersResponse, { page?: number; search?: string; status?: string; customer?: string }>({
      query: (params) => ({ url: '/sales/orders', params }),
      providesTags: ['SalesOrder'],
    }),
    getSalesOrder: build.query<SalesOrderResponse, string>({
      query: (id) => `/sales/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesOrder', id }],
    }),
    createSalesOrder: build.mutation<SalesOrderResponse, {
      customer: string; warehouse: string;
      items: { item: string; description?: string; qty: number; unitPrice: number; discount: number; uom: string }[];
      taxPercent: number; notes?: string; deliveryDate?: string;
    }>({
      query: (body) => ({ url: '/sales/orders', method: 'POST', body }),
      invalidatesTags: ['SalesOrder'],
    }),
    updateSalesOrderStatus: build.mutation<SalesOrderResponse, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/sales/orders/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => ['SalesOrder', { type: 'SalesOrder', id }, 'Stock'],
    }),
    deleteSalesOrder: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/sales/orders/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SalesOrder'],
    }),

    // Invoices
    getInvoices: build.query<InvoicesResponse, { page?: number; customer?: string; status?: string }>({
      query: (params) => ({ url: '/sales/invoices', params }),
      providesTags: ['Invoice'],
    }),
    getInvoice: build.query<InvoiceResponse, string>({
      query: (id) => `/sales/invoices/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Invoice', id }],
    }),
    createInvoice: build.mutation<InvoiceResponse, {
      customer: string; salesOrder?: string;
      items: { item: string; description?: string; qty: number; unitPrice: number; discount: number; uom: string }[];
      taxPercent: number; dueDate?: string; notes?: string;
    }>({
      query: (body) => ({ url: '/sales/invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice', 'Customer'],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useGetCustomerCategoriesQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetCustomerDuesQuery,
  useGetCustomerPaymentsQuery,
  useCreateCustomerPaymentMutation,
  useGetSalesOrdersQuery,
  useGetSalesOrderQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderStatusMutation,
  useDeleteSalesOrderMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
} = salesApi;
