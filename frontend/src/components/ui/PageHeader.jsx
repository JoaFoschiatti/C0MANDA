import { Link } from 'react-router-dom'
import clsx from 'clsx';

export default function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
  className,
}) {
  return (
    <div className={clsx('page-header', className)}>
      {breadcrumb && (
        <nav className="page-header__breadcrumb">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-text-disabled">/</span>}
              {item.href ? (
                <Link to={item.href} className="hover:text-text-primary transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-text-primary font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="page-header__content">
        <div className="page-header__intro">
          {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
          <h1 className="text-heading-1">{title}</h1>
          {description && <p className="text-body-sm mt-1">{description}</p>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
    </div>
  );
}
