import { api } from '@/lib/store/api';
import type {
  ItemsResponse, ItemResponse, UOMsResponse, CreateItemPayload, UOM,
  StockBalancesResponse, StockMovementsResponse, WarehousesResponse,
} from '../types';

export const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getItems: build.query<ItemsResponse, { page?: number; search?: string; type?: string; isActive?: string }>({
      query: (params) => ({ url: '/items', params }),
      providesTags: ['Item'],
    }),
    getItem: build.query<ItemResponse, string>({
      query: (id) => `/items/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Item', id }],
    }),
    getItemCategories: build.query<{ success: boolean; data: string[] }, void>({
      query: () => '/items/categories',
      providesTags: ['Item'],
    }),
    createItem: build.mutation<ItemResponse, CreateItemPayload>({
      query: (body) => ({ url: '/items', method: 'POST', body }),
      invalidatesTags: ['Item'],
    }),
    updateItem: build.mutation<ItemResponse, { id: string; body: Partial<CreateItemPayload> & { isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: `/items/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Item', { type: 'Item', id }],
    }),
    deleteItem: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Item'],
    }),
    getUOMs: build.query<UOMsResponse, void>({
      query: () => '/uom',
      providesTags: ['UOM'],
    }),
    createUOM: build.mutation<{ success: boolean; data: UOM }, { name: string; symbol: string; description?: string }>({
      query: (body) => ({ url: '/uom', method: 'POST', body }),
      invalidatesTags: ['UOM'],
    }),
    updateUOM: build.mutation<{ success: boolean; data: UOM }, { id: string; body: { name?: string; symbol?: string; description?: string; isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: `/uom/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['UOM'],
    }),
    deleteUOM: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/uom/${id}`, method: 'DELETE' }),
      invalidatesTags: ['UOM'],
    }),
    getStockBalances: build.query<StockBalancesResponse, { page?: number; item?: string; warehouse?: string; lowStock?: boolean }>({
      query: (params) => ({ url: '/stock/balance', params }),
      providesTags: ['Stock'],
    }),
    getStockMovements: build.query<StockMovementsResponse, { page?: number; item?: string; warehouse?: string }>({
      query: (params) => ({ url: '/stock/movements', params }),
      providesTags: ['Stock'],
    }),
    createAdjustment: build.mutation<{ success: boolean; data: unknown }, { item: string; warehouse: string; quantity: number; notes?: string }>({
      query: (body) => ({ url: '/stock/adjustments', method: 'POST', body }),
      invalidatesTags: ['Stock', 'Item'],
    }),
    getWarehouses: build.query<WarehousesResponse, void>({
      query: () => '/warehouses',
      providesTags: ['Warehouse'],
    }),
  }),
});

export const {
  useGetItemsQuery,
  useGetItemQuery,
  useGetItemCategoriesQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useGetUOMsQuery,
  useCreateUOMMutation,
  useUpdateUOMMutation,
  useDeleteUOMMutation,
  useGetStockBalancesQuery,
  useGetStockMovementsQuery,
  useCreateAdjustmentMutation,
  useGetWarehousesQuery,
} = inventoryApi;
