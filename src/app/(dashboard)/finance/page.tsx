'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FinanceIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/finance/expenses'); }, [router]);
  return null;
}
