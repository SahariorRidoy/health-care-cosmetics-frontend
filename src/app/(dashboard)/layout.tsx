'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/store/hooks';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    // Give AuthBootstrap enough time to rehydrate on cold starts
    const t = setTimeout(() => {
      if (!isAuthenticated) router.replace('/login');
    }, 1500);
    return () => clearTimeout(t);
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
