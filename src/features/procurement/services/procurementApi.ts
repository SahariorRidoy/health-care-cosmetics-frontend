import { api } from '@/lib/store/api';
import type {
  SuppliersResponse, SupplierResponse, CreateSupplierPayload,
  SupplierPaymentsResponse, SupplierDuesResponse,
  POsResponse, POResponse, GRsResponse, GRResponse,
} from '../types';

export const procurementApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query<SuppliersResponse, { page?: number; search?: string; isActive?: string }>({
      query: (params) => ({ url: '/suppliers', params }),
      providesTags: ['Supplier'],
    }),
    getSupplier: build.query<SupplierResponse, string>({
      query: (id) => `/suppliers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Supplier', id }],
    }),
    createSupplier: build.mutation<SupplierResponse, CreateSupplierPayload>({
      query: (body) => ({ url: '/suppliers', method: 'POST', body }),
      invalidatesTags: ['Supplier'],
    }),
    updateSupplier: build.mutation<SupplierResponse, { id: string; body: Partial<CreateSupplierPayload> & { isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: `/suppliers/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Supplier', { type: 'Supplier', id }],
    }),
    deleteSupplier: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/suppliers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Supplier'],
    }),
    getSupplierPayments: build.query<SupplierPaymentsResponse, { supplierId: string; page?: number }>({
      query: ({ supplierId, ...params }) => ({ url: `/procurement/suppliers/${supplierId}/payments`, params }),
      providesTags: ['SupplierPayment'],
    }),
    getSupplierDues: build.query<SupplierDuesResponse, string>({
      query: (supplierId) => `/procurement/suppliers/${supplierId}/dues`,
      providesTags: (_r, _e, id) => [{ type: 'Supplier', id }, 'SupplierPayment'],
    }),
    createSupplierPayment: build.mutation<{ success: boolean }, { supplier: string; purchaseOrder?: string; amount: number; paymentDate: string; method: string; reference?: string; notes?: string }>({
      query: (body) => ({ url: '/procurement/payments', method: 'POST', body }),
      invalidatesTags: (_r, _e, { supplier }) => [
        'SupplierPayment',
        { type: 'Supplier', id: supplier },
        'Supplier',
        'PurchaseOrder',
      ],
    }),
    getPurchaseOrders: build.query<POsResponse, { page?: number; search?: string; status?: string; supplier?: string }>({
      query: (params) => ({ url: '/purchase-orders', params }),
      providesTags: ['PurchaseOrder'],
    }),
    getPurchaseOrder: build.query<POResponse, string>({
      query: (id) => `/purchase-orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'PurchaseOrder', id }],
    }),
    createPurchaseOrder: build.mutation<POResponse, { supplier: string; items: { item: string; orderedQty: number; unitPrice: number; uom: string; description?: string }[]; notes?: string; expectedDeliveryDate?: string }>({
      query: (body) => ({ url: '/purchase-orders', method: 'POST', body }),
      invalidatesTags: ['PurchaseOrder'],
    }),
    updatePOStatus: build.mutation<POResponse, { id: string; status: 'CONFIRMED' | 'CLOSED' }>({
      query: ({ id, status }) => ({ url: `/purchase-orders/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => ['PurchaseOrder', { type: 'PurchaseOrder', id }],
    }),
    getGoodsReceipts: build.query<GRsResponse, { page?: number; purchaseOrder?: string; supplier?: string; item?: string }>({
      query: (params) => ({ url: '/procurement/receipts', params }),
      providesTags: ['GoodsReceipt'],
    }),
    getGoodsReceipt: build.query<GRResponse, string>({
      query: (id) => `/procurement/receipts/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'GoodsReceipt', id }],
    }),
    createGoodsReceipt: build.mutation<GRResponse, { purchaseOrder: string; warehouse: string; items: { item: string; receivedQty: number; unitPrice: number; uom: string; batchNumber?: string; expiryDate?: string }[]; notes?: string; receivedDate?: string }>({
      query: (body) => ({ url: '/procurement/receipts', method: 'POST', body }),
      invalidatesTags: ['GoodsReceipt', 'PurchaseOrder', 'Stock'],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useGetSupplierPaymentsQuery,
  useGetSupplierDuesQuery,
  useCreateSupplierPaymentMutation,
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePOStatusMutation,
  useGetGoodsReceiptsQuery,
  useGetGoodsReceiptQuery,
  useCreateGoodsReceiptMutation,
} = procurementApi;
