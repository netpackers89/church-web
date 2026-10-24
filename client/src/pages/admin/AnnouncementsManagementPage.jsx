import { Plus } from 'lucide-react';
import { useState } from 'react';
import { adminService as messaging } from '../../services/index.js';
import { adminService as announcementsService } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import MediaUploadField from '../../components/ui/MediaUploadField.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const BLANK_FORM = { title: '', body: '', status: 'DRAFT', imageUrl: '' };

export default function AnnouncementsManagementPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { success } = useToast();
  const [templateId, setTemplateId] = useState('');

  const announcements = useAsync(async () => {
    const res = await announcementsService.announcements();
    return res?.data?.data ?? res?.data ?? [];
  }, []);
  const templates = useAsync(async () => (await messaging.emailTemplates())?.data?.data ?? [], []);

  function applyTemplate(id) {
    setTemplateId(id);
    const template = (templates.data ?? []).find((item) => String(item.id) === String(id));
    if (!template) return;
    setForm((current) => ({ ...current, title: template.title || template.subject || current.title, body: template.body || current.body, imageUrl: template.bannerUrl || current.imageUrl }));
  }

  async function handleSave(action, payload) {
    setSaving(true);
    setSaveError('');
    setTemplateId('');
    try {
      const data = {
        title: payload?.title || form.title,
        body: form.body,
        status: action,
        imageUrl: payload?.mediaUrl || form.imageUrl,
      };
      if (editing) await announcementsService.updateAnnouncement(editing.id, data);
      else await announcementsService.createAnnouncement(data);
      success(editing ? 'Announcement updated' : 'Announcement saved');
      setModalOpen(false);
      setEditing(null);
      setForm(BLANK_FORM);
      await announcements.reload();
    } catch (reason) {
      setSaveError(reason.message || 'Could not save the announcement.');
    } finally {
      setSaving(false);
    }
  }

  const openNew = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setSaveError('');
    setTemplateId('');
    setModalOpen(true);
  };

  const openEdit = (announcement) => {
    setEditing(announcement);
    setForm({ title: announcement.title || '', body: announcement.body || '', status: announcement.status || 'DRAFT', imageUrl: announcement.imageUrl || '' });
    setSaveError('');
    setModalOpen(true);
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Announcements</h1>
          <p>Church-wide notices, events, and updates for members and the public.</p>
        </div>
        <div className="page-actions">
          <Button iconRight={<Plus size={15} />} onClick={openNew}>New announcement</Button>
        </div>
      </div>

      <DataState
        query={announcements}
        feature="Announcements"
        endpoint="/admin/announcements"
        emptyState={
          <EmptyState
            icon={<Plus size={30} />}
            title="No announcements yet"
            description="Announcements appear on the public site once published."
            action={<Button onClick={openNew} iconRight={<Plus size={15} />}>Create the first announcement</Button>}
          />
        }
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id ?? a.title}>
                    <td><button type="button" className="table-link-button" onClick={() => openEdit(a)}><strong>{a.title ?? 'Untitled'}</strong></button></td>
                    <td><span className={`badge ${a.status === 'PUBLISHED' ? 'badge-success' : 'badge-neutral'}`}>{a.status}</span></td>
                    <td className="muted">{(a.publishedAt || '').slice(0, 10)}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit announcement' : 'New announcement'}>
        {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
        <form className="stack">
          <Input label="Start from a communication template (optional)" type="select" value={templateId} onChange={(event) => applyTemplate(event.target.value)}
            options={(templates.data ?? []).filter((template) => !template.isArchived).map((template) => ({ value: String(template.id), label: `${template.name} · ${template.category?.replaceAll('_', ' ') || 'General'}` }))}
            placeholder="Write an announcement from scratch" />
          <MediaUploadField
            mediaType="ANNOUNCEMENT"
            record={editing}
            title={form.title}
            onTitleChange={(v) => setForm((c) => ({ ...c, title: v }))}
            status={form.status}
            currentUrl={form.imageUrl}
            onRemoveMedia={() => setForm((current) => ({ ...current, imageUrl: '' }))}
            onStatusChange={(v) => setForm((c) => ({ ...c, status: v }))}
            onDraft={(p) => handleSave('DRAFT', p)}
            onPublish={(p) => handleSave('PUBLISHED', p)}
            hint="Upload an image up to 5 MB. Drafts stay private."
          />
          <Input type="textarea" rows={5} label="Message body" value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} />
          <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
