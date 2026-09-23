import { api } from '@/lib/store/api';
import type {
  ItemsResponse, ItemResponse, UOMsResponse, CreateItemPayload, UOM,
  StockBalancesResponse, StockMovementsResponse, WarehousesResponse,
} from '../types';

export const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getItems: build.query<ItemsResponse, { page?: number; search?: string; type?: string; supplier?: string; isActive?: string; sortBy?: string; sortDir?: 'asc' | 'desc' }>({
      query: (params) => ({ url: '/items', params }),
      providesTags: ['Item'],
    }),
    generateSku: build.query<{ success: boolean; data: { sku: string } }, string>({
      query: (name) => ({ url: '/items/generate-sku', params: { name } }),
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
      invalidatesTags: ['Item', 'Stock', 'Supplier', 'PurchaseOrder'],
    }),
    updateItem: build.mutation<ItemResponse, { id: string; body: Partial<CreateItemPayload> & { isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: `/items/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Item', { type: 'Item', id }],
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const patch = { ...(data?.data?.item ?? {}), ...body };
          dispatch(
            inventoryApi.util.updateQueryData('getItems', { page: 1 }, (draft) => {
              const idx = draft.data.items.findIndex((it) => it._id === id);
              if (idx !== -1) Object.assign(draft.data.items[idx], patch);
            }),
          );
        } catch { /* invalidatesTags handles refetch */ }
      },
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
    getStockBalances: build.query<StockBalancesResponse, { page?: number; item?: string; warehouse?: string; lowStock?: boolean; search?: string }>({
      query: (params) => ({ url: '/stock/balance', params }),
      providesTags: ['Stock'],
    }),
    getStockMovements: build.query<StockMovementsResponse, { page?: number; limit?: number; item?: string; warehouse?: string; type?: string; reference?: string; activeOnly?: boolean }>({
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
    createWarehouse: build.mutation<{ success: boolean; data: { warehouse: import('../types').Warehouse } }, { name: string; code: string; address?: string; isDefault?: boolean }>({
      query: (body) => ({ url: '/warehouses', method: 'POST', body }),
      invalidatesTags: ['Warehouse'],
    }),
    updateWarehouse: build.mutation<{ success: boolean; data: { warehouse: import('../types').Warehouse } }, { id: string; body: { name?: string; code?: string; address?: string; isDefault?: boolean; isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: `/warehouses/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Warehouse'],
    }),
  }),
});

export const {
  useGetItemsQuery,
  useGetItemQuery,
  useGetItemCategoriesQuery,
  useGenerateSkuQuery,
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
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
} = inventoryApi;
