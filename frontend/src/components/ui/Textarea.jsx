import { forwardRef } from 'react';
import clsx from 'clsx';

const Textarea = forwardRef(({
  label,
  error,
  hint,
  className,
  id,
  rows = 3,
  ...props
}, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="input-group">
      {label && (
        <label htmlFor={textareaId} className="label">{label}</label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={clsx('input resize-y', error && 'input-error', className)}
        {...props}
      />
      {error && <span className="input-error-message">{error}</span>}
      {hint && !error && <span className="input-hint">{hint}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
