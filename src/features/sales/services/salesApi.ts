import { api } from '@/lib/store/api';
import type {
  DealersResponse, DealerResponse, DealerDuesResponse, CustomerPaymentsResponse,
  SalesOrdersResponse, SalesOrderResponse,
  InvoicesResponse, InvoiceResponse,
  CustomerPaymentResponse,
  AllPaymentsResponse,
} from '../types';

export const salesApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Dealers
    getDealers: build.query<DealersResponse, { page?: number; search?: string }>({
      query: (params) => ({ url: '/dealers', params }),
      providesTags: ['Dealer'],
    }),
    getDealer: build.query<DealerResponse, string>({
      query: (id) => `/dealers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Dealer', id }],
    }),
    createDealer: build.mutation<DealerResponse, {
      name: string; phone?: string; email?: string; address?: string; commissionRate?: number;
    }>({
      query: (body) => ({ url: '/dealers', method: 'POST', body }),
      invalidatesTags: ['Dealer'],
    }),
    updateDealer: build.mutation<DealerResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/dealers/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Dealer', { type: 'Dealer', id }],
    }),
    deleteDealer: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/dealers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Dealer'],
    }),
    getDealerDues: build.query<DealerDuesResponse, string>({
      query: (id) => `/sales/dealers/${id}/dues`,
      providesTags: (_r, _e, id) => [{ type: 'Dealer', id }],
    }),
    getDealerPayments: build.query<CustomerPaymentsResponse, { dealerId: string; page?: number }>({
      query: ({ dealerId, ...params }) => ({ url: `/sales/dealers/${dealerId}/payments`, params }),
      providesTags: ['CustomerPayment'],
    }),
    getAllPayments: build.query<AllPaymentsResponse, { page?: number; search?: string; method?: string; dateFrom?: string; dateTo?: string }>({
      query: (params) => ({ url: '/sales/payments', params }),
      providesTags: ['CustomerPayment'],
    }),
    getCustomerPayment: build.query<CustomerPaymentResponse, string>({
      query: (id) => `/sales/payments/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'CustomerPayment', id }],
    }),
    createCustomerPayment: build.mutation<CustomerPaymentResponse, {
      dealer: string; invoice: string; amount: number;
      paymentDate?: string; method: string; reference?: string; notes?: string;
    }>({
      query: (body) => ({ url: '/sales/payments', method: 'POST', body }),
      invalidatesTags: (_r, _e, arg) => [
        'CustomerPayment',
        'Dealer',
        'Invoice',
        'SalesOrder',
        { type: 'Invoice', id: arg.invoice },
      ],
    }),

    // Sales Orders
    getSalesOrders: build.query<SalesOrdersResponse, { page?: number; search?: string; status?: string; dealer?: string }>({
      query: (params) => ({ url: '/sales/orders', params }),
      providesTags: ['SalesOrder'],
    }),
    getSalesOrder: build.query<SalesOrderResponse, string>({
      query: (id) => `/sales/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesOrder', id }],
    }),
    createSalesOrder: build.mutation<SalesOrderResponse, {
      dealer: string; warehouse: string;
      items: { item: string; description?: string; qty: number; giftQty?: number; unitPrice: number; commissionRate: number; uom: string }[];
      taxPercent: number; commissionRate: number; notes?: string;
      payment?: { amount: number; method: string; reference?: string; notes?: string };
    }>({
      query: (body) => ({ url: '/sales/orders', method: 'POST', body }),
      invalidatesTags: ['SalesOrder', 'Invoice', 'CustomerPayment', 'Stock'],
    }),
    updateSalesOrder: build.mutation<SalesOrderResponse, {
      id: string;
      body: { notes?: string };
    }>({
      query: ({ id, body }) => ({ url: `/sales/orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['SalesOrder', { type: 'SalesOrder', id }, 'Invoice', 'CustomerPayment', 'Stock'],
    }),
    cancelSalesOrder: build.mutation<SalesOrderResponse, string>({
      query: (id) => ({ url: `/sales/orders/${id}/cancel`, method: 'PATCH' }),
      invalidatesTags: (_r, _e, id) => ['SalesOrder', { type: 'SalesOrder', id }],
    }),
    deleteSalesOrder: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/sales/orders/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SalesOrder'],
    }),

    // Invoices
    getInvoices: build.query<InvoicesResponse, { page?: number; dealer?: string; status?: string; search?: string; dateFrom?: string; dateTo?: string }>({
      query: (params) => ({ url: '/sales/invoices', params }),
      providesTags: ['Invoice'],
    }),
    getInvoice: build.query<InvoiceResponse, string>({
      query: (id) => `/sales/invoices/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Invoice', id }],
    }),
    updateInvoice: build.mutation<InvoiceResponse, {
      id: string;
      body: {
        items: { item: string; description?: string; qty: number; unitPrice: number; discount: number; uom: string }[];
        taxPercent: number; dueDate?: string; notes?: string;
      };
    }>({
      query: ({ id, body }) => ({ url: `/sales/invoices/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Invoice', { type: 'Invoice', id }, 'SalesOrder', 'Dealer'],
    }),
    updateCustomerPayment: build.mutation<CustomerPaymentResponse, {
      id: string; body: { amount: number; method: string; paymentDate?: string; reference?: string; notes?: string };
    }>({
      query: ({ id, body }) => ({ url: `/sales/payments/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['CustomerPayment', { type: 'CustomerPayment', id }, 'Invoice', 'SalesOrder', 'Dealer'],
    }),
    deleteInvoice: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/sales/invoices/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => ['Invoice', { type: 'Invoice', id }, 'SalesOrder', 'Dealer'],
    }),
    deletePayment: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/sales/payments/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => ['CustomerPayment', { type: 'CustomerPayment', id }, 'Invoice', 'Dealer'],
    }),
    createInvoice: build.mutation<InvoiceResponse, {
      dealer: string; salesOrder?: string;
      items: { item: string; description?: string; qty: number; unitPrice: number; discount: number; uom: string }[];
      taxPercent: number; commissionRate?: number; dueDate?: string; notes?: string;
    }>({
      query: (body) => ({ url: '/sales/invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice', 'Dealer'],
    }),
  }),
});

export const {
  useGetDealersQuery,
  useGetDealerQuery,
  useCreateDealerMutation,
  useUpdateDealerMutation,
  useDeleteDealerMutation,
  useGetDealerDuesQuery,
  useGetDealerPaymentsQuery,
  useGetAllPaymentsQuery,
  useGetCustomerPaymentQuery,
  useCreateCustomerPaymentMutation,
  useGetSalesOrdersQuery,
  useGetSalesOrderQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useCancelSalesOrderMutation,
  useDeleteSalesOrderMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useUpdateInvoiceMutation,
  useDeleteInvoiceMutation,
  useCreateInvoiceMutation,
  useDeletePaymentMutation,
  useUpdateCustomerPaymentMutation,
} = salesApi;
