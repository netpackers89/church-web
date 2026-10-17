import { useCallback, useId, useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import Button from './Button.jsx';
import { useMediaUpload } from '../../hooks/useMediaUpload.js';

export default function MediaUploadField({
  mediaType = 'BANNER',
  label = 'Image',
  hint = 'Upload a JPG/PNG/WebP/GIF file up to 5 MB.',
  required = true,
  disabled = false,
  record,
  title,
  onTitleChange,
  status,
  onStatusChange,
  onDraft,
  onPublish,
  currentUrl,
  onRemoveMedia,
}) {
  const fieldId = useId();
  const current = currentUrl || (record ? (record.mediaUrl || record.imageUrl || record.thumbnailUrl || '') : '');
  const imageKey = `${record?.id ?? 'new'}:${current}`;
  const [imageState, setImageState] = useState(() => ({ imageKey, removedCurrent: false, isThumbnail: Boolean(record?.isThumbnail) }));
  const stateMatchesImage = imageState.imageKey === imageKey;
  const removedCurrent = stateMatchesImage && imageState.removedCurrent;
  const isThumbnail = stateMatchesImage ? imageState.isThumbnail : Boolean(record?.isThumbnail);
  const uploader = useMediaUpload({ mediaType, title, isThumbnail, onDraft, onPublish });
  const editing = !!record || Boolean(currentUrl);
  const displayedCurrent = removedCurrent ? '' : current;

  const choose = useCallback(
    (event) => {
      const input = event.target.files?.[0];
      if (!input) return;
      uploader.selectFile(input);
      event.target.value = '';
    },
    [uploader],
  );

  const removeImage = useCallback(() => {
    uploader.removeFile();
    setImageState({ imageKey, removedCurrent: true, isThumbnail });
    onRemoveMedia?.();
  }, [uploader, onRemoveMedia, imageKey, isThumbnail]);

  const handleSave = useCallback(
    async (action, payload) => {
      let asset = uploader.uploadedAsset;
      if (uploader.file && !asset) {
        const result = await uploader.upload();
        if (!result.ok) return;
        asset = result;
      }
      const mediaUrl = asset?.url || displayedCurrent;
      if (!mediaUrl) return;
      const nextPayload = {
        mediaUrl,
        mediaId: asset?.mediaId || record?.mediaId || (record?.storageId ? record.id : undefined),
        storageProvider: asset?.storageProvider || record?.storageProvider,
        storageId: asset?.storageId || record?.storageId,
        isThumbnail,
        thumbnailUrl: isThumbnail ? mediaUrl : '',
        title: payload?.title ?? title,
        status,
        type: mediaType,
      };
      await (action === 'PUBLISHED' ? onPublish?.(nextPayload) : onDraft?.(nextPayload));
    },
    [uploader, displayedCurrent, record, isThumbnail, status, mediaType, title, onDraft, onPublish],
  );

  const imageUrl = uploader.previewUrl || displayedCurrent;
  const currentImage = () =>
    imageUrl ? (
      <>
        <img src={imageUrl} alt={label} style={{ width: '100%', height: '100%', maxHeight: '16rem', objectFit: 'cover', display: 'block' }} />
      </>
    ) : (
      <div style={{ textAlign: 'center', color: '#64748B', padding: '1rem' }}>
        <LoaderCircle size={20} style={{ display: 'block', margin: '0 auto 0.4rem' }} />
        <span>No image selected</span>
      </div>
    );

  return (
    <div className="field">
      <label htmlFor={fieldId}>{label} {required ? <span className="req">*</span> : null}</label>
      <div style={{ display: 'grid', gap: '0.75rem', padding: '0.9rem', border: '1px solid rgba(15,23,42,0.12)', background: '#fff', borderRadius: '0.9rem' }}>
        <div style={{ minHeight: '12rem', borderRadius: '0.8rem', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(22,100,176,.05), rgba(239,232,222,.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(22,100,176,.35)' }}>
          {currentImage()}
        </div>
        {uploader.previewUrl && !uploader.uploadedUrl ? <span className="hint">Local preview only. Upload to save this image.</span> : null}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input id={fieldId} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choose} hidden disabled={disabled || uploader.uploading} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => document.getElementById(fieldId)?.click()}
            disabled={disabled || uploader.uploading}
          >
            {imageUrl ? 'Replace image' : 'Choose image'}
          </Button>
          {imageUrl ? (
            <Button type="button" variant="ghost" onClick={removeImage} disabled={disabled || uploader.uploading} iconLeft={<Trash2 size={14} />}>Remove</Button>
          ) : null}
        </div>

        {uploader.error ? <span className="field-error" role="alert">{uploader.error}</span> : null}
        {uploader.file && !uploader.uploading ? (
          <span className="hint">The image uploads when you save.</span>
        ) : null}
        {uploader.uploading ? (
          <div aria-live="polite">
            <span className="hint"><LoaderCircle size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.35rem' }} />Uploading to configured image storage: {uploader.uploadProgress}%</span>
            <progress max="100" value={uploader.uploadProgress} aria-label="Image upload progress" style={{ width: '100%' }} />
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: editing ? '1fr 1fr auto' : '1fr' }}>
          <input className="input" placeholder="Caption or title" value={title || ''} onChange={(e) => onTitleChange?.(e.target.value)} disabled={disabled} style={{ gridColumn: '1 / -1' }} />
          {editing ? <select className="input" value={status || 'DRAFT'} onChange={(e) => onStatusChange?.(e.target.value)} disabled={disabled}><option value="DRAFT">Save as draft</option><option value="PUBLISHED">Publish</option></select> : null}
        </div>
        <label className="check-label"><input type="checkbox" checked={isThumbnail} onChange={(event) => setImageState({ imageKey, removedCurrent, isThumbnail: event.target.checked })} disabled={disabled || uploader.uploading} /> Use as thumbnail</label>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={() => handleSave('DRAFT')} disabled={!title?.trim() || (required && !imageUrl && !uploader.file) || disabled || uploader.uploading}>Save draft</Button>
          <Button type="button" variant="primary" onClick={() => handleSave('PUBLISHED')} disabled={!title?.trim() || (required && !imageUrl && !uploader.file) || disabled || uploader.uploading}>Publish</Button>
        </div>
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
