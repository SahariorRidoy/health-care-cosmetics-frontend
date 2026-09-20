import { api } from '@/lib/store/api';
import type { ProductsResponse, ProductResponse, CreateProductPayload } from '../types';

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProducts: build.query<ProductsResponse, { page?: number; search?: string }>(
      {
        query: (params) => ({ url: '/items', params: { ...params, type: 'FINISHED_GOOD' } }),
        providesTags: ['Item'],
      },
    ),
    getProduct: build.query<ProductResponse, string>({
      query: (id) => `/items/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Item', id }],
    }),
    createProduct: build.mutation<ProductResponse, Omit<CreateProductPayload, 'type'>>({
      query: (body) => ({ url: '/items', method: 'POST', body: { ...body, type: 'FINISHED_GOOD' } }),
      invalidatesTags: ['Item'],
    }),
    updateProduct: build.mutation<ProductResponse, { id: string; body: Partial<CreateProductPayload> & { isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: `/items/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Item', { type: 'Item', id }],
    }),
    deleteProduct: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Item'],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productsApi;
