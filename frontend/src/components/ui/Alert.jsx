import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

const variantConfig = {
  success: { cls: 'alert-success', Icon: CheckCircleIcon },
  error: { cls: 'alert-error', Icon: XCircleIcon },
  warning: { cls: 'alert-warning', Icon: ExclamationTriangleIcon },
  info: { cls: 'alert-info', Icon: InformationCircleIcon },
};

export default function Alert({
  children,
  variant = 'info',
  dismissible = false,
  onDismiss,
  className,
}) {
  const { cls, Icon } = variantConfig[variant];

  return (
    <div className={clsx('alert', cls, className)} role="alert">
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">{children}</div>
      {dismissible && onDismiss && (
        <button onClick={onDismiss} className="shrink-0 p-0.5 rounded hover:opacity-70">
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
