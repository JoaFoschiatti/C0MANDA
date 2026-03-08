import clsx from 'clsx';

const variantClasses = {
  default: 'card',
  bordered: 'card card-bordered',
  elevated: 'card card-elevated',
};

const sizeClasses = {
  sm: 'card-sm',
  md: '',
  lg: 'card-lg',
};

export default function Card({
  children,
  variant = 'default',
  size = 'md',
  hoverable = false,
  className,
  ...props
}) {
  return (
    <div
      className={clsx(
        variantClasses[variant],
        sizeClasses[size],
        hoverable && 'card-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children, className, ...props }) {
  return (
    <div className={clsx('pb-4 border-b border-border-subtle', className)} {...props}>
      {children}
    </div>
  );
};

Card.Body = function CardBody({ children, className, ...props }) {
  return (
    <div className={clsx('py-4', className)} {...props}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ children, className, ...props }) {
  return (
    <div className={clsx('pt-4 border-t border-border-subtle flex gap-3 justify-end', className)} {...props}>
      {children}
    </div>
  );
};
