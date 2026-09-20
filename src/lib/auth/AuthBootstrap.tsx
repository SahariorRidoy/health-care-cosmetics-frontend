'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { setCredentials } from '@/lib/store/authSlice';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  useEffect(() => {
    // If we already have a token from localStorage, skip the refresh call
    if (accessToken) return;

    fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data?.accessToken) {
          dispatch(setCredentials({ accessToken: data.data.accessToken, user: data.data.user }));
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
