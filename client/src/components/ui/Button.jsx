import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Safely converts any icon prop (component, forwardRef, or JSX element) into a valid React Node.
 */
function renderIcon(IconProp) {
  if (!IconProp) return null;

  // Already a valid JSX Element (e.g. <ArrowRight size={16} />)
  if (React.isValidElement(IconProp)) {
    return IconProp;
  }

  // Component reference or ForwardRef object (e.g. icon={ArrowRight})
  if (
    typeof IconProp === 'function' ||
    (typeof IconProp === 'object' && IconProp !== null && '$$typeof' in IconProp)
  ) {
    const IconComponent = IconProp;
    return <IconComponent aria-hidden="true" size={18} />;
  }

  return null;
}

export default function Button({
  to,
  href,
  variant = 'primary',
  size = 'md',
  icon,
  iconLeft,
  iconRight,
  block = false,
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const leadingIcon = renderIcon(icon || iconLeft);
  const trailingIcon = renderIcon(iconRight);

  const content = (
    <>
      {leadingIcon && <span className="btn-icon" aria-hidden="true">{leadingIcon}</span>}
      {children !== undefined && children !== null && <span>{children}</span>}
      {trailingIcon && <span className="btn-icon" aria-hidden="true">{trailingIcon}</span>}
    </>
  );

  if (to) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={classes} {...rest}>{content}</a>;
  return <button {...rest} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>{content}</button>;
}