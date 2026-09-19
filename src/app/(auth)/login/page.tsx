'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useLoginMutation } from '@/lib/auth/authApi';
import { setCredentials } from '@/lib/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { FormField } from '@/components/forms/FormField';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [login, { isLoading }] = useLoginMutation();

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    try {
      const result = await login(values).unwrap();
      dispatch(setCredentials({ accessToken: result.accessToken, user: result.user }));
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ?? 'Login failed. Check your credentials.';
      toast.error(message);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center mb-3">
          <span className="text-white font-bold text-lg">H</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">HCC ERP</h1>
        <p className="text-sm text-secondary mt-1">Health Care Cosmetics Ltd.</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Sign in to your account</h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@hcc.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 h-10 w-full rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
