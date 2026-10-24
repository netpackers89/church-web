import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export default function MoreActionsMenu({ actions, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const positionMenu = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!trigger || !menu) return;
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - menu.width - margin);
      const left = Math.min(
        Math.max(margin, trigger.right - menu.width),
        maxLeft,
      );
      const below = window.innerHeight - trigger.bottom - margin;
      const above = trigger.top - margin;
      const top = below >= menu.height || below >= above
        ? Math.min(trigger.bottom + 6, window.innerHeight - menu.height - margin)
        : Math.max(margin, trigger.top - menu.height - 6);
      setMenuPosition({ top, left });
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    function dismiss(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.type === 'pointerdown'
        && !rootRef.current?.contains(event.target)
        && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [open]);

  return (
    <div className="more-actions" ref={rootRef}>
      <button type="button" className="more-actions-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => {
        if (!open) setMenuPosition({ top: 0, left: 0 });
        setOpen((current) => !current);
      }} ref={triggerRef}>
        <MoreHorizontal size={18} /> <span>{label}</span>
      </button>
      {open ? createPortal(
        <div className="more-actions-menu" role="menu" aria-label={label} style={menuPosition} ref={menuRef} onKeyDown={(event) => {
          const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
          if (!items.length) return;
          const current = items.indexOf(document.activeElement);
          let next = current;
          if (event.key === 'ArrowDown') next = (current + 1) % items.length;
          else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = items.length - 1;
          else return;
          event.preventDefault();
          items[next]?.focus();
        }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? 'is-danger' : ''}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.icon ? action.icon : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
