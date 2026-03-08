import clsx from 'clsx';

const sizeClasses = {
  sm: 'avatar-sm',
  md: 'avatar-md',
  lg: 'avatar-lg',
};

export default function Avatar({ name, size = 'md', src, className }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={clsx('avatar object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <span className={clsx('avatar', sizeClasses[size], className)}>
      {initials}
    </span>
  );
}
