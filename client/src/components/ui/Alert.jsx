import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export default function Alert({ variant = 'info', title, children, className = '' }) {
  const Icon = ICONS[variant] ?? Info;
  return (
    <div className={`alert alert-${variant} ${className}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
