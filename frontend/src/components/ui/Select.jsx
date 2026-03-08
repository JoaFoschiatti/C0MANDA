import { forwardRef } from 'react';
import clsx from 'clsx';

const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder,
  className,
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="input-group">
      {label && (
        <label htmlFor={selectId} className="label">{label}</label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={clsx('input', error && 'input-error', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value;
          const text = typeof opt === 'string' ? opt : opt.label;
          return (
            <option key={value} value={value}>{text}</option>
          );
        })}
      </select>
      {error && <span className="input-error-message">{error}</span>}
      {hint && !error && <span className="input-hint">{hint}</span>}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
