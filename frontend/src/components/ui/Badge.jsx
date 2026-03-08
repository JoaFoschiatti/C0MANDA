import clsx from 'clsx';

const variantClasses = {
  default: 'badge-default',
  primary: 'badge-primary',
  brand: 'badge-brand',
  success: 'badge-success',
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-info',
};

export default function Badge({
  children,
  variant = 'default',
  dot = false,
  className,
  ...props
}) {
  return (
    <span
      className={clsx('badge', variantClasses[variant], className)}
      {...props}
    >
      {dot && (
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full',
          variant === 'success' && 'bg-success-500',
          variant === 'error' && 'bg-error-500',
          variant === 'warning' && 'bg-warning-500',
          variant === 'info' && 'bg-info-500',
          variant === 'primary' && 'bg-primary-500',
          variant === 'brand' && 'bg-brand-700',
          variant === 'default' && 'bg-text-tertiary',
        )} />
      )}
      {children}
    </span>
  );
}
