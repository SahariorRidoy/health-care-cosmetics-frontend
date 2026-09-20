'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useLoginMutation } from '@/lib/auth/authApi';
import { setCredentials } from '@/lib/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';

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
  const [showPassword, setShowPassword] = useState(false);

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
      dispatch(setCredentials({ accessToken: result.data.accessToken, user: result.data.user }));
      // Small tick so Redux state is committed before navigation
      await new Promise((r) => setTimeout(r, 50));
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ?? 'Login failed. Check your credentials.';
      toast.error(message);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left */}
      <div className="hidden lg:flex w-[44%] bg-navy flex-col justify-between p-16">
        <div>
          <div className="flex items-center gap-2.5 mb-20">
            <div className="w-7 h-7 rounded bg-emerald flex items-center justify-center">
              <span className="text-white text-xs font-bold">H</span>
            </div>
            <span className="text-white text-sm font-semibold">HCC ERP</span>
          </div>

          <h1 className="text-3xl font-bold text-white leading-snug mb-4">
            Health Care<br />Cosmetics Ltd.
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Enterprise resource planning for<br />finance, HR, inventory, and operations.
          </p>
        </div>

        <p className="text-white/20 text-xs">© {new Date().getFullYear()} Health Care Cosmetics Ltd.</p>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center bg-background px-8">
        <div className="w-full max-w-sm">

          {/* mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded bg-emerald flex items-center justify-center">
              <span className="text-white text-xs font-bold">H</span>
            </div>
            <span className="text-foreground text-sm font-semibold">HCC ERP</span>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">Sign in</h2>
          <p className="text-sm text-secondary mb-8">Welcome back. Enter your details below.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-xs font-medium text-foreground">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@hcc.com"
                aria-invalid={!!errors.email}
                {...register('email')}
                className={`h-10 w-full rounded-md border px-3 text-sm text-foreground bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald transition-colors ${errors.email ? 'border-red-400' : 'border-border'}`}
              />
              {errors.email && <p role="alert" className="text-[11px] text-red-500">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-foreground">Password</label>
                <a href="/forgot-password" className="text-xs text-emerald hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                  className={`h-10 w-full rounded-md border px-3 pr-10 text-sm text-foreground bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald transition-colors ${errors.password ? 'border-red-400' : 'border-border'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p role="alert" className="text-[11px] text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-10 w-full rounded-md bg-emerald hover:bg-emerald-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 size={15} className="animate-spin" />}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>

          </form>
        </div>
      </div>

    </div>
  );
}
