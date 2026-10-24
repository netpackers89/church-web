import { Copy, ExternalLink, ImageIcon, Plus, Share2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { contentService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import MediaUploadField from '../../components/ui/MediaUploadField.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

const blank = { title: '', description: '', imageUrl: '', status: 'DRAFT', type: 'BANNER' };

export default function BannersManagementPage() {
  const banners = useAsync(async () => {
    const res = await contentService.banners();
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [copiedBannerId, setCopiedBannerId] = useState(null);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function handleUpload(file) {
    const response = await contentService.uploadImage(file);
    const nextUrl = response?.data?.data?.url || response?.data?.data?.imageUrl || response?.data?.url || '';
    if (!nextUrl) {
      throw new Error('The upload service did not return a public URL.');
    }
    updateForm('imageUrl', nextUrl);
    return response;
  }

  const handleSave = useCallback(
    async (action, payload) => {
      setError('');
      setSaving(true);
      try {
        if (!payload?.title?.trim()) throw new Error('Please enter a banner title.');
        const data = {
          type: 'BANNER',
          title: payload.title,
          description: form.description,
          mediaUrl: payload.mediaUrl,
          mediaId: payload.mediaId,
          isThumbnail: payload.isThumbnail,
          thumbnailUrl: payload.thumbnailUrl,
          isPublic: action === 'PUBLISHED',
        };
        await contentService.createMedia(data);
        setOpen(false);
        setForm(blank);
        banners.reload();
      } catch (reason) {
        setError(reason.message || 'Unable to save the banner.');
      } finally {
        setSaving(false);
      }
    },
    [form, setError, setSaving, setOpen, banners],
  );

  async function shareBanner(banner) {
    const url = banner.mediaUrl || banner.imageUrl;
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: banner.title || 'Church banner', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedBannerId(banner.id);
        window.setTimeout(() => setCopiedBannerId(null), 1800);
      }
    } catch (shareError) {
      if (shareError.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedBannerId(banner.id);
        window.setTimeout(() => setCopiedBannerId(null), 1800);
      } catch {
        setError('Could not copy the banner link. Open the image link and copy it from the browser address bar.');
      }
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Banners</h1>
          <p>Homepage and section banners for the public site.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { setForm(blank); setError(''); setOpen(true); }} iconRight={<ImageIcon size={15} />}>
            New banner
          </Button>
        </div>
      </div>

      {error && !open ? <Alert variant="danger">{error}</Alert> : null}

      <DataState
        query={banners}
        feature="Banners"
        endpoint="/admin/banners"
        emptyState={
          <EmptyState
            icon={<ImageIcon size={30} />}
            title="No banners yet"
            description="Uploaded banners will be listed here with their placement and schedule."
            action={<Button onClick={() => setOpen(true)} iconLeft={<Plus size={15} />}>Create banner</Button>}
          />
        }
      >
        {(list) => (
          <div className="grid-auto">
            {list.map((b) => (
              <div key={b.id ?? b.title} className="card card-hover">
                {b.mediaUrl || b.imageUrl ? <ReliableImage src={b.mediaUrl || b.imageUrl} alt={b.title ?? 'Banner'} style={{ width: '100%', height: '8rem', objectFit: 'cover' }} /> : null}
                <div className="card-body">
                  <h3>{b.title ?? 'Untitled banner'}</h3>
                  {b.description ? <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>{b.description}</p> : null}
                  <span className={`badge ${b.isPublic ? 'badge-success' : 'badge-neutral'}`} style={{ marginTop: '0.5rem' }}>{b.isPublic ? 'Published' : 'Draft'}</span>
                  {(b.mediaUrl || b.imageUrl) ? (
                    <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <Button type="button" size="sm" variant="secondary" iconLeft={<Share2 size={14} />} onClick={() => shareBanner(b)}>
                        {copiedBannerId === b.id ? 'Link copied' : 'Share image link'}
                      </Button>
                      <a className="btn btn-ghost btn-sm" href={b.mediaUrl || b.imageUrl} target="_blank" rel="noreferrer" aria-label={`Open ${b.title || 'banner'} image`}><ExternalLink size={14} /> Open</a>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataState>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Create banner" size="lg">
        <form className="form-grid" onSubmit={handleSave}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input label="Description" type="textarea" value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={4} />
          <MediaUploadField
            mediaType="BANNER"
            record={null}
            title={form.title}
            onTitleChange={(v) => updateForm('title', v)}
            status={form.status}
            onStatusChange={(v) => updateForm('status', v)}
            currentUrl={form.imageUrl}
            onRemoveMedia={() => updateForm('imageUrl', '')}
            onDraft={(p) => handleSave('DRAFT', p)}
            onPublish={(p) => handleSave('PUBLISHED', p)}
            hint="Upload a banner image. Published banners appear on the public site."
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{saving ? 'Saving…' : 'Save banner'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
