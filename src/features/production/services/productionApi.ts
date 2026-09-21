import { api } from '@/lib/store/api';
import type { ProductionOrdersResponse } from '../types';

export const productionApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProductionOrders: build.query<ProductionOrdersResponse, { page?: number; search?: string; status?: string }>({
      query: (params) => ({ url: '/production/orders', params }),
      providesTags: ['Production'],
    }),
  }),
});

export const { useGetProductionOrdersQuery } = productionApi;
