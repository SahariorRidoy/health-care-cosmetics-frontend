import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer from './authSlice';

function loadAuth() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('auth') : null;
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function saveAuth(state: ReturnType<typeof store.getState>) {
  try {
    const { accessToken, user, isAuthenticated } = state.auth;
    localStorage.setItem('auth', JSON.stringify({ accessToken, user, isAuthenticated }));
  } catch { /* ignore */ }
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  preloadedState: {
    auth: loadAuth(),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

store.subscribe(() => saveAuth(store.getState()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
