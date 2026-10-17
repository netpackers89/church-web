import { Church, Save, Archive, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { contentService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

export default function BibleVersesManagementPage() {
  const { success, error: toastError } = useToast();
  const verse = useAsync(async () => {
    const res = await contentService.verse();
    return res?.data?.data ?? res?.data ?? null;
  }, []);
  const publications = useAsync(async () => (await contentService.listVerses()).data.data ?? [], []);

  const [form, setForm] = useState({ text: '', reference: '', status: 'PUBLISHED', reflection: '', backgroundImageUrl: '', publishToWebsite: true });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (verse.data) {
      setForm((current) => ({ ...current, text: verse.data.text ?? '', reference: verse.data.reference ?? '' }));
    }
  }, [verse.data]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await contentService.setVerse(form);
      success('Verse of the day updated');
      verse.reload();
      publications.reload();
    } catch (err) {
      setSaveError(err?.message || 'Could not save the verse.');
      toastError('Verse not saved', err?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Verse of the day</h1>
          <p>The daily Bible verse shown on the home page and member dashboard.</p>
        </div>
      </div>

      <div className="card card-pad-lg" style={{ maxWidth: '44rem' }}>
        <div className="row" style={{ marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><Church size={17} /></span>
          <h2 className="serif" style={{ fontSize: '1.25rem' }}>Current verse</h2>
        </div>

        {verse.loading ? (
          <div className="skeleton" style={{ height: '4rem' }} />
        ) : verse.error ? (
          <Alert variant="warning">The current published verse could not be loaded: {verse.error.message}</Alert>
        ) : null}

        <form className="form-grid" onSubmit={handleSave} style={{ marginTop: '1rem' }} noValidate>
          {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
          <Input
            label="Verse text"
            value={form.text}
            onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
            required
          />
          <Input
            label="Reference (e.g. John 3:16)"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            required
          />
          <Input label="Publication status" type="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={[{ value: 'PUBLISHED', label: 'Published' }, { value: 'SCHEDULED', label: 'Scheduled' }, { value: 'UNPUBLISHED', label: 'Unpublished' }]} />
          <Input label="Reflection (optional)" type="textarea" value={form.reflection} onChange={(e) => setForm((f) => ({ ...f, reflection: e.target.value }))} />
          <Input label="Background image URL (optional)" type="url" value={form.backgroundImageUrl} onChange={(e) => setForm((f) => ({ ...f, backgroundImageUrl: e.target.value }))} />
          <label className="check-label"><input type="checkbox" checked={form.publishToWebsite} onChange={(e) => setForm((f) => ({ ...f, publishToWebsite: e.target.checked }))} /> Show this verse on the public site</label>
          <div>
            <Button type="submit" loading={saving} iconRight={<Save size={15} />} disabled={!form.text.trim() || !form.reference.trim()}>
              Save verse
            </Button>
          </div>
        </form>
      </div>
      <div className="card card-body">
        <h2 className="serif" style={{ fontSize: '1.25rem' }}>Published and scheduled verses</h2>
        {publications.loading ? <div className="skeleton" style={{ height: '4rem', marginTop: '1rem' }} /> : null}
        {!publications.loading && !publications.data?.length ? <p className="muted" style={{ marginTop: '1rem' }}>No verses have been created yet.</p> : null}
        <div className="stack" style={{ marginTop: '1rem' }}>{publications.data?.map((item) => <div className="row" key={item.id} style={{ justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}><span><strong>{item.reference}</strong><small className="muted" style={{ display: 'block' }}>{item.status} · {item.publicationDate}</small></span><span className="row"><Button size="sm" variant="secondary" onClick={async () => { await contentService.updateVerse(item.id, { status: item.status === 'PUBLISHED' ? 'UNPUBLISHED' : 'PUBLISHED' }); publications.reload(); verse.reload(); }} iconLeft={<EyeOff size={14} />}>{item.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</Button><Button size="sm" variant="ghost" onClick={async () => { await contentService.archiveVerse(item.id); publications.reload(); verse.reload(); }} aria-label="Archive verse"><Archive size={15} /></Button></span></div>)}</div>
      </div>
    </div>
  );
}
