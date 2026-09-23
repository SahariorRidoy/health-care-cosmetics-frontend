import { forwardRef } from 'react';
import { cn } from '@/lib/formatters';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, required, hint, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-bold text-foreground">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(
            'h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground',
            'placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:ring-red-500',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={`${fieldId}-hint`} className="text-[11px] text-muted">{hint}</p>
        )}
        {error && (
          <p id={`${fieldId}-error`} role="alert" className="text-[11px] text-red-500">{error}</p>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, required, children, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-bold text-foreground">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          className={cn(
            'h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:ring-red-500',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p role="alert" className="text-[11px] text-red-500">{error}</p>
        )}
      </div>
    );
  },
);
SelectField.displayName = 'SelectField';

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  required?: boolean;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, required, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-bold text-foreground">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted resize-none',
            'focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:ring-red-500',
            className,
          )}
          rows={props.rows ?? 3}
          {...props}
        />
        {error && (
          <p role="alert" className="text-[11px] text-red-500">{error}</p>
        )}
      </div>
    );
  },
);
TextareaField.displayName = 'TextareaField';
