import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';
import ReliableImage from './ReliableImage.jsx';

export default function ImageUploadField({
  label = 'Image',
  value = '',
  onChange,
  onUpload,
  required = false,
  disabled = false,
  hint = 'Upload a JPG, PNG, WebP, or GIF file up to 5 MB.',
  accept = 'image/*',
}) {
  const inputRef = useRef(null);
  const [selectedPreview, setSelectedPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (selectedPreview.startsWith('blob:')) {
        URL.revokeObjectURL(selectedPreview);
      }
    };
  }, [selectedPreview]);

  const previewUrl = selectedPreview || value || '';

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    const nextPreview = URL.createObjectURL(file);
    if (selectedPreview.startsWith('blob:')) URL.revokeObjectURL(selectedPreview);
    setSelectedPreview(nextPreview);

    if (!onUpload) {
      setTimeout(() => {
        if (typeof onChange === 'function') onChange(nextPreview);
      }, 0);
      event.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const result = await onUpload(file);
      const nextValue = result?.data?.data?.url || result?.data?.data?.imageUrl || result?.data?.url || result?.data?.imageUrl || '';
      if (nextValue) {
        if (selectedPreview.startsWith('blob:')) URL.revokeObjectURL(selectedPreview);
        setSelectedPreview('');
        if (typeof onChange === 'function') onChange(nextValue);
      }
    } catch (reason) {
      setError(reason?.message || 'The image could not be uploaded.');
      if (selectedPreview.startsWith('blob:')) URL.revokeObjectURL(selectedPreview);
      setSelectedPreview('');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeImage = () => {
    if (selectedPreview.startsWith('blob:')) URL.revokeObjectURL(selectedPreview);
    setSelectedPreview('');
    setError('');
    if (typeof onChange === 'function') onChange('');
  };

  return (
    <div className="field">
      <label>
        {label}
        {required ? <span className="req" aria-hidden="true">*</span> : null}
      </label>
      <div
        className="card"
        style={{
          display: 'grid',
          gap: '0.9rem',
          padding: '0.9rem',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          background: '#fff',
          borderRadius: '0.9rem',
        }}
      >
        <div
          style={{
            minHeight: '12rem',
            borderRadius: '0.8rem',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(22,100,176,.05), rgba(239,232,222,.7))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed rgba(22,100,176,.35)',
          }}
        >
          {previewUrl ? (
            <ReliableImage
              src={previewUrl}
              alt={label}
              fallback={<span className="muted">Image preview unavailable</span>}
              style={{ width: '100%', height: '100%', maxHeight: '18rem', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '1rem' }}>
              <ImagePlus size={26} style={{ display: 'block', margin: '0 auto 0.5rem' }} />
              <span>No image selected</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={inputRef} type="file" accept={accept} onChange={handleFileSelect} hidden disabled={disabled || uploading} />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
            {uploading ? <><LoaderCircle size={15} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...</> : 'Choose image'}
          </Button>
          {previewUrl ? (
            <Button type="button" variant="ghost" onClick={removeImage} disabled={disabled || uploading} iconLeft={<Trash2 size={14} />}>
              Remove
            </Button>
          ) : null}
        </div>

        {error ? <span className="field-error" role="alert">{error}</span> : null}
        {hint && !error ? <span className="hint">{hint}</span> : null}
      </div>
    </div>
  );
}
