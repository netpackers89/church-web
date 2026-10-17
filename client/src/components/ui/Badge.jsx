const TONE_CLASS = {
  blue: 'badge',
  gold: 'badge badge-gold',
  success: 'badge badge-success',
  danger: 'badge badge-danger',
  warning: 'badge badge-warning',
  neutral: 'badge badge-neutral',
  navy: 'badge badge-navy',
  onDark: 'badge badge-on-dark',
};

export default function Badge({ tone = 'blue', dot = false, children, className = '' }) {
  const cls = TONE_CLASS[tone] ?? TONE_CLASS.blue;
  return (
    <span className={`${cls} ${className}`}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

