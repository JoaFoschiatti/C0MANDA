import clsx from 'clsx';

const sizeClasses = {
  sm: 'spinner-sm',
  md: 'spinner-md',
  lg: 'spinner-lg',
};

export default function Spinner({ size = 'md', className, label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={clsx('spinner', sizeClasses[size], className)} role="status" />
      {label && <span className="text-body-sm">{label}</span>}
    </div>
  );
}
