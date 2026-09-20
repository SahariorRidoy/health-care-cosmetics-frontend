import { api } from '@/lib/store/api';
import type { AuthUser } from '@/lib/store/authSlice';

interface LoginRequest { email: string; password: string; }
interface AuthResponse { data: { accessToken: string; user: AuthUser } }

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    getMe: build.query<AuthUser, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
    refresh: build.mutation<AuthResponse, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useGetMeQuery, useRefreshMutation } = authApi;
