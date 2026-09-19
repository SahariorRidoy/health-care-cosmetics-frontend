import { api } from '@/lib/store/api';
import type { UserRecord } from '../types';

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
    getUsers: build.query<{ users: UserRecord[] }, void>({
      query: () => '/users',
      providesTags: ['User'],
    }),
    createUser: build.mutation<{ user: UserRecord }, CreateUserBody>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: build.mutation<{ user: UserRecord }, { id: string; body: UpdateUserBody }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
    changePassword: build.mutation<void, ChangePasswordBody>({
      query: (body) => ({ url: '/users/me/change-password', method: 'PATCH', body }),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useChangePasswordMutation,
} = settingsApi;
