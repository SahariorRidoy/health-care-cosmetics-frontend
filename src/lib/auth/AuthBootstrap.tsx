'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/lib/store/hooks';
import { setCredentials } from '@/lib/store/authSlice';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export function AuthBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Try to restore session via refresh token cookie
    fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data?.accessToken) {
          dispatch(setCredentials({ accessToken: data.data.accessToken, user: data.data.user }));
        }
      })
      .catch(() => {/* no session — stay logged out */});
  }, [dispatch]);

  return null;
}
