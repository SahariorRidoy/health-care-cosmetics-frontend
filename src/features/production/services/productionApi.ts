import { api } from '@/lib/store/api';
import type { ProductionBatchesResponse, ProductionBatchResponse, ProductionOrdersResponse, CreateProductionBatchPayload } from '../types';

export const productionApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProductionBatches: build.query<ProductionBatchesResponse, { product?: string; page?: number; limit?: number }>({
      query: (params) => ({ url: '/production/batches', params }),
      providesTags: ['Production'],
    }),
    createProductionBatch: build.mutation<ProductionBatchResponse, CreateProductionBatchPayload>({
      query: (body) => ({ url: '/production/batches', method: 'POST', body }),
      invalidatesTags: ['Production', 'Item', 'Stock'],
    }),
    getProductionOrders: build.query<ProductionOrdersResponse, { page?: number; search?: string; status?: string }>({
      query: (params) => ({ url: '/production/orders', params }),
      providesTags: ['Production'],
    }),
  }),
});

export const {
  useGetProductionBatchesQuery,
  useCreateProductionBatchMutation,
  useGetProductionOrdersQuery,
} = productionApi;
