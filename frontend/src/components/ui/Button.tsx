import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

function classesForVariant(variant: ButtonVariant): string {
  if (variant === 'primary') return 'bg-primary text-white hover:bg-blue-900';
  if (variant === 'secondary') return 'border border-primary text-primary bg-white hover:bg-blue-50';
  if (variant === 'danger') return 'bg-red-600 text-white hover:bg-red-700';
  return 'border border-slate-300 text-ink bg-white hover:bg-slate-50';
}

function classesForSize(size: ButtonSize): string {
  if (size === 'sm') return 'h-9 px-3 text-xs';
  if (size === 'lg') return 'h-12 px-5 text-base';
  return 'h-10 px-4 text-sm';
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  startIcon,
  endIcon,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${classesForVariant(variant)} ${classesForSize(size)} ${className}`}
      {...props}
    >
      {isLoading ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden /> : startIcon}
      <span>{children}</span>
      {!isLoading ? endIcon : null}
    </button>
  );
}
