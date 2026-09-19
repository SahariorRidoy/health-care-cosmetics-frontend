import { api } from '@/lib/store/api';
import type {
  BOMsResponse, BOMResponse, ProductionOrdersResponse, ProductionOrderResponse, AvailabilityResponse,
} from '../types';

export const productionApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBOMs: build.query<BOMsResponse, { page?: number; search?: string; isActive?: string }>({
      query: (params) => ({ url: '/production/boms', params }),
      providesTags: ['BOM'],
    }),
    getBOM: build.query<BOMResponse, string>({
      query: (id) => `/production/boms/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'BOM', id }],
    }),
    createBOM: build.mutation<BOMResponse, {
      product: string; version?: string;
      inputMaterials: { item: string; qty: number; uom: string }[];
      expectedOutputQty: number; outputUom: string;
      wastagePercent?: number; notes?: string;
    }>({
      query: (body) => ({ url: '/production/boms', method: 'POST', body }),
      invalidatesTags: ['BOM'],
    }),
    updateBOM: build.mutation<BOMResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/production/boms/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['BOM', { type: 'BOM', id }],
    }),
    deleteBOM: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/production/boms/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BOM'],
    }),
    checkAvailability: build.query<AvailabilityResponse, { bom: string; qty: number; warehouse: string }>({
      query: (params) => ({ url: '/production/availability', params }),
    }),
    getProductionOrders: build.query<ProductionOrdersResponse, { page?: number; search?: string; status?: string }>({
      query: (params) => ({ url: '/production/orders', params }),
      providesTags: ['Production'],
    }),
    getProductionOrder: build.query<ProductionOrderResponse, string>({
      query: (id) => `/production/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Production', id }],
    }),
    createProductionOrder: build.mutation<ProductionOrderResponse, {
      bom: string; warehouse: string; plannedQty: number; startDate?: string; notes?: string;
    }>({
      query: (body) => ({ url: '/production/orders', method: 'POST', body }),
      invalidatesTags: ['Production'],
    }),
    updateProductionStatus: build.mutation<ProductionOrderResponse, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/production/orders/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => ['Production', { type: 'Production', id }, 'Stock'],
    }),
    issueMaterials: build.mutation<ProductionOrderResponse, { id: string; lines: { item: string; qty: number }[]; notes?: string }>({
      query: ({ id, ...body }) => ({ url: `/production/orders/${id}/issue`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => ['Production', { type: 'Production', id }, 'Stock'],
    }),
    recordOutput: build.mutation<ProductionOrderResponse, { id: string; actualOutputQty: number; wastageQty?: number; notes?: string }>({
      query: ({ id, ...body }) => ({ url: `/production/orders/${id}/output`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => ['Production', { type: 'Production', id }, 'Stock'],
    }),
  }),
});

export const {
  useGetBOMsQuery,
  useGetBOMQuery,
  useCreateBOMMutation,
  useUpdateBOMMutation,
  useDeleteBOMMutation,
  useCheckAvailabilityQuery,
  useGetProductionOrdersQuery,
  useGetProductionOrderQuery,
  useCreateProductionOrderMutation,
  useUpdateProductionStatusMutation,
  useIssueMaterialsMutation,
  useRecordOutputMutation,
} = productionApi;
