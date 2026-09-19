'use client';

import { Provider } from 'react-redux';
import { store } from '@/lib/store';
import { Toaster } from 'sonner';
import { AuthBootstrap } from '@/lib/auth/AuthBootstrap';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthBootstrap />
      {children}
      <Toaster position="top-right" richColors closeButton />
    </Provider>
  );
}
