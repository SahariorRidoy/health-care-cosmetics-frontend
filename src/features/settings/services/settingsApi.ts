import { api } from '@/lib/store/api';
import type { UserRecord, UOMConversion, UOMConversionsResponse } from '../types';

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'staff';
}

interface UpdateUserBody {
  name?: string;
  role?: 'admin' | 'manager' | 'staff';
  isActive?: boolean;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export const settingsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<{ success: boolean; data: { users: UserRecord[] } }, void>({
      query: () => '/users',
      providesTags: ['User'],
    }),
    createUser: build.mutation<{ success: boolean; data: { user: UserRecord } }, CreateUserBody>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: build.mutation<{ success: boolean; data: { user: UserRecord } }, { id: string; body: UpdateUserBody }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
    changePassword: build.mutation<void, ChangePasswordBody>({
      query: (body) => ({ url: '/users/me/change-password', method: 'PATCH', body }),
    }),
    getUOMConversions: build.query<UOMConversionsResponse, void>({
      query: () => '/uom/conversions/list',
      providesTags: ['UOMConversion'],
    }),
    createUOMConversion: build.mutation<{ success: boolean; data: { conversion: UOMConversion } }, { fromUOM: string; toUOM: string; factor: number }>({
      query: (body) => ({ url: '/uom/conversions', method: 'POST', body }),
      invalidatesTags: ['UOMConversion'],
    }),
    updateUOMConversion: build.mutation<{ success: boolean; data: { conversion: UOMConversion } }, { id: string; factor: number }>({
      query: ({ id, factor }) => ({ url: `/uom/conversions/${id}`, method: 'PATCH', body: { factor } }),
      invalidatesTags: ['UOMConversion'],
    }),
    deleteUOMConversion: build.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `/uom/conversions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['UOMConversion'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useChangePasswordMutation,
  useGetUOMConversionsQuery,
  useCreateUOMConversionMutation,
  useUpdateUOMConversionMutation,
  useDeleteUOMConversionMutation,
} = settingsApi;
