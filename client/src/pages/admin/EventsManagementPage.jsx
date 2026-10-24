import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { adminService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import MediaUploadField from '../../components/ui/MediaUploadField.jsx';
import { adminService as messaging, eventsService } from '../../services/index.js';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const BLANK_FORM = {
  title: '', startsAt: '', endsAt: '', location: '', description: '', imageUrl: '', status: 'DRAFT',
  category: '', requiresRegistration: false, notifyMembers: false, notifyAllMembers: false, audienceDepartmentId: '',
};

export default function EventsManagementPage() {
  const [renderedAt] = useState(() => Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { success } = useToast();
  const events = useAsync(async () => unwrap(await adminService.events()) ?? [], []);
  const templates = useAsync(async () => unwrap(await messaging.emailTemplates()) ?? [], []);
  const [templateId, setTemplateId] = useState('');

  async function handleSave(action, payload) {
    setSaving(true);
    setSaveError('');
    try {
      const data = {
        ...form,
        title: payload?.title || form.title,
        imageUrl: payload?.mediaUrl || form.imageUrl,
        status: action,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      };
      if (editing) await eventsService.update(editing.id, data);
      else await eventsService.create(data);
      success(action === 'PUBLISHED' ? 'Event published' : 'Event saved as draft');
      setModalOpen(false);
      setEditing(null);
      setForm(BLANK_FORM);
      await events.reload();
    } catch (reason) {
      setSaveError(reason.message || 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(BLANK_FORM);
    setSaveError('');
    setTemplateId('');
    setModalOpen(true);
  }

  function applyTemplate(id) {
    setTemplateId(id);
    const template = (templates.data ?? []).find((item) => String(item.id) === String(id));
    if (!template) return;
    setForm((current) => ({ ...current, title: template.title || template.subject || current.title, description: template.body || current.description, imageUrl: template.bannerUrl || current.imageUrl }));
  }

  function openEdit(event) {
    setEditing(event);
    setForm({
      ...BLANK_FORM,
      ...event,
      startsAt: event.startAt ? new Date(event.startAt).toISOString().slice(0, 16) : '',
      endsAt: event.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : '',
      location: event.location || '',
      status: event.status || 'DRAFT',
      audienceDepartmentId: event.audienceDepartmentId ? String(event.audienceDepartmentId) : '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  function statusLabel(event) {
    if (event.status === 'CANCELLED') return 'Cancelled';
    if (event.status === 'POSTPONED') return 'Postponed';
    if (event.status === 'DRAFT') return 'Draft';
    if (event.endAt && new Date(event.endAt).getTime() < renderedAt) return 'Completed';
    return 'Published';
  }

  function statusTone(event) {
    const label = statusLabel(event);
    return label === 'Published' ? 'success' : label === 'Cancelled' ? 'danger' : label === 'Draft' ? 'warning' : 'neutral';
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Events &amp; gatherings</h1>
          <p>Manage one-time events and regular programs. Published events appear on the church calendar.</p>
        </div>
        <div className="page-actions">
          <Button iconRight={<Plus size={15} />} onClick={openNew}>New event</Button>
        </div>
      </div>

      <DataState
        query={events}
        feature="Events management"
        endpoint="/admin/events"
        emptyState={<EmptyState icon={<CalendarDays size={30} />} title="No events yet" description="Create a draft for review or publish an event to the church calendar." action={<Button onClick={openNew} iconRight={<Plus size={15} />}>Create the first event</Button>} />}
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Event</th><th>Date</th><th>Location</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((event) => (
                  <tr key={event.id}>
                    <td><strong>{event.title}</strong>{event.programId ? <div className="muted">Promoted from master program</div> : null}</td>
                    <td className="muted">{event.startAt ? new Date(event.startAt).toLocaleString() : '—'}</td>
                    <td className="muted">{event.location || '—'}</td>
                    <td><Badge variant={statusTone(event)}>{statusLabel(event)}</Badge></td>
                    <td><Button size="sm" variant="ghost" onClick={() => openEdit(event)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit event' : 'New event'} size="lg">
        {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
        <form className="stack">
          <Input label="Start from a communication template (optional)" type="select" value={templateId} onChange={(event) => applyTemplate(event.target.value)}
            options={(templates.data ?? []).filter((template) => !template.isArchived).map((template) => ({ value: String(template.id), label: `${template.name} · ${template.category?.replaceAll('_', ' ') || 'General'}` }))}
            placeholder="Write an event from scratch" />
          <MediaUploadField
            mediaType="EVENT"
            required={false}
            record={editing}
            title={form.title}
            onTitleChange={(value) => setForm((current) => ({ ...current, title: value }))}
            status={form.status}
            onStatusChange={(status) => setForm((current) => ({ ...current, status }))}
            currentUrl={form.imageUrl}
            onRemoveMedia={() => setForm((current) => ({ ...current, imageUrl: '' }))}
            onDraft={(payload) => handleSave('DRAFT', payload)}
            onPublish={(payload) => handleSave('PUBLISHED', payload)}
            disabled={saving}
            hint="A banner is optional. Save as draft for review or publish to the church calendar."
          />
          <div className="grid-2">
            <Input label="Start date and time" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required />
            <Input label="End date and time" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
          </div>
          <div className="grid-2">
            <Input label="Location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
            <Input label="Category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Worship, Bible study, youth" />
          </div>
          <Input type="textarea" label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
          <Input label="Guest speaker (optional)" value={form.guestSpeaker || ''} onChange={(event) => setForm((current) => ({ ...current, guestSpeaker: event.target.value }))} maxLength={200} />
          <label className="check-label"><input type="checkbox" checked={form.requiresRegistration} onChange={(event) => setForm((current) => ({ ...current, requiresRegistration: event.target.checked }))} /> Require member registration</label>
          <label className="check-label"><input type="checkbox" checked={form.notifyMembers} onChange={(event) => setForm((current) => ({ ...current, notifyMembers: event.target.checked }))} /> Send configured member notifications when published</label>
          {form.notifyMembers ? <><label className="check-label"><input type="checkbox" checked={form.notifyAllMembers} onChange={(event) => setForm((current) => ({ ...current, notifyAllMembers: event.target.checked }))} /> Send to all opted-in active members</label><Input label="Department ID (optional)" type="number" min="1" value={form.audienceDepartmentId} onChange={(event) => setForm((current) => ({ ...current, audienceDepartmentId: event.target.value }))} hint="If provided, only members of that department are notified." /></> : null}
        </form>
      </Modal>
    </div>
  );
}
