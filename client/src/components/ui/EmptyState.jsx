import React from 'react';
import Button from './Button.jsx';

export default function EmptyState({ icon: IconProp, title, description, action }) {
  // Safely render icon whether it's passed as a component (MapPin) or JSX element (<MapPin />)
  const renderIconNode = () => {
    if (!IconProp) return null;
    if (React.isValidElement(IconProp)) return IconProp;
    if (typeof IconProp === 'function' || (typeof IconProp === 'object' && IconProp.$$typeof)) {
      const Comp = IconProp;
      return <Comp size={36} aria-hidden="true" />;
    }
    return null;
  };

  // Most callers pass a ready-made button/link, but supporting this small
  // descriptor keeps simple empty states concise without rendering an object.
  const renderAction = () => {
    if (!action) return null;
    if (React.isValidElement(action)) return action;
    if (typeof action === 'object' && action.label) {
      const { label, ...actionProps } = action;
      return <Button {...actionProps}>{label}</Button>;
    }
    return null;
  };

  return (
    <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      {IconProp && <div className="empty-icon" style={{ marginBottom: '1rem', color: 'var(--muted)' }}>{renderIconNode()}</div>}
      {title && <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{title}</h3>}
      {description && <p className="muted" style={{ maxWidth: '28rem', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>{description}</p>}
      {action && <div>{renderAction()}</div>}
    </div>
  );
}
