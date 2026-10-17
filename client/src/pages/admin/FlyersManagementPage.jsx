import { Plus, Trash2, Pencil } from 'lucide-react';
import { useState, useCallback } from 'react';
import { contentService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import MediaUploadField from '../../components/ui/MediaUploadField.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

export default function FlyersManagementPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [removing, setRemoving] = useState(null);
  const { success } = useToast();

  const media = useAsync(async () => {
    const res = await contentService.listMedia({ limit: 100 });
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '' });
    setSaveError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ title: item.title || '', description: item.description || '' });
    setSaveError('');
  };

  const handleSave = useCallback(
    async (action, payload) => {
      setSaveError('');
      try {
        await contentService.createMedia({
          type: 'FLYER', title: payload.title, mediaUrl: payload?.mediaUrl || '', mediaId: payload?.mediaId,
          isThumbnail: payload?.isThumbnail, thumbnailUrl: payload?.thumbnailUrl,
          description: form.description, isPublic: action === 'PUBLISHED',
        });
        success(editing ? 'Flyer updated' : 'Flyer saved');
        setModalOpen(false);
        setEditing(null);
        setForm({ title: '', description: '' });
        media.reload();
      } catch (reason) {
        setSaveError(reason.message || 'Could not save the flyer.');
      }
    },
    [editing, form, contentService, success, setModalOpen, setEditing, setForm],
  );

  const confirmRemove = async (id) => {
    setRemoving(id);
    try {
      await contentService.deleteMedia(id);
      success('Flyer removed');
      setRemoving(null);
      media.reload();
    } catch (reason) {
      setSaveError(reason.message || 'Could not remove the flyer.');
      setRemoving(null);
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Digital flyers</h1>
        </div>
        <div className="page-actions">
          <Button iconRight={<Plus size={15} />} onClick={openNew}>New flyer</Button>
        </div>
      </div>

      <DataState
        query={media}
        emptyState={
          <EmptyState
            icon={<Plus size={30} />}
            title="No flyers yet"
            description="Published flyer uploads appear on the public site."
            action={<Button onClick={openNew} iconRight={<Plus size={15} />}>Create the first flyer</Button>}
          />
        }
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cover</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id ?? m.title}>
                    <td className="nowrap">{m.mediaUrl ? <img src={m.mediaUrl} alt={m.title ?? ''} style={{ width: '5rem', height: '5rem', objectFit: 'cover', borderRadius: '0.4rem' }} /> : null}</td>
                    <td><strong>{m.title ?? 'Untitled'}</strong></td>
                    <td><span className={`badge ${m.isPublic ? 'badge-success' : 'badge-neutral'}`}>{m.isPublic ? 'Published' : 'Draft'}</span></td>
                    <td className="row">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(m)} iconLeft={<Pencil size={14} />}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => confirmRemove(m.id)} disabled={removing === m.id}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit flyer' : 'New flyer'}>
        {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
        <form className="stack">
          <MediaUploadField
            mediaType="FLYER"
            record={editing}
            title={form.title}
            onTitleChange={(v) => setForm((c) => ({ ...c, title: v }))}
            status={editing ? 'PUBLISHED' : 'DRAFT'}
            onRemoveMedia={() => {}}
            onDraft={(p) => handleSave('DRAFT', p)}
            onPublish={(p) => handleSave('PUBLISHED', p)}
            hint="Drafts stay private. Publish to show publicly."
          />
          <Input type="textarea" rows={4} label="Caption (optional)" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
          <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" variant="ghost" onClick={() => removing && confirmRemove(editing.id)} disabled={removing === editing?.id || saving}>
              {removing === editing?.id ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
