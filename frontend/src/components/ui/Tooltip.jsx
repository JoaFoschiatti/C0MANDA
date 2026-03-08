import clsx from 'clsx';

export default function Tooltip({ children, text, position = 'top', className }) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={clsx('relative inline-flex group', className)}>
      {children}
      <span
        className={clsx(
          'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-text-primary rounded-md',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
          'transition-all duration-150 whitespace-nowrap pointer-events-none',
          positionClasses[position],
        )}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
