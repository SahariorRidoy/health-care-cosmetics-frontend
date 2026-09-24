import { api } from '@/lib/store/api';
import type {
  FactoryBatchesResponse, FactoryBatchResponse, FactoryLedgerResponse,
  CreateFactoryBatchPayload, UpdateFactoryBatchPayload,
  AddReceiptPayload, AddMaterialReturnPayload, RestockBatchPayload,
} from '../types';

export const factoryProductionApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ── V2 Factory Batch endpoints ────────────────────────────────────────────
    getFactoryBatches: build.query<FactoryBatchesResponse, { page?: number; status?: string; factory?: string; search?: string }>({
      query: (params) => ({ url: '/factory-batches', params }),
      providesTags: ['FactoryBatch'],
    }),
    getFactoryBatch: build.query<FactoryBatchResponse, string>({
      query: (id) => `/factory-batches/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'FactoryBatch', id }],
    }),
    getFactoryLedger: build.query<FactoryLedgerResponse, string>({
      query: (factoryId) => `/factory-batches/factory/${factoryId}`,
      providesTags: ['FactoryBatch'],
    }),
    createFactoryBatch: build.mutation<FactoryBatchResponse, CreateFactoryBatchPayload>({
      query: (body) => ({ url: '/factory-batches', method: 'POST', body }),
      invalidatesTags: ['FactoryBatch'],
    }),
    updateFactoryBatch: build.mutation<FactoryBatchResponse, { id: string; body: UpdateFactoryBatchPayload }>({
      query: ({ id, body }) => ({ url: `/factory-batches/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['FactoryBatch', { type: 'FactoryBatch', id }],
    }),
    dispatchFactoryBatch: build.mutation<FactoryBatchResponse, string>({
      query: (id) => ({ url: `/factory-batches/${id}/dispatch`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => ['FactoryBatch', { type: 'FactoryBatch', id }, 'Stock', 'Item'],
    }),
    updateFactoryBatchStatus: build.mutation<FactoryBatchResponse, { id: string; status: 'IN_PRODUCTION' }>({
      query: ({ id, status }) => ({ url: `/factory-batches/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => ['FactoryBatch', { type: 'FactoryBatch', id }],
    }),
    addFactoryReceipt: build.mutation<FactoryBatchResponse, { id: string; body: AddReceiptPayload }>({
      query: ({ id, body }) => ({ url: `/factory-batches/${id}/receipts`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => ['FactoryBatch', { type: 'FactoryBatch', id }, 'Stock', 'Item'],
    }),
    addMaterialReturn: build.mutation<FactoryBatchResponse, { id: string; body: AddMaterialReturnPayload }>({
      query: ({ id, body }) => ({ url: `/factory-batches/${id}/returns`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => ['FactoryBatch', { type: 'FactoryBatch', id }, 'Stock', 'Item'],
    }),
    restockFactoryBatch: build.mutation<FactoryBatchResponse, { id: string; body: RestockBatchPayload }>({
      query: ({ id, body }) => ({ url: `/factory-batches/${id}/restock`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => ['FactoryBatch', { type: 'FactoryBatch', id }, 'Stock', 'Item'],
    }),
    cancelFactoryBatch: build.mutation<FactoryBatchResponse, string>({
      query: (id) => ({ url: `/factory-batches/${id}/cancel`, method: 'PATCH' }),
      invalidatesTags: (_r, _e, id) => ['FactoryBatch', { type: 'FactoryBatch', id }, 'Stock', 'Item'],
    }),
    deleteFactoryBatch: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/factory-batches/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FactoryBatch'],
    }),
  }),
});

export const {
  useGetFactoryBatchesQuery,
  useGetFactoryBatchQuery,
  useGetFactoryLedgerQuery,
  useCreateFactoryBatchMutation,
  useUpdateFactoryBatchMutation,
  useDispatchFactoryBatchMutation,
  useUpdateFactoryBatchStatusMutation,
  useAddFactoryReceiptMutation,
  useAddMaterialReturnMutation,
  useRestockFactoryBatchMutation,
  useCancelFactoryBatchMutation,
  useDeleteFactoryBatchMutation,
} = factoryProductionApi;
