import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Labeled form field supporting text/password/select/textarea.
 * Password fields get a visibility toggle. Errors wire up aria-invalid +
 * aria-describedby for accessibility.
 */
export default function Input({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  error,
  required = false,
  options,        // for type="select"
  rows,           // for type="textarea"
  className = '',
  ...rest
}) {
  const autoId = useId();
  const id = rest.id || `${name || 'field'}-${autoId}`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const isSelect = type === 'select';
  const isTextarea = type === 'textarea';
  const effectiveType = isPassword && reveal ? 'text' : type;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const commonProps = {
    id,
    name,
    value: value ?? '',
    onChange,
    onBlur,
    placeholder,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    ...rest,
  };

  let control;
  if (isSelect) {
    control = (
      <select {...commonProps} className={`select ${className}`}>
        {placeholder && !(options ?? []).some((opt) => String(opt.value) === '') ? (
          <option value="" disabled={required}>{placeholder}</option>
        ) : null}
        {(options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  } else if (isTextarea) {
    control = <textarea {...commonProps} rows={rows ?? 4} className={`textarea ${className}`} />;
  } else if (isPassword) {
    control = (
      <div className="input-affix">
        <input {...commonProps} type={effectiveType} className={`input ${className}`} />
        <button
          type="button"
          className="affix-btn"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? 'Hide password' : 'Show password'}
        >
          {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  } else {
    control = <input {...commonProps} type={effectiveType} className={`input ${className}`} />;
  }

  return (
    <div className="field">
      {label ? (
        <label htmlFor={id}>
          {label}
          {required ? <span className="req" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {control}
      {hint && !error ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

