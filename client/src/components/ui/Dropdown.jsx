import { useRef, useState, useEffect } from 'react';

/**
 * Small click-to-open menu. Renders a trigger (button by default) and a menu
 * that closes on outside click or Escape. Pass `align="left"` to anchor left.
 */
export default function Dropdown({ trigger, children, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`dropdown ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="btn btn-secondary btn-sm">
        {trigger}
      </button>
      {open ? (
        <div className={`dropdown-menu ${align === 'left' ? 'right-auto' : ''}`} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({ children, onClick, danger = false, icon: Icon }) {
  return (
    <button type="button" className={`dropdown-item ${danger ? 'danger' : ''}`} role="menuitem" onClick={onClick}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

